"""Explicit, owner-run testnet deployment. No deployment occurs without --deploy."""
import argparse
import json
from pathlib import Path

from eth_account import Account
from pydantic import SecretStr
from app.config import Settings


class DeploymentSettings(Settings):
    deployer_private_key: SecretStr = SecretStr('')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--deploy', action='store_true', help='Sign and broadcast a Monad Testnet contract deployment')
    args = parser.parse_args()
    from web3 import Web3
    settings = DeploymentSettings()
    key = settings.deployer_private_key.get_secret_value()
    if not key:
        raise SystemExit('Save a funded TESTNET-ONLY DEPLOYER_PRIVATE_KEY in backend/.env. Never paste it into chat.')
    w3 = Web3(Web3.HTTPProvider(str(settings.monad_rpc_url), request_kwargs={'timeout': 20}))
    if w3.eth.chain_id != 10143:
        raise SystemExit('Refusing deployment: RPC must be Monad Testnet (10143).')
    account = Account.from_key(key)
    artifact = json.loads((Path(__file__).parent / 'app/constants/activity_registry.json').read_text())
    contract = w3.eth.contract(abi=artifact['abi'], bytecode=artifact['bytecode'])
    tx = contract.constructor().build_transaction({'from': account.address, 'chainId': 10143,
        'nonce': w3.eth.get_transaction_count(account.address, 'pending'), 'gasPrice': w3.eth.gas_price})
    cost = tx['gas'] * tx['gasPrice']
    print('Deployer:', account.address)
    print('Estimated deployment fee (MON):', Web3.from_wei(cost, 'ether'))
    if w3.eth.get_balance(account.address) < cost:
        raise SystemExit('Insufficient testnet MON for deployment. Fund this deployer with the faucet.')
    if not args.deploy:
        print('Dry run only. Review the fee, then run with --deploy to broadcast.');return
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    print('Submitted deployment hash:', tx_hash.to_0x_hex())
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
    if receipt.status != 1 or not receipt.contractAddress:
        raise SystemExit('Deployment failed. Do not configure the registry.')
    if bytes(w3.eth.get_code(receipt.contractAddress)) != bytes.fromhex(artifact['runtime'][2:]):
        raise SystemExit('Runtime bytecode mismatch. Do not configure the registry.')
    print('Verified ACTIVITY_REGISTRY_ADDRESS=' + receipt.contractAddress)
    print('Save that address in backend/.env and production environment, then restart/redeploy. No private key is needed by the running app.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Provider exceptions may contain credential-bearing URLs.
        raise SystemExit('Deployment stopped (' + type(error).__name__ + '). Check connectivity and the printed transaction hash before retrying.') from None
