"""Recipient resolution and real testnet calls. Never submits a transaction."""
from decimal import Decimal, localcontext

from pydantic import ValidationError
from web3 import Web3

from app.constants.abis import TOKEN_ABI
from app.constants.tokens import TOKEN_REGISTRY
from app.errors import ServiceError
from app.schemas import Contact
from app.services.monad import units
from app.services.activity import registry_contract


def resolve_recipient(value, contacts):
    if value.startswith('0x'):
        try:
            return Contact(name='Recipient', address=value).address, None
        except ValidationError:
            raise ServiceError('invalid_recipient', 'Enter a complete, checksummed recipient address. The zero address is not allowed.', 400) from None
    matches = [c for c in contacts if c.name.strip().lower() == value.strip().lower()]
    if len(matches) != 1:
        raise ServiceError('contact_missing', f'Save a contact named {value[:32]} with their wallet address first. I will never guess a family member’s address.', 400)
    return matches[0].address, matches[0].name


def transfer_call(settings, monad, sender, recipient, token, amount, gas_limit, snapshot, activity_id=None):
    if sender.lower() == recipient.lower():
        raise ServiceError('self_transfer', 'This is your own account. Choose the recipient’s address.', 400)
    with localcontext() as ctx:
        ctx.prec = 100
        quantity = Decimal(amount)
        cap = Decimal(settings.max_transfer_mon if token == 'MON' else settings.max_transfer_usdc)
        if quantity <= 0 or quantity > cap:
            raise ServiceError('amount_limit', f'Testnet transfers must be above zero and at most {cap} {token}.', 400)
        decimals = TOKEN_REGISTRY[token]['decimals']
        scaled = quantity * 10**decimals
        if scaled != scaled.to_integral_value():
            raise ServiceError('token_precision', f'{token} supports at most {decimals} decimal places.', 400)
        amount_units = int(scaled)
    if gas_limit and Decimal(snapshot['gas_price_gwei']) >= Decimal(gas_limit):
        raise ServiceError('gas_limit_exceeded', 'Current gas is at or above your limit. Nothing was signed or sent.', 409)
    w3 = monad.w3
    try:
        if token == 'MON':
            if int(snapshot['balance_wei']) < amount_units:
                raise ServiceError('insufficient_balance', f"You have {snapshot['balance_mon']} MON but need {amount} MON, plus any unsponsored wallet fee. Get testnet MON from the faucet.", 409)
            tx = {'to': recipient, 'value': str(amount_units), 'data': '0x'}
            registry = registry_contract(settings, w3)
            if registry is not None:
                if not activity_id:
                    raise ServiceError('preview_changed', 'Prepare a new transfer for the configured activity registry.', 409)
                tx = {'to': registry.address, 'value': str(amount_units), 'data': registry.encode_abi('sendMON', args=[recipient, bytes.fromhex(activity_id.removeprefix('0x'))])}
        else:
            address = Web3.to_checksum_address(TOKEN_REGISTRY['USDC']['address'])
            if not w3.eth.get_code(address):
                raise ServiceError('token_unavailable', 'The registered testnet USDC contract has no code. No transfer can proceed.')
            contract = w3.eth.contract(address=address, abi=TOKEN_ABI)
            if contract.functions.decimals().call() != 6:
                raise ServiceError('token_mismatch', 'Testnet USDC decimals differ from the verified registry.')
            balance = contract.functions.balanceOf(sender).call()
            if balance < amount_units:
                raise ServiceError('insufficient_balance', f'You have {units(balance, 6)} USDC but need {amount} USDC. Get testnet USDC from the Circle faucet.', 409)
            tx = {'to': address, 'value': '0', 'data': contract.encode_abi('transfer', args=[recipient, amount_units])}
        call = {**tx, 'value': int(tx['value']), 'from': sender}
        result = w3.eth.call(call)
        if token == 'USDC' and int.from_bytes(result, 'big') != 1:
            raise ServiceError('simulation_failed', 'USDC did not confirm a successful transfer simulation.', 409)
        gas = w3.eth.estimate_gas(call)
        return tx, units(gas * int(snapshot['gas_price_wei']), 18)
    except ServiceError:
        raise
    except Exception:
        raise ServiceError('simulation_failed', 'The transfer could not be simulated. Check the recipient, balance and RPC connection. Nothing was sent.', 409) from None
