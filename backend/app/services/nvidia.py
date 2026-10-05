import json
import logging

import httpx

from app.errors import ServiceError
from app.schemas import INTENT_ADAPTER
from app.services.gemini import GeminiService, POLICY

logger = logging.getLogger(__name__)


class NvidiaService:
    """Server-only NVIDIA hosted inference. Model output never executes directly."""
    def __init__(self, settings, client=None):
        self.settings = settings
        self.client = client or httpx.Client(timeout=settings.nvidia_timeout_seconds)

    def extract(self, prompt):
        key = self.settings.nvidia_api_key.get_secret_value()
        if not key:
            raise ServiceError('ai_not_configured', 'Set NVIDIA_API_KEY in backend/.env, then restart the backend. Balance and gas commands still work.')
        try:
            response = self.client.post(
                'https://integrate.api.nvidia.com/v1/chat/completions',
                headers={'Authorization': f'Bearer {key}'},
                json={'model': self.settings.nvidia_model, 'stream': False,
                      'temperature': 1, 'top_p': 0.95, 'max_tokens': 1024,
                      'chat_template_kwargs': {'enable_thinking': False},
                      'messages': [
                          {'role': 'system', 'content': POLICY + '\nReturn only JSON, without Markdown. JSON schema: ' + json.dumps(INTENT_ADAPTER.json_schema())},
                          {'role': 'user', 'content': prompt}]},
            )
            if response.status_code in (401, 403):
                raise ServiceError('ai_auth_failed', 'NVIDIA rejected the API key or model access. Update NVIDIA_API_KEY in backend/.env and restart the backend.')
            if response.status_code == 429:
                raise ServiceError('ai_rate_limited', 'NVIDIA quota or rate limit reached. Retry later; balance and gas commands still work.')
            if not response.is_success:
                logger.warning('nvidia request failed status=%s', response.status_code)
                raise ServiceError('ai_unavailable', 'NVIDIA is unavailable. Check NVIDIA_MODEL and model access, or retry later.')
            body = response.json()
            choice = body['choices'][0]
            if choice.get('finish_reason') != 'stop':
                raise ValueError('Incomplete response')
            content = choice['message']['content']
        except httpx.TimeoutException:
            raise ServiceError('ai_timeout', 'NVIDIA timed out. Retry, or use Check my balance / Check gas.', 504) from None
        except httpx.RequestError:
            raise ServiceError('ai_unavailable', 'Cannot reach NVIDIA. Check the backend internet connection; balance and gas commands still work.') from None
        except (ValueError, KeyError, IndexError, TypeError):
            raise ServiceError('invalid_ai_response', 'NVIDIA returned an incomplete or invalid intent. No action was taken.', 502) from None
        return GeminiService.validate(content)

    def close(self):
        self.client.close()
