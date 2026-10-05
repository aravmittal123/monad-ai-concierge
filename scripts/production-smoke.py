"""Live RPC and command checks; optional AI probe, no signatures or transactions."""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import httpx

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='https://monad-ai-concierge.vercel.app')
parser.add_argument('--wallet', default='0xdA6bEa0b5FCc4A3e46075f68E247f17d13A0899e')
parser.add_argument('--ai', action='store_true', help='Also probe the configured AI provider with a non-command prompt')
args = parser.parse_args()
results = []
with httpx.Client(base_url=args.url, timeout=65) as client:
    def call(method, path, body=None):
        r = client.request(method, path, json=body)
        data = r.json()
        results.append({'path': path, 'status': r.status_code, 'response': data})
        return r.status_code, data
    status, health = call('GET', '/api/health')
    assert status == 200 and health['chain_id'] == 10143
    status, config = call('GET', '/api/config')
    assert status == 200
    print('PASS live health/config; wallet configured:', config['wallet_configured'])
    status, gas = call('GET', '/api/gas')
    assert status == 200 and gas['chain_id'] == 10143 and int(gas['gas_price_wei']) > 0
    print('PASS live gas/block widget endpoint')
    if args.ai:
        status, data = call('POST', '/api/chat', {'prompt': 'How much MON do I currently hold?', 'wallet_address': args.wallet})
        assert status == 200 and data['action'] == 'check_balance', data
        assert data.get('intent_source') in ('gemini', 'nvidia'), data
        print('PASS live natural-language AI:', data['intent_source'])
    plans = []
    for prompt, action in [('Check my balance', 'check_balance'), ("What's the gas price?", 'gas_check'),
                          ('Swap 1 MON to USDC only if gas is below 1 gwei', 'swap'), ('Swap 1 MON to USDC', 'swap')]:
        status, data = call('POST', '/api/chat', {'prompt': prompt, 'wallet_address': args.wallet})
        assert status == 200, data
        assert (data.get('action') or data.get('plan', {}).get('intent', {}).get('action')) == action
        if action == 'swap': plans.append(data['plan']['intent'])
        print('PASS', prompt)
    status, data = call('POST', '/api/prepare', {'intent': plans[0], 'wallet_address': args.wallet})
    assert status == 409 and data['error']['code'] == 'gas_limit_exceeded'
    print('PASS gas safeguard blocked before approval')
    status, data = call('POST', '/api/prepare', {'intent': plans[1], 'wallet_address': args.wallet})
    assert status == 200 and data['preview']['requires_confirmation']
    if config['swap_mode'] == 'mock':
        assert data['preview']['transaction'] is None and data['preview']['simulation'] == 'mock_only'
    status, validated = call('POST', '/api/revalidate', {'preview_token': data['preview_token'], 'wallet_address': args.wallet})
    assert status == 200 and validated['preview'] == data['preview']
    print('PASS unsigned preview and fresh policy validation')
    status, transfer = call('POST', '/api/prepare', {'wallet_address': args.wallet,
        'contacts': [{'name':'Father','address':'0x2222222222222222222222222222222222222222'}],
        'intent': {'action':'transfer','params':{'token':'MON','amount':'0.001','recipient':'Father'}}})
    assert status == 200 and transfer['preview']['mode'] == 'transfer', transfer
    assert transfer['preview']['recipient'] == '0x2222222222222222222222222222222222222222'
    assert transfer['preview']['transaction']['value'] == '1000000000000000'
    status, checked = call('POST', '/api/revalidate', {'preview_token':transfer['preview_token'],'wallet_address':args.wallet})
    assert status == 200 and checked['preview'] == transfer['preview']
    print('PASS live MON transfer simulation and recipient-bound preview (not signed or sent)')
    status, rejected = call('POST', '/api/rpc', {'jsonrpc':'2.0', 'id':1, 'method':'eth_sendRawTransaction', 'params':[]})
    assert status == 400 and rejected['error']['code'] == 'rpc_method_rejected'
    print('PASS raw transaction submission blocked')
    for result in results:
        result['response'].pop('preview_token', None)
    output = Path(__file__).resolve().parents[1] / 'backend' / 'production-results.json'
    output.write_text(json.dumps({'observed_at':datetime.now(timezone.utc).isoformat(), 'url':args.url,
        'live_wallet_signature_tested':False, 'results':results}, indent=2), encoding='utf-8')
    print('Saved production-results.json (preview tokens omitted).')
