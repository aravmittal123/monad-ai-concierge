"""Deterministic unsigned calls. No signer, key, or submission method."""
import base64
import hashlib
import hmac
import json
import logging
import secrets
import time
from decimal import Decimal, localcontext

from web3 import Web3

from app.constants.abis import FACTORY_ABI, QUOTE_ABI, ROUTER_ABI, TOKEN_ABI
from app.constants.tokens import DEX, TOKEN_REGISTRY, WMON
from app.errors import ServiceError
from app.schemas import TransactionPreview
from app.services.monad import units
from app.services.transfers import resolve_recipient, transfer_call

logger = logging.getLogger(__name__)


class TransactionService:
    def __init__(self, settings, monad):
        self.settings, self.monad = settings, monad
        configured = settings.preview_secret.get_secret_value()
        if settings.require_api_token and len(configured) < 32:
            raise RuntimeError('Public deployment requires PREVIEW_SECRET of at least 32 characters.')
        self.secret = (configured or secrets.token_urlsafe(48)).encode()

    def sign(self, preview):
        raw = json.dumps(preview, sort_keys=True, separators=(',', ':')).encode()
        payload = base64.urlsafe_b64encode(raw).decode().rstrip('=')
        digest = hmac.new(self.secret, payload.encode(), hashlib.sha256).hexdigest()
        return payload + '.' + digest

    def decode(self, token):
        try:
            payload, digest = token.rsplit('.', 1)
            expected = hmac.new(self.secret, payload.encode(), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(expected, digest):
                raise ValueError()
            data = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
            return TransactionPreview.model_validate(data)
        except (ValueError, TypeError, KeyError):
            raise ServiceError('invalid_preview', 'Preview was changed or is invalid. Prepare it again.', 400) from None

    def policy(self, amount, limit, snapshot, min_balance=None):
        with localcontext() as ctx:
            ctx.prec = 100
            if min_balance is not None and Decimal(snapshot['balance_mon']) <= Decimal(min_balance):
                raise ServiceError('balance_condition_failed', f"Your balance is {snapshot['balance_mon']} MON; it must be more than {min_balance} MON. The workflow stopped.", 409)
            if Decimal(amount) > Decimal(self.settings.max_swap_mon):
                raise ServiceError('amount_limit', 'Amount exceeds the demo safety limit.', 400)
            if limit is not None and Decimal(snapshot['gas_price_gwei']) >= Decimal(limit):
                raise ServiceError('gas_limit_exceeded', 'Current gas is at or above your limit. Nothing was signed or sent.', 409)
            if Decimal(snapshot['balance_mon']) < Decimal(amount):
                raise ServiceError('insufficient_balance', f"You have {snapshot['balance_mon']} MON but need {amount} MON. Get more from the testnet faucet.", 409)

    def prepare(self, body):
        snapshot = self.monad.snapshot(body.wallet_address)
        if snapshot['chain_id'] != 10143:
            raise ServiceError('testnet_only', 'This demo only supports Monad Testnet.', 400)
        params = body.intent.params
        if body.intent.action == 'transfer':
            recipient, name = resolve_recipient(params.recipient, body.contacts)
            preview_id = secrets.token_hex(16)
            activity_id = Web3.keccak(text=preview_id).to_0x_hex() if self.settings.activity_registry_address and params.token == 'MON' else None
            tx, gas = transfer_call(self.settings, self.monad, body.wallet_address, recipient, params.token,
                params.amount, params.max_gas_price_gwei, snapshot, activity_id)
            preview = TransactionPreview(preview_id=preview_id, wallet_address=body.wallet_address, activity_id=activity_id,
                chain_id=10143, mode='transfer', action='transfer', token=params.token, amount=params.amount,
                recipient=recipient, recipient_name=name, amount_mon=params.amount if params.token == 'MON' else '0',
                estimated_usdc='0', minimum_usdc='0', slippage_bps=0, gas_price_gwei=snapshot['gas_price_gwei'],
                estimated_call_gas_mon=gas, max_gas_price_gwei=params.max_gas_price_gwei,
                expires_at=int(time.time()) + self.settings.preview_ttl_seconds,
                simulation='rpc_call_passed', transaction=tx,
                warnings=['REAL TESTNET TRANSFER: tokens will leave this smart account.',
                    'Check the full recipient address. A saved contact is a local address-book entry, not verified identity.',
                    'The wallet estimates account deployment and the full transaction fee before approval.'])
            data = preview.model_dump()
            return {'preview': data, 'preview_token': self.sign(data)}
        self.policy(params.amount, params.max_gas_price_gwei, snapshot, params.min_balance_mon)
        expiry = int(time.time()) + self.settings.preview_ttl_seconds
        if self.settings.swap_mode == 'mock':
            # Deliberately fictional tutorial conversion: 1 MON = 0.10 USDC.
            with localcontext() as ctx:
                ctx.prec = 100
                output = int(Decimal(params.amount) * 100000)
            if output == 0:
                raise ServiceError('amount_too_small', 'Amount rounds to zero demo USDC units.', 400)
            minimum = output * (10000 - body.slippage_bps) // 10000
            tx, gas_mon, simulation = None, None, 'mock_only'
            warnings = ['Rehearsal only: fixed fictional rate 1 MON = 0.10 USDC.',
                        'Passkey signs a demo approval; no funds move and no blockchain transaction is submitted.',
                        'Gas and balance are real Monad RPC readings. No DEX simulation or real quote is claimed.']
        else:
            output, minimum, tx, gas_mon = self.build_real(body, snapshot, expiry)
            simulation = 'rpc_call_passed'
            warnings = ['Testnet tokens only.', 'Call gas excludes account deployment, verification and bundler overhead.',
                        'The wallet must estimate the full UserOperation before you confirm. State can change after simulation.']
        preview = TransactionPreview(
            preview_id=secrets.token_hex(16), wallet_address=body.wallet_address, chain_id=10143,
            mode=self.settings.swap_mode, amount_mon=params.amount, estimated_usdc=units(output, 6),
            minimum_usdc=units(minimum, 6), slippage_bps=body.slippage_bps,
            gas_price_gwei=snapshot['gas_price_gwei'], estimated_call_gas_mon=gas_mon,
            max_gas_price_gwei=params.max_gas_price_gwei, expires_at=expiry,
            min_balance_mon=params.min_balance_mon,
            simulation=simulation, transaction=tx, warnings=warnings)
        data = preview.model_dump()
        logger.info('preview prepared mode=%s simulation=%s', preview.mode, simulation)
        return {'preview': data, 'preview_token': self.sign(data)}

    def build_real(self, body, snapshot, expiry):
        w3 = self.monad.w3
        try:
            addresses = {name: Web3.to_checksum_address(addr) for name, addr in DEX.items()}
            usdc = Web3.to_checksum_address(TOKEN_REGISTRY['USDC']['address'])
            wrapped = Web3.to_checksum_address(WMON)
            for address in [*addresses.values(), usdc, wrapped]:
                if len(w3.eth.get_code(address)) == 0:
                    raise ServiceError('dex_unavailable', 'A verified DEX/token contract has no code on this testnet. Use the explicitly labelled rehearsal mode.', 503)
            router = w3.eth.contract(address=addresses['router'], abi=ROUTER_ABI)
            if router.functions.WETH9().call().lower() != wrapped.lower():
                raise ServiceError('token_mismatch', 'Router wrapped-native token differs from the verified registry.', 503)
            if w3.eth.contract(address=usdc, abi=TOKEN_ABI).functions.decimals().call() != 6:
                raise ServiceError('token_mismatch', 'USDC decimals differ from the registry.', 503)
            with localcontext() as ctx:
                ctx.prec = 100
                amount = int(Decimal(body.intent.params.amount) * 10**18)
            factory = w3.eth.contract(address=addresses['factory'], abi=FACTORY_ABI)
            quoter = w3.eth.contract(address=addresses['quoter'], abi=QUOTE_ABI)
            choices = []
            for fee in (500, 3000, 10000):
                pool = factory.functions.getPool(wrapped, usdc, fee).call()
                if int(pool, 16) == 0:
                    continue
                try:
                    output = quoter.functions.quoteExactInputSingle((wrapped, usdc, amount, fee, 0)).call()[0]
                    if output > 0:
                        choices.append((output, fee))
                except Exception:
                    continue
            if not choices:
                raise ServiceError('no_liquidity', 'No liquid verified WMON/USDC direct pool can quote this amount.', 503)
            output, fee = max(choices)
            minimum = output * (10000 - body.slippage_bps) // 10000
            if minimum == 0:
                raise ServiceError('amount_too_small', 'Amount is too small to protect the minimum output.', 400)
            inner = router.encode_abi('exactInputSingle', args=[(wrapped, usdc, fee, body.wallet_address, amount, minimum, 0)])
            data = router.encode_abi('multicall', args=[expiry, [bytes.fromhex(inner[2:])]])
            tx = {'from': body.wallet_address, 'to': addresses['router'], 'value': amount, 'data': data}
            w3.eth.call(tx)
            gas = w3.eth.estimate_gas(tx)
            if int(snapshot['balance_wei']) < amount + gas * int(snapshot['gas_price_wei']):
                raise ServiceError('insufficient_balance', 'Not enough MON for the amount plus estimated call gas.', 409)
            logger.info('simulation=passed gas=%s', gas)
            return output, minimum, {'to': tx['to'], 'data': data, 'value': str(amount)}, units(gas * int(snapshot['gas_price_wei']), 18)
        except ServiceError:
            raise
        except Exception:
            logger.warning('simulation=failed')
            raise ServiceError('simulation_failed', 'RPC simulation or gas estimation failed. Nothing can be signed.', 409) from None

    def revalidate(self, body):
        preview = self.decode(body.preview_token)
        if preview.wallet_address.lower() != body.wallet_address.lower():
            raise ServiceError('account_mismatch', 'Preview belongs to a different smart account.', 403)
        if preview.expires_at <= int(time.time()):
            raise ServiceError('preview_expired', 'Preview expired. Request a new one.', 409)
        if preview.action == 'swap' and preview.mode != self.settings.swap_mode:
            raise ServiceError('mode_changed', 'Swap mode changed. Request a new preview.', 409)
        snapshot = self.monad.snapshot(preview.wallet_address)
        if snapshot['chain_id'] != preview.chain_id:
            raise ServiceError('wrong_chain', 'RPC chain changed.', 503)
        if preview.action == 'transfer':
            tx, _ = transfer_call(self.settings, self.monad, preview.wallet_address, preview.recipient,
                preview.token, preview.amount, preview.max_gas_price_gwei, snapshot, preview.activity_id)
            if tx != preview.transaction:
                raise ServiceError('preview_changed', 'Transfer details changed. Prepare a new preview.', 409)
            return {'preview': preview.model_dump(), 'approval_message': 'REAL TESTNET TRANSFER — requires transaction approval'}
        self.policy(preview.amount_mon, preview.max_gas_price_gwei, snapshot, preview.min_balance_mon)
        if preview.transaction:
            try:
                tx = {**preview.transaction, 'from': preview.wallet_address, 'value': int(preview.transaction['value'])}
                self.monad.w3.eth.call(tx)
            except Exception:
                raise ServiceError('simulation_failed', 'Fresh simulation failed. Request a new preview.', 409) from None
        data = preview.model_dump()
        return {'preview': data, 'approval_message': 'Monad AI Concierge\nDEMO APPROVAL ONLY — NO FUNDS MOVE\n' +
                json.dumps(data, sort_keys=True, separators=(',', ':'))}
