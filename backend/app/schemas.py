from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, field_validator, model_validator
from web3 import Web3

from app.constants.tokens import TOKEN_REGISTRY


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)


class Contact(StrictModel):
    name: str = Field(pattern=r"^[A-Za-z][A-Za-z0-9 '\-]{0,31}$")
    address: str = Field(pattern=r'^0x[0-9a-fA-F]{40}$')

    @field_validator('address')
    @classmethod
    def valid_address(cls, value):
        if int(value, 16) == 0:
            raise ValueError('Zero address is not a recipient')
        if value[2:] != value[2:].lower() and value[2:] != value[2:].upper() and not Web3.is_checksum_address(value):
            raise ValueError('Invalid address checksum')
        return Web3.to_checksum_address(value)


class ChatRequest(StrictModel):
    prompt: str = Field(min_length=1, max_length=2000)
    wallet_address: str = Field(pattern=r'^0x[0-9a-fA-F]{40}$')
    contacts: list[Contact] = Field(default_factory=list, max_length=30)

    @model_validator(mode='after')
    def unique_contacts(self):
        names = [contact.name.strip().lower() for contact in self.contacts]
        if len(set(names)) != len(names):
            raise ValueError('Contact names must be unique')
        return self

    @field_validator('prompt')
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError('Prompt must not be blank')
        return value.strip()

    @field_validator('wallet_address')
    @classmethod
    def wallet(cls, value):
        body = value[2:]
        if not (body.islower() or body.isupper() or body.isdigit()) and not Web3.is_checksum_address(value):
            raise ValueError('Mixed-case wallet address has invalid checksum')
        return Web3.to_checksum_address(value)


class EmptyParams(StrictModel):
    pass


class SwapParams(StrictModel):
    token_in: Literal['MON']
    token_out: Literal['USDC']
    amount: str = Field(pattern=r'^(0|[1-9][0-9]{0,19})(\.[0-9]{1,18})?$')
    max_gas_price_gwei: str | None = Field(default=None, pattern=r'^(0|[1-9][0-9]{0,11})(\.[0-9]{1,9})?$')
    min_balance_mon: str | None = Field(default=None, pattern=r'^(0|[1-9][0-9]{0,19})(\.[0-9]{1,18})?$')

    @field_validator('token_in', 'token_out')
    @classmethod
    def registered_token(cls, value):
        if value not in TOKEN_REGISTRY:
            raise ValueError('Unsupported token')
        return value

    @field_validator('amount', 'max_gas_price_gwei', 'min_balance_mon')
    @classmethod
    def positive(cls, value):
        if value is not None and Decimal(value) <= 0:
            raise ValueError('Value must be positive')
        return value


class CheckBalanceIntent(StrictModel):
    action: Literal['check_balance']
    params: EmptyParams


class GasCheckIntent(StrictModel):
    action: Literal['gas_check']
    params: EmptyParams


class SwapIntent(StrictModel):
    action: Literal['swap']
    params: SwapParams


class TransferParams(StrictModel):
    token: Literal['MON', 'USDC']
    amount: str = Field(pattern=r'^(0|[1-9][0-9]{0,19})(\.[0-9]{1,18})?$')
    recipient: str = Field(min_length=1, max_length=64)
    max_gas_price_gwei: str | None = Field(default=None, pattern=r'^(0|[1-9][0-9]{0,11})(\.[0-9]{1,9})?$')

    @field_validator('amount', 'max_gas_price_gwei')
    @classmethod
    def positive(cls, value):
        if value is not None and Decimal(value) <= 0:
            raise ValueError('Value must be positive')
        return value


class TransferIntent(StrictModel):
    action: Literal['transfer']
    params: TransferParams


class BalanceSwapIntent(StrictModel):
    action: Literal['balance_then_swap']
    params: SwapParams

    @model_validator(mode='after')
    def needs_threshold(self):
        if self.params.min_balance_mon is None:
            raise ValueError('Balance threshold required')
        return self


class UnsupportedIntent(StrictModel):
    action: Literal['unsupported_action']
    params: EmptyParams


class ExplainParams(StrictModel):
    topic: Literal['capabilities', 'gas', 'passkeys', 'fees', 'testnet', 'transfers', 'usdc', 'safety', 'pending', 'sponsorship', 'reputation', 'install', 'contacts', 'swaps']


class ExplainIntent(StrictModel):
    action: Literal['explain']
    params: ExplainParams


class TokenBalanceIntent(StrictModel):
    action: Literal['check_usdc_balance']
    params: EmptyParams


Intent = Annotated[CheckBalanceIntent | GasCheckIntent | SwapIntent | TransferIntent | BalanceSwapIntent | ExplainIntent | TokenBalanceIntent | UnsupportedIntent, Field(discriminator='action')]
INTENT_ADAPTER = TypeAdapter(Intent)


class ActionPlan(StrictModel):
    intent: SwapIntent | TransferIntent
    wallet_address: str
    chain_id: int
    requires_confirmation: Literal[True] = True
    executable: Literal[False] = False
    status: Literal['intent_only'] = 'intent_only'
    reason: str = 'Intent only. Request a fresh preview, review its safeguards and explicitly confirm with your passkey.'


class PrepareRequest(ChatRequest):
    prompt: str = 'prepare'
    intent: SwapIntent | TransferIntent
    slippage_bps: int = Field(default=50, ge=1, le=300)


class RevalidateRequest(StrictModel):
    preview_token: str = Field(min_length=10, max_length=12000)
    wallet_address: str = Field(pattern=r'^0x[0-9a-fA-F]{40}$')


class TransactionPreview(StrictModel):
    preview_id: str
    wallet_address: str
    chain_id: int
    mode: Literal['mock', 'uniswap_v3', 'puddleswap_v2', 'transfer']
    action: Literal['swap', 'transfer'] = 'swap'
    token: Literal['MON', 'USDC'] = 'MON'
    amount: str | None = None
    recipient: str | None = None
    recipient_name: str | None = None
    min_balance_mon: str | None = None
    activity_id: str | None = None
    amount_mon: str
    estimated_usdc: str
    minimum_usdc: str
    slippage_bps: int
    gas_price_gwei: str
    estimated_call_gas_mon: str | None
    max_gas_price_gwei: str | None
    expires_at: int
    simulation: Literal['rpc_call_passed', 'mock_only']
    transaction: dict | None
    warnings: list[str]
    requires_confirmation: Literal[True] = True
