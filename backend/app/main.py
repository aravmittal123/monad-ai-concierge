import logging
import hmac
import time
from decimal import Decimal
from collections import defaultdict, deque
from threading import Lock
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.config import Settings
from app.errors import ServiceError
from app.schemas import ActionPlan, ChatRequest, PrepareRequest, RevalidateRequest, SwapIntent
from app.services.gemini import GeminiService
from app.services.nvidia import NvidiaService
from app.services.intents import resolve_intent
from app.services.monad import MonadService
from app.services.transaction import TransactionService
from app.services.policy import validate_prompt_policy
from app.services.transfers import resolve_recipient
from app.services.activity import activity_snapshot
from app.services.knowledge import ANSWERS

logging.basicConfig(level=logging.INFO, format='%(levelname)s %(name)s %(message)s')
# Avoid SDK request URLs/response bodies in logs.
for name in ('httpx', 'httpcore', 'google_genai', 'web3', 'urllib3'):
    logging.getLogger(name).setLevel(logging.CRITICAL)


def create_app(settings=None, gemini=None, monad=None):
    settings = settings or Settings()
    ai = gemini if gemini is not None else (NvidiaService(settings) if settings.ai_provider == 'nvidia' else GeminiService(settings))
    rpc = monad if monad is not None else MonadService(settings)
    transactions = TransactionService(settings, rpc)
    access_token = settings.api_access_token.get_secret_value()
    if settings.require_api_token and len(access_token) < 32:
        raise RuntimeError('Public deployment requires API_ACCESS_TOKEN of at least 32 characters.')
    requests = defaultdict(deque)
    rate_lock = Lock()

    @asynccontextmanager
    async def lifespan(app):
        yield
        ai.close()

    app = FastAPI(title='Monad AI Concierge', version='1.0.0', lifespan=lifespan)

    @app.middleware('http')
    async def access_guard(request: Request, call_next):
        if request.url.path.startswith('/api/'):
            if access_token and not hmac.compare_digest(request.headers.get('x-api-token', ''), access_token):
                return JSONResponse(status_code=401, content={'error': {'code': 'unauthorized', 'message': 'Use the application gateway.'}})
            try:
                content_length = int(request.headers.get('content-length', '0') or '0')
            except ValueError:
                return JSONResponse(status_code=400, content={'error': {'code': 'invalid_request', 'message': 'Invalid content length.'}})
            if content_length > 16384:
                return JSONResponse(status_code=413, content={'error': {'code': 'body_too_large', 'message': 'Request too large.'}})
            ip = request.client.host if request.client else 'unknown'
            now = time.monotonic()
            with rate_lock:
                if len(requests) > 1024:
                    requests.clear()
                read_poll = request.url.path == '/api/gas'
                hits = requests[(ip, 'gas' if read_poll else 'actions')]
                while hits and hits[0] < now - 60:
                    hits.popleft()
                if len(hits) >= (120 if read_poll else settings.rate_limit_per_minute):
                    return JSONResponse(status_code=429, content={'error': {'code': 'rate_limited', 'message': 'Please wait a minute before trying again.'}})
                hits.append(now)
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    @app.exception_handler(ServiceError)
    async def service_error(request: Request, exc: ServiceError):
        return JSONResponse(status_code=exc.status, content={'error': {'code': exc.code, 'message': exc.message}})

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        logging.getLogger(__name__).info('request validation=failed')
        return JSONResponse(status_code=422, content={'error': {'code': 'invalid_request',
            'message': 'Request fields are invalid. Check the wallet, amount and limits; no extra fields are accepted.',
            'fields': ['.'.join(map(str, error['loc'])) for error in exc.errors()]}})

    @app.get('/health')
    def health():
        try:
            snapshot = rpc.snapshot()
        except ServiceError as exc:
            return JSONResponse(status_code=503, content={'status': 'degraded', 'rpc_connected': False,
                'error': {'code': exc.code, 'message': exc.message}})
        return {'status': 'ok', 'rpc_connected': True, 'gemini_configured': bool(settings.gemini_api_key.get_secret_value()),
                'gemini_model': settings.gemini_model, 'ai_provider': settings.ai_provider, **snapshot}

    @app.post('/api/chat')
    def chat(body: ChatRequest):
        # Chain data stays outside the model. The LLM only sees the user's text.
        intent, source = resolve_intent(body.prompt, ai, settings.ai_provider)
        validate_prompt_policy(body.prompt, intent)
        if intent.action == 'explain':
            answer = ANSWERS[intent.params.topic]
            if settings.swap_mode == 'puddleswap_v2':
                if intent.params.topic == 'swaps':
                    answer = 'Swaps exchange MON for Circle testnet USDC through PuddleSwap V2. Review the live quote, minimum USDC received, slippage limit and wallet fee, then approve with your passkey. USDC arrives in this same account after a successful receipt. Only MON to USDC is supported. This is an unaudited testnet DEX; test tokens have no bank-dollar value. A balance condition pauses for your confirmation before preparing the swap.'
                elif intent.params.topic == 'capabilities':
                    answer = answer.replace('demonstrate MON-to-USDC swaps', 'prepare live MON-to-USDC testnet swaps')
            return {'type':'information', 'message':answer, 'intent_source':source,
                    'requires_confirmation':False, 'answer_source':'product_guide'}
        if intent.action == 'unsupported_action':
            return {'type': 'unsupported_action', 'message': 'I cannot safely carry out that request. I support MON/USDC balance checks, live gas, contact transfers, demo swaps and wallet explanations. Ask What can you do? for examples. USD is ambiguous; use USDC for a testnet token. Investment predictions, bank payouts and unattended payments are not supported.',
                    'requires_confirmation': False, 'intent_source': source}
        snapshot = rpc.snapshot(body.wallet_address)
        if intent.action == 'check_usdc_balance':
            balance = rpc.usdc_balance(body.wallet_address, snapshot['block_number'])
            return {'type':'information','message':f'Your balance is {balance} testnet USDC. MON is still needed for unsponsored wallet fees.',
                    'chain_data':snapshot,'intent_source':source,'requires_confirmation':False}
        steps = None
        if intent.action == 'balance_then_swap':
            met = Decimal(snapshot['balance_mon']) > Decimal(intent.params.min_balance_mon)
            steps = [{'title': 'Check balance', 'status': 'complete'},
                {'title': f'Balance above {intent.params.min_balance_mon} MON', 'status': 'complete' if met else 'blocked'},
                {'title': 'Review swap preview', 'status': 'ready' if met else 'blocked'}]
            if not met:
                return {'type': 'information', 'message': f"Your balance is {snapshot['balance_mon']} MON. The condition requires more than {intent.params.min_balance_mon} MON, so the swap stopped.",
                    'chain_data': snapshot, 'intent_source': source, 'steps': steps, 'requires_confirmation': False}
            intent = SwapIntent(action='swap', params=intent.params)
        if intent.action == 'transfer':
            resolve_recipient(intent.params.recipient, body.contacts)
            available = snapshot['balance_mon'] if intent.params.token == 'MON' else rpc.usdc_balance(body.wallet_address, snapshot['block_number'])
            if Decimal(intent.params.amount) > Decimal(available):
                raise ServiceError('insufficient_balance', f'You have {available} {intent.params.token}, but requested {intent.params.amount} {intent.params.token}. Reduce the amount or fund this account. Unsponsored fees also require MON.', 409)
        if intent.action in ('swap', 'transfer'):
            plan = ActionPlan(intent=intent, wallet_address=body.wallet_address, chain_id=snapshot['chain_id'])
            return {'type': 'action_plan', 'plan': plan.model_dump(), 'chain_data': snapshot, 'intent_source': source,
                    'steps': steps, 'needs_step_confirmation': bool(steps),
                    'message': 'Balance condition passed. Continue to review a fresh swap preview.' if steps else
                    'Review the full recipient and amount before approving this real testnet transfer.' if intent.action == 'transfer' else
                    'Review a fresh swap preview before approving anything.'}
        message = (f"Your balance is {snapshot['balance_mon']} MON." if intent.action == 'check_balance'
                   else f"Current gas price is {snapshot['gas_price_gwei']} gwei per gas unit. This is not a transaction fee estimate.")
        return {'type': 'information', 'action': intent.action, 'message': message, 'intent_source': source,
                'wallet_address': body.wallet_address, 'chain_data': snapshot, 'requires_confirmation': False}

    @app.get('/api/config')
    def config():
        return {'chain_id': settings.monad_chain_id, 'network': 'Monad Testnet',
                'explorer_url': str(settings.monad_explorer_url).rstrip('/'),
                'swap_mode': settings.swap_mode, 'max_swap_mon': settings.max_swap_mon,
                'token_registry': {'MON': {'decimals': 18}, 'USDC': {'decimals': 6}},
                'activity_registry_address': settings.activity_registry_address or None,
                'ai_provider': settings.ai_provider,
                'ai_configured': bool((settings.nvidia_api_key if settings.ai_provider == 'nvidia' else settings.gemini_api_key).get_secret_value()),
                'version': '1.1.0'}

    @app.post('/api/account')
    def account(body: ChatRequest):
        return rpc.snapshot(body.wallet_address)

    @app.post('/api/tokens')
    def tokens(body: ChatRequest):
        snapshot = rpc.snapshot(body.wallet_address)
        return {'usdc': rpc.usdc_balance(body.wallet_address, snapshot['block_number']),
                'block_number': snapshot['block_number']}

    @app.get('/api/gas')
    def gas():
        return rpc.gas()

    @app.post('/api/activity')
    def activity(body: ChatRequest):
        return activity_snapshot(settings, rpc, body.wallet_address)

    @app.post('/api/prepare')
    def prepare(body: PrepareRequest):
        return transactions.prepare(body)

    @app.post('/api/revalidate')
    def revalidate(body: RevalidateRequest):
        return transactions.revalidate(body)

    return app


app = create_app()
