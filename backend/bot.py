"""Opt-in Telegram interface. Reads chain data; payments always return to the web wallet."""
import logging
import time
from urllib.parse import urlencode

import httpx
from pydantic import ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.config import Settings
from app.schemas import ChatRequest


class BotSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=Settings.model_config['env_file'], extra='ignore')
    telegram_bot_token: str = ''
    telegram_allowed_user_ids: str = ''
    bot_backend_url: str = 'http://127.0.0.1:8000'
    app_public_url: str = 'https://monad-ai-concierge.vercel.app'


def command_reply(text, wallet, call, app_url):
    command, _, arg = text.strip().partition(' ')
    command = command.split('@')[0].lower()
    if command in ('/start', '/help'):
        return ('Monad Concierge · TESTNET ONLY\n/wallet 0x… — select a public account (read only)\n'
            '/balance — live MON balance\n/gas — live gas and block\n/swap 1 — open a demo swap preview\n'
            '/send 0.01 MON to Father — open the wallet for review\n'
            'I never hold keys, approve transfers or ask for a passkey here.'), wallet
    if command == '/wallet':
        try:
            wallet = ChatRequest(prompt='read', wallet_address=arg.strip()).wallet_address
        except ValidationError:
            return 'Enter a full valid wallet address after /wallet. This does not authenticate ownership.', wallet
        return f'Read-only account selected: {wallet}', wallet
    if command == '/gas':
        data = call('GET', '/api/gas')
        return f"Monad Testnet · block {data['block_number']}\nGas: {data['gas_price_gwei']} gwei per unit (not a total fee).", wallet
    if command == '/balance':
        if not wallet:
            return 'First select a public account with /wallet 0x…', wallet
        data = call('POST', '/api/account', {'prompt': 'Read balance', 'wallet_address': wallet})
        return f"Balance: {data['balance_mon']} MON\nBlock: {data['block_number']}\nRead only; not proof of ownership.", wallet
    if command in ('/swap', '/send'):
        if command == '/swap':
            import re
            if not re.fullmatch(r'[0-9]+(?:\.[0-9]+)?', arg.strip()):
                return 'Use /swap 1. Swaps currently use demo quotes; no funds move.', wallet
            intent = f'Swap {arg.strip()} MON to USDC'
        else:
            if not arg or len(arg) > 300:
                return 'Use /send 0.01 MON to Father (a contact saved in your web wallet).', wallet
            intent = 'Send ' + arg.strip()
        link = app_url.rstrip('/') + '/?' + urlencode({'intent': intent})
        return f'Open the wallet, connect, and review the request. No action has been sent. Transfers move real testnet tokens; swaps are demos.\n{link}', wallet
    return 'Use /help for supported commands. Never send an API key, private key or passkey here.', wallet


def main():
    settings, bot = Settings(), BotSettings()
    allowed = {int(value.strip()) for value in bot.telegram_allowed_user_ids.split(',') if value.strip().isdigit()}
    if not bot.telegram_bot_token or not allowed:
        raise SystemExit('Save TELEGRAM_BOT_TOKEN and TELEGRAM_ALLOWED_USER_IDS in backend/.env first. The bot stays off until configured.')
    for name in ('httpx', 'httpcore'):
        logging.getLogger(name).setLevel(logging.CRITICAL)
    wallets, offset = {}, None
    base = 'https://api.telegram.org/bot' + bot.telegram_bot_token
    with httpx.Client(timeout=40) as telegram, httpx.Client(base_url=bot.bot_backend_url,
            headers={'X-API-Token': settings.api_access_token.get_secret_value()}, timeout=50) as backend:
        def call(method, path, body=None):
            response = backend.request(method, path, json=body)
            if not response.is_success:
                raise RuntimeError('Backend unavailable')
            return response.json()
        print('Telegram read-only interface running. Financial approvals stay in the web wallet.')
        while True:
            try:
                result = telegram.post(base + '/getUpdates', json={'offset': offset, 'timeout': 25, 'allowed_updates': ['message']})
                if not result.is_success:
                    print('Telegram unavailable. Check the token and polling configuration.');time.sleep(5);continue
                for update in result.json().get('result', []):
                    offset = update['update_id'] + 1
                    message = update.get('message', {})
                    user = message.get('from', {}).get('id')
                    if user not in allowed or message.get('chat', {}).get('type') != 'private':
                        continue
                    try:
                        reply, wallet = command_reply(message.get('text', ''), wallets.get(user), call, bot.app_public_url)
                        wallets[user] = wallet
                    except Exception:
                        reply = 'The blockchain connection is unavailable. Retry shortly. Nothing was signed or sent.'
                    telegram.post(base + '/sendMessage', json={'chat_id': message['chat']['id'], 'text': reply, 'link_preview_options': {'is_disabled': True}})
            except (httpx.RequestError, ValueError, KeyError):
                print('Connection interrupted. Retrying; no actions were submitted.');time.sleep(5)


if __name__ == '__main__':
    main()
