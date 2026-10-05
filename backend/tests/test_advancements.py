import json
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings
from app.errors import ServiceError
from app.main import create_app
from app.schemas import ChatRequest, PrepareRequest, RevalidateRequest, Contact
from app.services.intents import direct_intent
from app.services.policy import validate_prompt_policy
from app.services.transaction import TransactionService
from app.services.monad import MonadService
from app.services.transfers import resolve_recipient
from bot import command_reply

SENDER='0x'+'1'*40
RECIPIENT='0x'+'2'*40
SETTINGS=Settings(_env_file=None,gemini_api_key='',api_access_token='',preview_secret='test-secret',activity_registry_address='')
SNAPSHOT={'chain_id':10143,'block_number':100,'balance_mon':'10','balance_wei':str(10**19),'gas_price_gwei':'102','gas_price_wei':str(102*10**9)}


def rpc():
    node=Mock();node.snapshot.return_value=SNAPSHOT.copy();node.w3.eth.call.return_value=bytes.fromhex('00'*31+'01');node.w3.eth.estimate_gas.return_value=21000
    node.w3.eth.get_code.return_value=b'contract'
    token=node.w3.eth.contract.return_value
    token.functions.decimals.return_value.call.return_value=6
    token.functions.balanceOf.return_value.call.return_value=2000000
    token.encode_abi.return_value='0xabcdef'
    return node


def transfer(token='MON',amount='1',recipient='Father'):
    return PrepareRequest(wallet_address=SENDER,contacts=[Contact(name='Father',address=RECIPIENT)],
        intent={'action':'transfer','params':{'token':token,'amount':amount,'recipient':recipient}})


def test_contact_resolution_never_guesses_family_wallet():
    with pytest.raises(ServiceError,match='contact_missing'):
        resolve_recipient('Father',[])
    assert resolve_recipient('father',[Contact(name='Father',address=RECIPIENT)])==(RECIPIENT,'Father')


def test_duplicate_contacts_rejected():
    with pytest.raises(ValidationError):
        ChatRequest(prompt='test',wallet_address=SENDER,contacts=[{'name':'Father','address':RECIPIENT},{'name':'father','address':SENDER}])


@pytest.mark.parametrize('recipient',['0x'+'0'*40,'0x123','0x'+'Z'*40])
def test_invalid_recipient_rejected(recipient):
    with pytest.raises(ServiceError):
        resolve_recipient(recipient,[])


def test_native_transfer_has_actual_value_and_hmac_binds_recipient():
    service=TransactionService(SETTINGS,rpc());result=service.prepare(transfer())
    p=result['preview'];assert p['mode']=='transfer' and p['recipient']==RECIPIENT and p['amount']=='1'
    assert p['transaction']=={'to':RECIPIENT,'value':str(10**18),'data':'0x'}
    assert service.revalidate(RevalidateRequest(wallet_address=SENDER,preview_token=result['preview_token']))['preview']==p
    payload,digest=result['preview_token'].split('.')
    import base64
    altered=json.loads(base64.urlsafe_b64decode(payload+'='*(-len(payload)%4)));altered['recipient']=SENDER
    token=base64.urlsafe_b64encode(json.dumps(altered).encode()).decode().rstrip('=')+'.'+digest
    with pytest.raises(ServiceError,match='invalid_preview'):
        service.revalidate(RevalidateRequest(wallet_address=SENDER,preview_token=token))


def test_usdc_uses_exact_6_decimal_units_and_no_native_value():
    node=rpc();p=TransactionService(SETTINGS,node).prepare(transfer('USDC','1.234567'))['preview']
    assert p['token']=='USDC' and p['amount']=='1.234567' and p['transaction']['value']=='0'
    node.w3.eth.contract.return_value.encode_abi.assert_called_once_with('transfer',args=[RECIPIENT,1234567])


@pytest.mark.parametrize('token,amount,code',[('USDC','0.0000001','token_precision'),('MON','11','amount_limit'),('USDC','1001','amount_limit')])
def test_transfer_precision_and_limits(token,amount,code):
    with pytest.raises(ServiceError,match=code):
        TransactionService(SETTINGS,rpc()).prepare(transfer(token,amount))


