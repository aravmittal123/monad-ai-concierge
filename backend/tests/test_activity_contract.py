import json
from pathlib import Path

import pytest
from eth_tester import EthereumTester, PyEVMBackend
from eth_tester.exceptions import TransactionFailed
from web3 import Web3, EthereumTesterProvider

from app.config import Settings
from app.services.activity import registry_contract
from app.errors import ServiceError


@pytest.fixture
def deployed():
    w3=Web3(EthereumTesterProvider(EthereumTester(PyEVMBackend())))
    artifact=json.loads((Path(__file__).resolve().parents[1]/'app/constants/activity_registry.json').read_text())
    sender,recipient=w3.eth.accounts[:2]
    factory=w3.eth.contract(abi=artifact['abi'],bytecode=artifact['bytecode'])
    receipt=w3.eth.wait_for_transaction_receipt(factory.constructor().transact({'from':sender}))
    contract=w3.eth.contract(address=receipt.contractAddress,abi=artifact['abi'])
    return w3,contract,sender,recipient


def test_real_payment_increments_only_senders_score(deployed):
    w3,c,sender,recipient=deployed
    before=w3.eth.get_balance(recipient)
    receipt=w3.eth.wait_for_transaction_receipt(c.functions.sendMON(recipient,bytes.fromhex('01'*32)).transact({'from':sender,'value':12345}))
    assert receipt.status==1 and w3.eth.get_balance(recipient)-before==12345
    assert c.functions.completedPayments(sender).call()==1
    assert c.functions.activityScore(sender).call()==1
    assert c.functions.completedPayments(recipient).call()==0
    assert w3.eth.get_balance(c.address)==0
    assert len(c.events.PaymentCompleted().process_receipt(receipt))==1


def test_failed_payment_leaves_score_and_intent_unused(deployed):
    w3,c,sender,_=deployed
    intent=bytes.fromhex('02'*32)
    with pytest.raises(TransactionFailed):
        c.functions.sendMON(c.address,intent).transact({'from':sender,'value':100})
    assert c.functions.completedPayments(sender).call()==0
    assert c.functions.usedIntents(sender,intent).call() is False


def test_replayed_intent_cannot_send_twice(deployed):
    _,c,sender,recipient=deployed
    intent=bytes.fromhex('03'*32)
    c.functions.sendMON(recipient,intent).transact({'from':sender,'value':100})
    with pytest.raises(TransactionFailed):
        c.functions.sendMON(recipient,intent).transact({'from':sender,'value':100})
    assert c.functions.completedPayments(sender).call()==1


@pytest.mark.parametrize('value',[0,10**19+1])
def test_contract_amount_bounds(deployed,value):
    _,c,sender,recipient=deployed
    with pytest.raises(TransactionFailed):
        c.functions.sendMON(recipient,bytes.fromhex('04'*32)).transact({'from':sender,'value':value})


def test_registry_code_must_match_compiled_artifact(deployed):
    w3,c,sender,_=deployed
    settings=Settings(_env_file=None,activity_registry_address=c.address)
    assert registry_contract(settings,w3).address==c.address
    settings.activity_registry_address=sender
    with pytest.raises(ServiceError,match='registry_mismatch'):
        registry_contract(settings,w3)


def test_ordinary_simulation_does_not_increment_score(deployed):
    _,c,sender,recipient=deployed
    c.functions.sendMON(recipient,bytes.fromhex('05'*32)).call({'from':sender,'value':100})
    assert c.functions.completedPayments(sender).call()==0
