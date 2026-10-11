"""Exact-input MON -> Circle testnet USDC on the pinned PuddleSwap V2 route.

Deployment source: https://github.com/portdeveloper/puddleswap
Runtime hashes observed on chain 10143 on 2026-10-11. This is not an audit.
No signing, token approvals, arbitrary destinations, or fallback demo quotes.
"""
from decimal import Decimal, localcontext
from web3 import Web3
from app.constants.abis import function, TOKEN_ABI
from app.constants.tokens import TOKEN_REGISTRY
from app.errors import ServiceError
from app.services.monad import units

ROUTER = '0x430c23895c8D44883526e3E0B09327dAD8766660'
FACTORY = '0xd498f5beBD0C9f1FE0135a0Cf942dA67Ee6e8A9B'
WRAPPED = '0x97B3070F9Da6C002343862b35E68Bd8e22608943'
HASHES = {
    ROUTER: '0x74f97f3b62d2720252faac4a7d6c2ae019ba7465dc31dce5aef363899b1b519a',
    FACTORY: '0x987ff64634105e6333513fa78341029e2dcd01ede848ae64df45f30d49da7252',
    WRAPPED: '0xd01dbf0282935fc9bd08de79ab807b8efa55a2f7c6921f88c05897dd262d4038',
}
ROUTER_ABI = [function('WETH', [], [('', 'address')]), function('factory', [], [('', 'address')]),
    function('getAmountsOut', [('amountIn','uint256'),('path','address[]')], [('', 'uint256[]')]),
    function('swapExactETHForTokens', [('amountOutMin','uint256'),('path','address[]'),('to','address'),('deadline','uint256')], [('', 'uint256[]')], 'payable')]
FACTORY_ABI = [function('getPair', [('a','address'),('b','address')], [('', 'address')])]
PAIR_ABI = [function('token0', [], [('', 'address')]), function('token1', [], [('', 'address')]),
    function('getReserves', [], [('reserve0','uint112'),('reserve1','uint112'),('timestamp','uint32')])]


def build_swap(monad, body, snapshot, expiry):
    w3 = monad.w3
    try:
        if snapshot['chain_id'] != 10143:
            raise ServiceError('wrong_chain', 'Swaps require Monad Testnet.', 400)
        for address, expected in HASHES.items():
            if Web3.keccak(w3.eth.get_code(address)).to_0x_hex() != expected:
                raise ServiceError('dex_unavailable', 'The configured swap contract is missing or changed. No swap was prepared.', 503)
        usdc = Web3.to_checksum_address(TOKEN_REGISTRY['USDC']['address'])
        if not w3.eth.get_code(usdc):
            raise ServiceError('token_unavailable', 'Testnet USDC is unavailable.', 503)
        token = w3.eth.contract(address=usdc, abi=TOKEN_ABI)
        router = w3.eth.contract(address=ROUTER, abi=ROUTER_ABI)
        if router.functions.WETH().call().lower() != WRAPPED.lower() or router.functions.factory().call().lower() != FACTORY.lower() or token.functions.decimals().call() != 6:
            raise ServiceError('token_mismatch', 'Swap contract identities do not match this route.', 503)
        factory = w3.eth.contract(address=FACTORY, abi=FACTORY_ABI)
        pair_address = factory.functions.getPair(WRAPPED, usdc).call()
        if int(pair_address, 16) == 0 or not w3.eth.get_code(pair_address):
            raise ServiceError('no_liquidity', 'No MON/USDC pool is available.', 503)
        pair = w3.eth.contract(address=pair_address, abi=PAIR_ABI)
        first, second = pair.functions.token0().call(), pair.functions.token1().call()
        if {first.lower(), second.lower()} != {WRAPPED.lower(), usdc.lower()}:
            raise ServiceError('token_mismatch', 'Pool tokens do not match MON/USDC.', 503)
        r0, r1, _ = pair.functions.getReserves().call()
        rin, rout = (r0, r1) if first.lower() == WRAPPED.lower() else (r1, r0)
        if rin <= 0 or rout <= 0:
            raise ServiceError('no_liquidity', 'The MON/USDC pool has no liquidity.', 503)
        with localcontext() as ctx:
            ctx.prec = 100
            amount = int(Decimal(body.intent.params.amount) * 10**18)
        path = [WRAPPED, usdc]
        quoted = router.functions.getAmountsOut(amount, path).call()
        if len(quoted) != 2 or quoted[0] != amount or quoted[1] <= 0:
            raise ServiceError('no_liquidity', 'No valid MON/USDC quote is available.', 503)
        output = quoted[1]
        # Includes pool fee; reject a >3% loss relative to the current reserve ratio.
        if output * rin * 10000 < amount * rout * 9700:
            raise ServiceError('price_impact', 'This swap has more than 3% price impact including pool fees. Try a smaller amount.', 409)
        minimum = output * (10000 - body.slippage_bps) // 10000
        if minimum <= 0:
            raise ServiceError('amount_too_small', 'Amount is too small to protect the minimum USDC output.', 400)
        data = router.encode_abi('swapExactETHForTokens', args=[minimum, path, body.wallet_address, expiry])
        tx = {'from':body.wallet_address, 'to':ROUTER, 'value':amount, 'data':data}
        w3.eth.call(tx)
        gas = w3.eth.estimate_gas(tx)
        if int(snapshot['balance_wei']) < amount + gas * int(snapshot['gas_price_wei']):
            raise ServiceError('insufficient_balance', 'Not enough MON for this swap and its estimated call gas.', 409)
        return output, minimum, {'to':ROUTER, 'value':str(amount), 'data':data}, units(gas * int(snapshot['gas_price_wei']), 18)
    except ServiceError:
        raise
    except Exception:
        raise ServiceError('simulation_failed', 'The live swap quote or simulation failed. Retry with a fresh preview. Nothing was sent.', 409) from None