def test_native_balance_error_gives_actual_amounts():
    node=rpc();node.snapshot.return_value={**SNAPSHOT,'balance_mon':'0.5','balance_wei':str(5*10**17)}
    with pytest.raises(ServiceError) as err:
        TransactionService(SETTINGS,node).prepare(transfer())
    assert err.value.code=='insufficient_balance' and '0.5 MON' in err.value.message and '1 MON' in err.value.message


def test_usdc_false_return_cannot_be_approved():
    node=rpc();node.w3.eth.call.return_value=bytes(32)
    with pytest.raises(ServiceError,match='simulation_failed'):
        TransactionService(SETTINGS,node).prepare(transfer('USDC'))


def test_recipient_revert_blocks_preparation():
    node=rpc();node.w3.eth.call.side_effect=RuntimeError('sensitive RPC URL')
    with pytest.raises(ServiceError,match='simulation_failed') as err:
        TransactionService(SETTINGS,node).prepare(transfer())
    assert 'sensitive' not in err.value.message


def test_transfer_balance_rechecked_before_submission():
    node=rpc();service=TransactionService(SETTINGS,node);p=service.prepare(transfer())
    node.snapshot.return_value={**SNAPSHOT,'balance_mon':'0','balance_wei':'0'}
    with pytest.raises(ServiceError,match='insufficient_balance'):
        service.revalidate(RevalidateRequest(wallet_address=SENDER,preview_token=p['preview_token']))


def test_workflow_requires_continue_and_binds_balance_condition():
    node=rpc();client=TestClient(create_app(SETTINGS,monad=node))
    text='Check my balance, and if I have more than 5 MON, swap 2 to USDC'
    response=client.post('/api/chat',json={'prompt':text,'wallet_address':SENDER}).json()
    assert response['needs_step_confirmation'] is True
    intent=response['plan']['intent'];assert intent['params']['min_balance_mon']=='5'
    service=TransactionService(SETTINGS,node)
    p=service.prepare(PrepareRequest(wallet_address=SENDER,intent=intent))
    node.snapshot.return_value={**SNAPSHOT,'balance_mon':'5','balance_wei':str(5*10**18)}
    with pytest.raises(ServiceError,match='balance_condition_failed'):
        service.revalidate(RevalidateRequest(wallet_address=SENDER,preview_token=p['preview_token']))


def test_workflow_equal_threshold_stops_before_plan():
    node=rpc();node.snapshot.return_value={**SNAPSHOT,'balance_mon':'5'}
    client=TestClient(create_app(SETTINGS,monad=node))
    data=client.post('/api/chat',json={'prompt':'Check my balance, and if I have more than 5 MON, swap 2 to USDC','wallet_address':SENDER}).json()
    assert data['type']=='information' and 'plan' not in data


@pytest.mark.parametrize('prompt',['Send 1 MON to Father and send 2 to Daughter','Send 1 MON to Father if price rises','Send 1 MON to Father unless gas falls'])
def test_transfer_cannot_drop_conditions(prompt):
    intent=direct_intent(prompt)
    with pytest.raises(ServiceError):
        validate_prompt_policy(prompt,intent)


def test_gas_widget_cached_but_never_uses_fake_values():
    service=MonadService(SETTINGS)
    node=Mock(chain_id=10143,gas_price=800000000);node.get_block.return_value={'number':42}
    service.w3=SimpleNamespace(eth=node)
    assert service.gas()['gas_price_gwei']=='0.8'
    assert service.gas()['block_number']==42
    node.get_block.assert_called_once()


def test_telegram_uses_live_reads_and_never_executes_transfers():
    call=Mock(return_value=SNAPSHOT)
    reply,wallet=command_reply('/balance',SENDER,call,'https://example.com')
    assert '10 MON' in reply
    call.reset_mock()
    reply,_=command_reply('/send 1 MON to Father',wallet,call,'https://example.com')
    assert '?intent=Send' in reply and 'No action has been sent' in reply
    call.assert_not_called()
