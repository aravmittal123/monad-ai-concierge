# Deployment and passkey setup

Public app: https://monad-ai-concierge.vercel.app  
Backend health: https://monad-ai-concierge-api.vercel.app/health

Both projects are deployed to the signed-in Vercel account. Production API calls require a server-only gateway token. `/health` is public. Do not paste API keys or provider URLs in chat.

**October 3 status:** updated code and saved provider URLs are deployed; real Gemini/chat/RPC/preview checks pass. The current ZeroDev project returns `localhost` as the registration RP ID, so production passkeys are blocked until its passkey domain is configured for `monad-ai-concierge.vercel.app`. Use a separate project/configuration for production if you want to preserve localhost testing. Changing RP ID does not migrate existing credentials. Local virtual-authenticator creation/recovery passes.

## Finish the live wallet integration

1. Create a **Monad Testnet (10143)** project in https://dashboard.zerodev.app using the free Sandbox tier.
2. Configure the allowed origin `https://monad-ai-concierge.vercel.app`. The WebAuthn RP ID is `monad-ai-concierge.vercel.app`. A passkey created for localhost is separate from one created for this production hostname.
3. In `frontend/.env.local`, fill `ZERODEV_RPC_URL` with the project bundler RPC URL and `ZERODEV_PASSKEY_SERVER_URL` with its passkey server base URL. Leave sponsorship disabled initially. Keep `BACKEND_URL` pointing to the local backend for local development.
4. Run `pwsh -File scripts/check-config.ps1`. It prints SET/MISSING without revealing values. Tell the coding agent when both URLs are saved; it can upload them as server-only production variables and redeploy.
5. On the public site, create a passkey using your device. Copy the displayed smart account address and fund it with testnet MON from https://faucet.monad.xyz. Check its balance through the app.
6. Request `Swap 1 MON to USDC`, review the rehearsal notice, cancel once, prepare again, then confirm with passkey. Expected result: **rehearsal approved**, no funds moved and no transaction hash.
7. Disconnect, choose Continue with Passkey, and verify recovery returns the same account. The browser never persists the signer in localStorage.

Only the user can complete a real device passkey interaction. Live ZeroDev registration and recovery passed locally with a Chromium virtual authenticator. A physical-device signature and funded rehearsal approval remain pending.

## Reproducible deployment

Install the Vercel CLI and authenticate with `vercel login` if necessary. Projects are already linked locally. For a fresh checkout, run `vercel link` in each directory and select the matching project.

Backend production variables:

| Variable | Value |
| --- | --- |
| `GEMINI_API_KEY` | Google AI Studio free-tier key, sensitive |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` |
| `API_ACCESS_TOKEN` | Random secret of at least 32 characters, sensitive |
| `PREVIEW_SECRET` | A separate random secret of at least 32 characters, sensitive |
| `REQUIRE_API_TOKEN` | `true` |
| `SWAP_MODE` | `mock` |
| `MONAD_RPC_URL` | `https://testnet-rpc.monad.xyz` |

Frontend production variables:

| Variable | Value |
| --- | --- |
| `BACKEND_URL` | `https://monad-ai-concierge-api.vercel.app` |
| `BACKEND_API_TOKEN` | Exactly the backend API_ACCESS_TOKEN, sensitive |
| `ZERODEV_RPC_URL` | Sandbox bundler URL, sensitive, server only |
| `ZERODEV_PASSKEY_SERVER_URL` | Sandbox passkey server URL, sensitive, server only |
| `ZERODEV_PAYMASTER_URL` | Optional separate paymaster URL |
| `SPONSOR_GAS` | `false`; enable only after verifying project sponsorship |

Use the Vercel dashboard for secret entry or pipe a local value to `vercel env add NAME production --sensitive --force --yes`. Never put secrets in shell arguments, commits, `NEXT_PUBLIC_*`, or screenshots. Environment changes require redeployment.

For these already-linked projects, `pwsh -File scripts/sync-production-env.ps1 -Deploy` reads the local files, checks all required values, uploads secrets through stdin and redeploys both projects. It keeps swaps in rehearsal mode, uploads optional transfer/registry settings, and preserves the configured SPONSOR_GAS flag (false unless explicitly enabled). Transfers are independently real testnet operations. The Telegram token and dedicated contract deployer key are never uploaded by this helper.

```powershell
cd backend
vercel deploy --prod --yes
cd ../frontend
vercel deploy --prod --yes
cd ..
.\backend\.venv\Scripts\python.exe scripts/production-smoke.py
```

The smoke script uses exact commands and the public address from the retained prototype. Add `--ai` to test one natural-language request through the configured provider. It reads real data, checks the gas safeguard, prepares/revalidates a rehearsal and checks blocked RPC methods. It never signs or submits anything. It assumes that address still has at least 1 testnet MON. Optional NVIDIA configuration and local restart instructions are in RUN_LOCAL.md; the deployment helper uploads the selected provider's key only.

## Operations

FastAPI runs directly on Vercel's Python runtime; no second hosting account is needed. Secrets and preview verification work across instances. Limits in application memory are per instance, not a distributed rate-limit guarantee. Keep Google/ZeroDev quotas capped and use Vercel's firewall controls if opening access widely. Origin checks protect browser requests but are not authentication for the public app.

Use the permanent alias for passkeys. A random preview hostname creates a different credential origin. Do not enable real swaps by changing only an environment variable: reverify contracts, WMON, USDC decimals, liquidity, simulation and the live AA operation first. The real adapter currently fails closed on missing contracts.

The old Gemini key previously appeared in prototype source. Rotate it in Google AI Studio, replace `backend/.env`, update the backend production variable and redeploy. No user private key is needed.

Vercel Hobby is intended for personal/noncommercial projects; free quotas and eligibility apply. Gemini free-tier and ZeroDev Sandbox quotas remain provider-controlled. No paid upgrade or automatic paid fallback is configured. References: [FastAPI hosting](https://vercel.com/docs/frameworks/backend/fastapi), [Hobby](https://vercel.com/docs/plans/hobby), [ZeroDev pricing](https://www.zerodev.app/pricing), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing).

Local passkey diagnosis: the provider offers Ed25519, ES256 and RSA, but the wallet requires ES256/P-256. The registration gateway now restricts algorithm selection to -7. It also preserves bounded hex ABI revert data so the SDK can decode EntryPoint SenderAddressResult. Live local registration/recovery now passes with Chromium's virtual authenticator. On localhost, leave the ZeroDev passkey domain empty, as the official setup guide specifies. Physical-device approval remains to be verified. These fixes do not change your configured URLs.
