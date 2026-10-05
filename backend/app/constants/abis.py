def function(name, inputs, outputs, state='view'):
    return {'type': 'function', 'name': name, 'stateMutability': state,
            'inputs': [{'name': n, 'type': t} for n, t in inputs],
            'outputs': [{'name': n, 'type': t} for n, t in outputs]}

FACTORY_ABI = [function('getPool', [('tokenA','address'),('tokenB','address'),('fee','uint24')], [('', 'address')])]
TOKEN_ABI = [function('decimals', [], [('', 'uint8')]),
    function('balanceOf', [('account', 'address')], [('', 'uint256')]),
    function('transfer', [('to', 'address'), ('amount', 'uint256')], [('', 'bool')], 'nonpayable')]
QUOTE_ABI = [{'type':'function','name':'quoteExactInputSingle','stateMutability':'nonpayable',
    'inputs':[{'name':'params','type':'tuple','components':[
        {'name':'tokenIn','type':'address'},{'name':'tokenOut','type':'address'},
        {'name':'amountIn','type':'uint256'},{'name':'fee','type':'uint24'},
        {'name':'sqrtPriceLimitX96','type':'uint160'}]}],
    'outputs':[{'name':'amountOut','type':'uint256'},{'name':'sqrtPriceX96After','type':'uint160'},
               {'name':'initializedTicksCrossed','type':'uint32'},{'name':'gasEstimate','type':'uint256'}]}]
ROUTER_ABI = [{'type':'function','name':'exactInputSingle','stateMutability':'payable',
    'inputs':[{'name':'params','type':'tuple','components':[
        {'name':'tokenIn','type':'address'},{'name':'tokenOut','type':'address'},
        {'name':'fee','type':'uint24'},{'name':'recipient','type':'address'},
        {'name':'amountIn','type':'uint256'},{'name':'amountOutMinimum','type':'uint256'},
        {'name':'sqrtPriceLimitX96','type':'uint160'}]}], 'outputs':[{'name':'amountOut','type':'uint256'}]},
    function('WETH9', [], [('', 'address')]),
    {'type':'function','name':'multicall','stateMutability':'payable',
     'inputs':[{'name':'deadline','type':'uint256'},{'name':'data','type':'bytes[]'}],
     'outputs':[{'name':'results','type':'bytes[]'}]}]
