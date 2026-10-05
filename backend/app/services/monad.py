import logging
import time
from threading import Lock
from decimal import Decimal, localcontext

from web3 import Web3

from app.config import Settings
from app.errors import ServiceError
from app.services.rpc_provider import ResilientHTTPProvider
from app.constants.abis import TOKEN_ABI
from app.constants.tokens import TOKEN_REGISTRY

logger = logging.getLogger(__name__)


def units(value: int, decimals: int) -> str:
    with localcontext() as ctx:
        ctx.prec = 100
        return format(Decimal(value) / Decimal(10) ** decimals, 'f')


class MonadService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._gas_cache = None
        self._gas_lock = Lock()
        self.w3 = Web3(ResilientHTTPProvider(
            str(settings.monad_rpc_url),
            request_kwargs={'timeout': settings.rpc_timeout_seconds},
            exception_retry_configuration=None,
        ))

    def gas(self):
        with self._gas_lock:
            now = time.monotonic()
            if self._gas_cache and now - self._gas_cache[0] < 4:
                return self._gas_cache[1]
            try:
                if self.w3.eth.chain_id != 10143:
                    raise ServiceError('wrong_chain', 'RPC is not Monad Testnet.')
                block = self.w3.eth.get_block('latest')
                price = self.w3.eth.gas_price
                data = {'chain_id': 10143, 'block_number': block['number'],
                    'gas_price_wei': str(price), 'gas_price_gwei': units(price, 9),
                    'observed_at': int(time.time())}
                self._gas_cache = (now, data)
                return data
            except ServiceError:
                raise
            except Exception:
                raise ServiceError('rpc_unavailable', 'Blockchain connection lost. Retrying automatically; you can also retry now.') from None

    def snapshot(self, wallet: str | None = None):
        try:
            chain_id = self.w3.eth.chain_id
            if chain_id != self.settings.monad_chain_id:
                raise ServiceError('wrong_chain', 'RPC chain ID does not match MONAD_CHAIN_ID.')
            block = self.w3.eth.get_block('latest')
            result = {'chain_id': chain_id, 'block_number': block['number']}
            if wallet is not None:
                balance = self.w3.eth.get_balance(wallet, block_identifier=block['number'])
                gas = self.w3.eth.gas_price
                result.update(balance_wei=str(balance), balance_mon=units(balance, 18),
                              gas_price_wei=str(gas), gas_price_gwei=units(gas, 9),
                              base_fee_per_gas_wei=str(block['baseFeePerGas']) if 'baseFeePerGas' in block else None)
            logger.info('rpc snapshot=ok chain_id=%s block=%s', chain_id, block['number'])
            return result
        except ServiceError:
            logger.warning('rpc snapshot=wrong_chain')
            raise
        except Exception:
            logger.warning('rpc snapshot=unavailable')
            raise ServiceError('rpc_unavailable', 'Monad RPC is unavailable. Please retry.') from None

    def usdc_balance(self, wallet, block_number):
        try:
            address = Web3.to_checksum_address(TOKEN_REGISTRY['USDC']['address'])
            if not self.w3.eth.get_code(address):
                raise ServiceError('token_unavailable', 'The registered testnet USDC contract is unavailable.')
            token = self.w3.eth.contract(address=address, abi=TOKEN_ABI)
            if token.functions.decimals().call() != 6:
                raise ServiceError('token_mismatch', 'USDC decimals do not match the registry.')
            return units(token.functions.balanceOf(wallet).call(block_identifier=block_number), 6)
        except ServiceError:
            raise
        except Exception:
            raise ServiceError('rpc_unavailable', 'USDC balance could not be read. Retry when the blockchain connection recovers.') from None
