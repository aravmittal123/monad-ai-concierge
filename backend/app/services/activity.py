import json
from pathlib import Path
from web3 import Web3
from app.errors import ServiceError


def registry_contract(settings, w3):
    address = settings.activity_registry_address
    if not address:
        return None
    try:
        artifact = json.loads((Path(__file__).resolve().parents[1] / 'constants/activity_registry.json').read_text())
        address = Web3.to_checksum_address(address)
        code = bytes(w3.eth.get_code(address))
        if code != bytes.fromhex(artifact['runtime'][2:]):
            raise ServiceError('registry_mismatch', 'Activity contract code differs from the compiled registry. Transfers through it are disabled.')
        return w3.eth.contract(address=address, abi=artifact['abi'])
    except ServiceError:
        raise
    except Exception:
        raise ServiceError('registry_unavailable', 'The activity registry could not be verified. Check its deployment and RPC.') from None


def activity_snapshot(settings, monad, address):
    try:
        if monad.w3.eth.chain_id != 10143:
            raise ServiceError('wrong_chain', 'Activity is only available on Monad Testnet.')
    except ServiceError:
        raise
    except Exception:
        raise ServiceError('rpc_unavailable', 'Cannot reach Monad to verify on-chain activity.') from None
    contract = registry_contract(settings, monad.w3)
    if contract is None:
        return {'configured': False, 'score': None, 'completed_payments': None}
    try:
        count = contract.functions.completedPayments(address).call()
        return {'configured': True, 'score': min(100, count), 'completed_payments': count,
            'contract': contract.address, 'meaning': 'Completed MON payments through this contract. Not a safety or credit rating; not ERC-8004.'}
    except Exception:
        raise ServiceError('registry_unavailable', 'Cannot read on-chain activity right now.') from None
