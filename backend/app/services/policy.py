"""Fail closed on transaction conditions the model might omit or alter."""
import re
from decimal import Decimal

from app.errors import ServiceError
from app.services.intents import WORKFLOW_PATTERN, normalize_command, transfer_fields


def validate_prompt_policy(prompt, intent):
    if intent is None:
        raise ServiceError('unsupported_action', 'The request could not be interpreted safely. Nothing was prepared.', 400)
    text = normalize_command(prompt).lower()
    if re.search(r'\b(ignore|override|bypass)\b.{0,40}\b(policy|instructions|rules|safety|confirmation)\b', text):
        raise ServiceError('unsupported_action', 'Arbitrary addresses and policy overrides are not supported.', 400)
    if intent.action != 'transfer' and re.search(r'0x[0-9a-f]{40}', text):
        raise ServiceError('unsupported_action', 'Use a transfer to send to an address. Swap recipients cannot be supplied.', 400)
    if intent.action == 'balance_then_swap':
        match = re.fullmatch(WORKFLOW_PATTERN, text.strip())
        if not match or Decimal(match[1]) != Decimal(intent.params.min_balance_mon) or Decimal(match[2]) != Decimal(intent.params.amount):
            raise ServiceError('unsupported_condition', 'Use: Check my balance, and if I have more than 5 MON, swap 2 to USDC. Nothing was prepared.', 400)
        return
    if intent.action == 'transfer':
        fields = transfer_fields(prompt)
        if not fields or fields['token'] != intent.params.token or Decimal(fields['amount']) != Decimal(intent.params.amount) or fields['recipient'].lower() != intent.params.recipient.lower():
            raise ServiceError('unsupported_action', 'Use: Send 1 MON to Father, or Send 1 USDC to a full wallet address. Review the recipient before approving.', 400)
        selected = intent.params.max_gas_price_gwei
        if bool(fields['max_gas_price_gwei']) != bool(selected) or (selected and Decimal(fields['max_gas_price_gwei']) != Decimal(selected)):
            raise ServiceError('unsupported_condition', 'The transfer gas condition changed. Nothing was prepared.', 400)
        return
    if intent.action != 'swap':
        return
    conditional = re.search(r'\b(if|unless|when|below|above|under|limit|provided)\b', text)
    if conditional:
        match = re.search(r'(?:below|under|less than)\s+([0-9]+(?:\.[0-9]+)?)\s*gwei\b', text)
        selected = intent.params.max_gas_price_gwei
        if not match or not selected or Decimal(match.group(1)) != Decimal(selected):
            raise ServiceError('unsupported_condition', 'Use an explicit gas rule, such as: only if gas is below 150 gwei. Other conditions are not supported.', 400)
        if re.search(r'\b(unless|above|price|tomorrow|balance|profit|and|or)\b', text):
            raise ServiceError('unsupported_condition', 'Only one gas-below condition is supported. Nothing was prepared.', 400)
