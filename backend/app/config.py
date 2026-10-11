from pathlib import Path

from typing import Literal
from pydantic import Field, HttpUrl, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / '.env', extra='ignore'
    )
    monad_rpc_url: HttpUrl = 'https://testnet-rpc.monad.xyz'
    monad_chain_id: int = Field(default=10143, gt=0)
    monad_explorer_url: HttpUrl = 'https://testnet.monadscan.com'
    gemini_api_key: SecretStr = SecretStr('')
    gemini_model: str = 'gemini-3.1-flash-lite'
    ai_provider: Literal['gemini', 'nvidia'] = 'gemini'
    nvidia_api_key: SecretStr = SecretStr('')
    nvidia_model: str = 'nvidia/nemotron-3-super-120b-a12b'
    nvidia_timeout_seconds: float = Field(default=20, gt=0, le=30)
    rpc_timeout_seconds: float = Field(default=8, gt=0, le=30)
    gemini_timeout_seconds: float = Field(default=20, gt=0, le=60)
    swap_mode: Literal['mock', 'uniswap_v3', 'puddleswap_v2'] = 'mock'
    preview_secret: SecretStr = SecretStr('')
    api_access_token: SecretStr = SecretStr('')
    require_api_token: bool = False
    preview_ttl_seconds: int = Field(default=180, ge=30, le=300)
    max_swap_mon: str = '10'
    activity_registry_address: str = ''
    rate_limit_per_minute: int = Field(default=20, ge=1, le=120)
