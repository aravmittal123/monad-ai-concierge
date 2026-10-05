import json
from types import SimpleNamespace
from unittest.mock import Mock

import httpx
import pytest
from fastapi.testclient import TestClient
from google.genai import errors

from app.config import Settings
from app.errors import ServiceError
from app.main import create_app
from app.schemas import ChatRequest
from app.services.gemini import GeminiService
from app.services.monad import MonadService, units

WALLET = '0x0000000000000000000000000000000000000001'
SETTINGS = Settings(_env_file=None, gemini_api_key='')
SNAPSHOT = {'chain_id': 10143, 'block_number': 123, 'balance_wei': '2500000000000000001',
            'balance_mon': '2.500000000000000001', 'gas_price_wei': '100000000000', 'gas_price_gwei': '100'}


def make_client(raw=None, rpc_error=None, ai_error=None):
    ai = GeminiService(SETTINGS)
    generate = Mock(return_value=SimpleNamespace(text=json.dumps(raw)), side_effect=ai_error)
    ai.client = SimpleNamespace(models=SimpleNamespace(generate_content=generate), close=lambda: None)
    rpc = Mock()
    rpc.snapshot = Mock(return_value=SNAPSHOT, side_effect=rpc_error)
    return TestClient(create_app(SETTINGS, ai, rpc)), generate, rpc


def post(client, prompt='How much MON do I currently hold?', **overrides):
    return client.post('/api/chat', json={'prompt': prompt, 'wallet_address': WALLET, **overrides})


def test_health():
    client, _, _ = make_client()
    response = client.get('/health')
    assert response.status_code == 200
    assert response.json()['rpc_connected'] is True


@pytest.mark.parametrize('prompt,action', [('How much MON do I currently hold?', 'check_balance'), ('Tell me the current gas price', 'gas_check')])
def test_read_intents(prompt, action):
    client, generate, _ = make_client({'action': action, 'params': {}})
    response = post(client, prompt)
    assert response.status_code == 200
    data = response.json()
    assert data['action'] == action and data['requires_confirmation'] is False
    assert data['chain_data']['balance_mon'] == '2.500000000000000001'
    assert generate.call_args.kwargs['contents'] == prompt


def test_swap_plan():
    client, _, _ = make_client({'action': 'swap', 'params': {'token_in': 'MON', 'token_out': 'USDC', 'amount': '2'}})
    response = post(client, 'Swap 2 MON to USDC')
    assert response.status_code == 200
    plan = response.json()['plan']
    assert plan['requires_confirmation'] is True
    assert plan['executable'] is False
    assert plan['intent']['params']['amount'] == '2'
    assert 'transaction' not in plan


def test_condition_preserved():
    client, _, _ = make_client({'action': 'swap', 'params': {'token_in': 'MON', 'token_out': 'USDC', 'amount': '2', 'max_gas_price_gwei': '50.1'}})
    assert post(client).json()['plan']['intent']['params']['max_gas_price_gwei'] == '50.1'


def test_unsupported():
    client, _, rpc = make_client({'action': 'unsupported_action', 'params': {}})
    assert post(client, 'Send all my funds to random address').json()['type'] == 'unsupported_action'
    rpc.snapshot.assert_not_called()


@pytest.mark.parametrize('wallet', ['nope', '0x123', '0x' + 'z' * 40, 123, None])
def test_invalid_wallet(wallet):
    client, generate, _ = make_client()
    assert post(client, wallet_address=wallet).status_code == 422
    generate.assert_not_called()


@pytest.mark.parametrize('prompt', ['', '   ', 'x' * 2001, 42])
def test_invalid_prompt(prompt):
    client, generate, _ = make_client()
    assert post(client, prompt).status_code == 422
    generate.assert_not_called()


@pytest.mark.parametrize('raw', [None, {}, {'action': 'send', 'params': {}},
    {'action': 'check_balance', 'params': {}, 'to': WALLET},
    {'action': 'gas_check', 'params': {'code': 'print(1)'}}])
def test_malformed_ai(raw):
    client, _, _ = make_client(raw)
    response = post(client)
    assert response.status_code == 502
    assert response.json()['error']['code'] == 'invalid_ai_response'


@pytest.mark.parametrize('amount', ['0', '-2', 'NaN', 'Infinity', '1e9', '0.0000000000000000001', 2, True])
def test_invalid_amount(amount):
    client, _, _ = make_client({'action': 'swap', 'params': {'token_in': 'MON', 'token_out': 'USDC', 'amount': amount}})
    assert post(client).status_code == 502


@pytest.mark.parametrize('token', ['ETH', WALLET, 'USDT'])
def test_unknown_token(token):
    client, _, _ = make_client({'action': 'swap', 'params': {'token_in': 'MON', 'token_out': token, 'amount': '2'}})
    assert post(client).status_code == 502


def test_rpc_unavailable():
    client, _, _ = make_client({'action': 'check_balance', 'params': {}}, ServiceError('rpc_unavailable', 'Retry.'))
    assert post(client).status_code == 503
    assert client.get('/health').json()['rpc_connected'] is False


def test_timeout():
    client, _, _ = make_client(ai_error=httpx.ReadTimeout('sensitive upstream detail'))
    response = post(client)
    assert response.status_code == 504
    assert 'sensitive' not in response.text


def test_quota():
    client, _, _ = make_client(ai_error=errors.ClientError(429, {'error': {'message': 'secret'}}))
    response = post(client)
    assert response.status_code == 503
    assert response.json()['error']['code'] == 'ai_rate_limited'
    assert 'secret' not in response.text


def test_missing_key():
    client = TestClient(create_app(SETTINGS, GeminiService(SETTINGS), Mock()))
    assert post(client).json()['error']['code'] == 'ai_not_configured'


def test_no_backend_execution_route():
    client, _, _ = make_client()
    assert client.post('/api/execute', json={}).status_code == 404
    assert client.post('/api/prepare', json={}).status_code == 422


def test_rpc_checks_chain_and_converts_precisely():
    service = MonadService(SETTINGS)
    eth = Mock(chain_id=10143, gas_price=1000000000)
    eth.get_block.return_value = {'number': 123, 'baseFeePerGas': 42}
    eth.get_balance.return_value = 2500000000000000001
    service.w3 = SimpleNamespace(eth=eth)
    result = service.snapshot(WALLET)
    assert result['balance_mon'] == '2.500000000000000001'
    assert result['gas_price_gwei'] == '1'
    eth.get_balance.assert_called_once_with(WALLET, block_identifier=123)
    eth.chain_id = 1
    with pytest.raises(ServiceError, match='wrong_chain'):
        service.snapshot()


def test_rpc_transport_failure():
    service = MonadService(SETTINGS)
    service.w3 = SimpleNamespace(eth=Mock(chain_id=10143))
    service.w3.eth.get_block.side_effect = ConnectionError('credential-bearing URL')
    with pytest.raises(ServiceError, match='rpc_unavailable'):
        service.snapshot()


def test_decimal_uint256_precision():
    assert units(10**60 + 1, 18).endswith('.000000000000000001')


def test_invalid_json():
    with pytest.raises(ServiceError, match='invalid_ai_response'):
        GeminiService.validate('```json\n{}\n```')
