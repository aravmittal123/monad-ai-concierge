from types import SimpleNamespace
from unittest.mock import Mock, patch
import pytest
from app.services import puddleswap as dex
from app.constants.tokens import TOKEN_REGISTRY
from app.schemas import PrepareRequest
from app.errors import ServiceError

WALLET='0x'+'1'*40
PAIR='0x'+'2'*40
USDC=TOKEN_REGISTRY['USDC']['address']

def fixture():
    node=Mock();contracts={a:Mock() for a in [dex.ROUTER,dex.FACTORY,dex.WRAPPED,USDC,PAIR]}
    node.w3.eth.get_code.return_value=b'code'
    node.w3.eth.contract.side_effect=lambda address,abi: contracts[address]
    router=contracts[dex.ROUTER]
    router.functions.WETH.return_value.call.return_value=dex.WRAPPED
    router.functions.factory.return_value.call.return_value=dex.FACTORY
    router.functions.getAmountsOut.return_value.call.return_value=[10**18,4_000_000]
    router.encode_abi.return_value='0x1234'
    contracts[USDC].functions.decimals.return_value.call.return_value=6
    contracts[dex.FACTORY].functions.getPair.return_value.call.return_value=PAIR
    pair=contracts[PAIR];pair.functions.token0.return_value.call.return_value=dex.WRAPPED
    pair.functions.token1.return_value.call.return_value=USDC
    pair.functions.getReserves.return_value.call.return_value=[1000*10**18,4000*10**6,1]
    node.w3.eth.estimate_gas.return_value=100000
    body=PrepareRequest(wallet_address=WALLET,intent={'action':'swap','params':{'token_in':'MON','token_out':'USDC','amount':'1'}})
    snapshot={'chain_id':10143,'balance_wei':str(10*10**18),'gas_price_wei':'102000000000'}
    return node,contracts,body,snapshot

@pytest.fixture(autouse=True)
def pin_test_bytecode(monkeypatch):
    monkeypatch.setattr(dex,'HASHES',{a:dex.Web3.keccak(b'code').to_0x_hex() for a in dex.HASHES})

def test_live_route_binds_output_recipient_path_deadline_value():
    node,c,b,s=fixture();out,minimum,tx,gas=dex.build_swap(node,b,s,123456)
    assert out==4_000_000 and minimum==3_980_000
    assert tx=={'to':dex.ROUTER,'data':'0x1234','value':str(10**18)}
    c[dex.ROUTER].encode_abi.assert_called_once_with('swapExactETHForTokens',args=[minimum,[dex.WRAPPED,USDC],WALLET,123456])
    node.w3.eth.call.assert_called_once_with({'to':dex.ROUTER,'data':'0x1234','value':10**18,'from':WALLET})

@pytest.mark.parametrize('failure,code', [('bytecode','dex_unavailable'),('identity','token_mismatch'),('pair','no_liquidity'),('tokens','token_mismatch'),('empty','no_liquidity'),('impact','price_impact'),('revert','simulation_failed'),('fees','insufficient_balance')])
def test_route_fails_closed(failure,code):
    node,c,b,s=fixture()
    if failure=='bytecode': node.w3.eth.get_code.return_value=b'changed'
    if failure=='identity': c[dex.ROUTER].functions.WETH.return_value.call.return_value=PAIR
    if failure=='pair': c[dex.FACTORY].functions.getPair.return_value.call.return_value='0x'+'0'*40
    if failure=='tokens': c[PAIR].functions.token1.return_value.call.return_value=dex.WRAPPED
    if failure=='empty': c[PAIR].functions.getReserves.return_value.call.return_value=[0,0,1]
    if failure=='impact': c[dex.ROUTER].functions.getAmountsOut.return_value.call.return_value=[10**18,2_000_000]
    if failure=='revert': node.w3.eth.call.side_effect=RuntimeError('private provider details')
    if failure=='fees': s['balance_wei']=str(10**18)
    with pytest.raises(ServiceError) as err:dex.build_swap(node,b,s,123456)
    assert err.value.code==code
