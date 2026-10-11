"""Exact commands stay available during model outages; all other text uses AI."""
import re

from pydantic import ValidationError

from app.schemas import INTENT_ADAPTER, TransferParams
from app.services.knowledge import EXAMPLES


def normalize_command(prompt):
    text = ' '.join(prompt.strip().replace('\u2019', "'").split())
    text = re.sub(r'^(?:can you |could you |would you )?(?:please )?', '', text, flags=re.I)
    return re.sub(r'(?:,? please)?[.!?]?$', '', text, flags=re.I).strip()


def transfer_fields(prompt):
    text = normalize_command(prompt)
    amount = r'([0-9]+(?:\.[0-9]+)?|\.[0-9]+|one|two|three|four|five|six|seven|eight|nine|ten)'
    condition = r'(?: only if gas is (?:below|under) ([0-9]+(?:\.[0-9]+)?) gwei)?'
    match = re.fullmatch(r'(?:send|transfer|pay) '+amount+r' (MON|USDC) to (?:my )?(.+?)'+condition, text, re.I)
    if match:
        value, token, recipient, gas = match.groups()
    else:
        match = re.fullmatch(r'(?:send|pay) (?:my )?(.+?) '+amount+r' (MON|USDC)'+condition, text, re.I)
        if not match:
            return None
        recipient, value, token, gas = match.groups()
    if re.search(r'\b(and|unless|if|when|tomorrow|all|then|without|except|but|after|before|mainnet|ethereum|bitcoin|solana)\b', recipient, re.I):
        return None
    if not re.fullmatch(r"[A-Za-z][A-Za-z0-9 '\-]{0,31}|0x[0-9a-fA-F]{40}", recipient):
        return None
    words = dict(zip('one two three four five six seven eight nine ten'.split(), map(str,range(1,11))))
    value = words.get(value.lower(), value)
    if value.startswith('.'):
        value = '0'+value
    try:
        return TransferParams(token=token.upper(),amount=value,recipient=recipient,max_gas_price_gwei=gas).model_dump()
    except ValidationError:
        return None

WORKFLOW_PATTERN = (r'check my balance,?\s+(?:and )?if i have (?:mon )?(?:more than|above|over) '
    r'([0-9]+(?:\.[0-9]+)?)(?: mon)?,?\s+(?:then )?'
    r'swap ([0-9]+(?:\.[0-9]+)?)(?: mon)? (?:to|into|with|it) usdc[.!]?')


def direct_intent(prompt: str):
    # Full matches only. Never drop trailing conditions, instructions or actions.
    text = normalize_command(prompt).lower()
    if text in EXAMPLES:
        return INTENT_ADAPTER.validate_python({'action':'explain','params':{'topic':EXAMPLES[text]}})
    reads = {
        'check my balance': 'check_balance', 'check my balance?': 'check_balance',
        'balance': 'check_balance', 'gas': 'gas_check',
        "what's the gas price?": 'gas_check', "what's gas right now?": 'gas_check',
        'check gas': 'gas_check', 'gas price': 'gas_check',
        "what's the gas price": 'gas_check', "what's gas right now": 'gas_check',
        'show my balance':'check_balance', 'my balance':'check_balance', 'how much mon do i have':'check_balance',
        'check my mon balance':'check_balance', 'show my mon balance':'check_balance',
        'check my usdc balance':'check_usdc_balance', 'show my usdc balance':'check_usdc_balance', 'how much usdc do i have':'check_usdc_balance',
    }
    if text in reads:
        return INTENT_ADAPTER.validate_python({'action': reads[text], 'params': {}})
    workflow = re.fullmatch(WORKFLOW_PATTERN, text)
    if workflow:
        try:
            return INTENT_ADAPTER.validate_python({'action': 'balance_then_swap', 'params': {
                'token_in': 'MON', 'token_out': 'USDC', 'amount': workflow[2], 'min_balance_mon': workflow[1]}})
        except ValidationError:
            return None
    transfer = transfer_fields(prompt)
    if transfer:
        try:
            return INTENT_ADAPTER.validate_python({'action': 'transfer', 'params': transfer})
        except ValidationError:
            return None
    match = re.fullmatch(
        r'swap ([0-9]+(?:\.[0-9]+)?) mon to usdc'
        r'(?: only if gas is below ([0-9]+(?:\.[0-9]+)?) gwei)?', text)
    if match:
        try:
            return INTENT_ADAPTER.validate_python({'action': 'swap', 'params': {
                'token_in': 'MON', 'token_out': 'USDC', 'amount': match[1],
                'max_gas_price_gwei': match[2]}})
        except ValidationError:
            return None
    return None


def resolve_intent(prompt, provider, provider_name):
    intent = direct_intent(prompt)
    if intent is not None:
        return intent, 'command'
    return provider.extract(prompt), provider_name
