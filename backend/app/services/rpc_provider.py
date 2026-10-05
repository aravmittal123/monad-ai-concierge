"""One bounded retry for transient failures of read-only JSON-RPC methods."""
import time
import requests
from web3 import Web3

READ_METHODS = frozenset({'eth_chainId', 'eth_blockNumber', 'eth_getBlockByNumber',
    'eth_getBalance', 'eth_gasPrice', 'eth_call', 'eth_estimateGas', 'eth_getCode',
    'eth_getTransactionCount', 'eth_getTransactionReceipt'})


class ResilientHTTPProvider(Web3.HTTPProvider):
    def make_request(self, method, params):
        for attempt in range(2):
            try:
                result = super().make_request(method, params)
                transient = result.get('error', {}).get('code') in (-32005, -32016, -32603)
                if transient and method in READ_METHODS and attempt == 0:
                    time.sleep(0.25)
                    continue
                return result
            except (requests.Timeout, requests.ConnectionError, requests.HTTPError) as exc:
                status = getattr(getattr(exc, 'response', None), 'status_code', None)
                if method not in READ_METHODS or attempt or (status is not None and status not in (429, 502, 503, 504)):
                    raise
                time.sleep(0.25)
