from types import MappingProxyType

# Official Circle and Monad registry, verified 2026-10-01.
# https://developers.circle.com/stablecoins/usdc-contract-addresses
# https://github.com/monad-crypto/token-list/blob/main/tokenlist-testnet.json
TOKEN_REGISTRY = MappingProxyType({
    'MON': MappingProxyType({'native': True, 'decimals': 18, 'address': None}),
    'USDC': MappingProxyType({'native': False, 'decimals': 6, 'address': '0x534b2f3A21130d7a60830c2Df862319e593943A3'}),
})
WMON = '0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541'
# Official Uniswap feed. Empty on-chain code is checked before every real quote.
# https://developers.uniswap.org/deployments.json (chainId=10143)
DEX = MappingProxyType({
    'factory': '0x961235a9020B05C44DF1026D956D1F4D78014276',
    'quoter': '0x1b4E313fEF15630AF3e6F2dE550Dbf4cC9D3081d',
    'router': '0x4c4eABd5Fb1D1A7234A48692551eAECFF8194CA7',
})
