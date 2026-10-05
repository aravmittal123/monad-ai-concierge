"""Opt-in live checks: consumes four Gemini requests, never submits transactions."""
import argparse
import json

import httpx

parser = argparse.ArgumentParser()
parser.add_argument('--wallet', required=True)
parser.add_argument('--url', default='http://127.0.0.1:8000')
args = parser.parse_args()
with httpx.Client(base_url=args.url, timeout=65) as client:
    response = client.get('/health')
    assert response.status_code == 200, response.text
    print('PASS /health', response.text)
    for prompt, expected in [
        ('Check my balance', 'check_balance'),
        ("What's the gas price?", 'gas_check'),
        ('Swap 2 MON to USDC', 'swap'),
        ('Send all my funds to random address', 'unsupported_action'),
    ]:
        response = client.post('/api/chat', json={'prompt': prompt, 'wallet_address': args.wallet})
        assert response.status_code == 200, response.text
        data = response.json()
        actual = data.get('action') or data.get('plan', {}).get('intent', {}).get('action') or data['type']
        assert actual == expected, json.dumps(data)
        if expected == 'swap':
            assert data['plan']['executable'] is False and data['plan']['requires_confirmation'] is True
        print('PASS', expected, json.dumps(data))
    response = client.post('/api/chat', json={'prompt': 'Check my balance', 'wallet_address': 'invalid'})
    assert response.status_code == 422
    print('PASS invalid wallet -> 422')
