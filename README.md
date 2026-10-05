# Monad AI Concierge

A deployed, passkey-first Monad assistant: real balance and gas reads, constrained AI intents, and explicit approval of an expiring preview. Gemini is selected; optional NVIDIA Nemotron support is available. Exact commands remain usable during model outages and are labelled separately from AI interpretations.

**Advanced release:** real MON/USDC transfer preparation and passkey submission, saved contacts, independent live gas/block polling, browser-local activity, a bounded two-step workflow, voice dictation, dark/light themes, a mobile drawer, and PWA support. Optional sponsorship, Telegram, and on-chain activity integrations require external setup. See [feature status and activation](ADVANCEMENTS.md).

**Live app:** https://monad-ai-concierge.vercel.app  
**Backend health:** https://monad-ai-concierge-api.vercel.app/health

Latest repair: local passkey creation/recovery and live Gemini/chat checks pass. Production chat works, but the current ZeroDev project returns `localhost` as its passkey domain; configure the production domain before claiming deployed passkey login works. See [setup and tests](RUN_LOCAL.md).

Swaps currently use a clearly labelled **off-chain rehearsal**: fictional 1 MON = 0.10 demo USDC, no funds move, no transaction hash. The verified Uniswap testnet deployment addresses returned no code. The real adapter fails closed; it is not a verified working route. Passkey SDK integration is implemented; live ZeroDev creation/recovery passed locally with a Chromium test authenticator; physical-device approval and signed rehearsal verification remain pending.

## Milestones (0–6)

| Milestone | Result |
| --- | --- |
| 0 — Architecture verification | Complete; current official sources and live chain probes |
| 1 — Backend foundation | Complete; real RPC, Gemini structured output, strict validation |
| 2 — Chat frontend | Complete; responsive dark UI, public account reads, clear previews |
| 3 — Passkey smart account | Live local registration/recovery passed with a test authenticator; physical device acceptance pending |
| 4 — Preparation and swap | Rehearsal fallback implemented; real adapter guarded and tested with controlled responses |
| 5 — Integration/security tests | Automated checks complete; live passkey approval still pending |
| 6 — Deployment/docs/demo | Both Vercel projects deployed; live read/preview checks and demo guide |

Do not call the full end-to-end passkey milestone complete until the provider/device test passes. See [deployment setup](DEPLOYMENT.md), [judge walkthrough](DEMO.md), [architecture](ARCHITECTURE.md) and [test evidence](backend/TEST_RESULTS.md).

## Run locally (PowerShell)

This workspace already has dependencies and local environment files. Build and launch:

```powershell
pwsh -File scripts/start.ps1
```

Open http://localhost:3000 for passkey testing. See [Windows testing instructions](RUN_LOCAL.md) for wallet addresses, keys, restart instructions and test prompts. Backend docs are http://127.0.0.1:8000/docs. The launcher builds the latest frontend, requires ports 3000 and 8000 to be free and starts hidden processes, printing their IDs.

For a fresh checkout:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
cd ../frontend
npm ci
Copy-Item .env.example .env.local
cd ..
```

Copy examples only when the destination does not exist. Edit the files locally. In two terminals, run:

```powershell
# Terminal 1, from backend/
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
# Terminal 2, from frontend/
npm run dev
```

Node 22.20+ and Python 3.12–3.14 are suitable for the pinned stack; this workspace used Python 3.14.6, deployed backend uses 3.12. npm start runs the standalone production build and copies static assets.

## Environment

Backend: GEMINI_API_KEY, API_ACCESS_TOKEN, PREVIEW_SECRET. Generate independent random secrets of at least 32 characters for the last two. Defaults: chain 10143, official Monad Testnet RPC, gemini-3.1-flash-lite, SWAP_MODE=mock, preview lifetime 180 seconds, maximum swap 10 MON. Production requires REQUIRE_API_TOKEN=true.

Frontend server: BACKEND_URL and matching BACKEND_API_TOKEN; ZERODEV_RPC_URL and ZERODEV_PASSKEY_SERVER_URL for the live wallet. SPONSOR_GAS=false initially. Configuration examples describe every variable. None of these provider credentials belongs in NEXT_PUBLIC variables.

```powershell
pwsh -File scripts/check-config.ps1
```

The Gemini key formerly embedded in retained prototype files was moved to ignored local configuration. Rotate it in Google AI Studio and update the backend deployment too. Prototypes are preserved but are not production entrypoints.

## Application API

Use the frontend gateway: /api/health, /api/config, /api/account, /api/chat, /api/prepare, /api/revalidate. Direct backend /api/* requests require X-API-Token. There is no backend execution endpoint; the passkey wallet submits signed UserOperations via the provider gateway.

```powershell
$wallet = '0xdA6bEa0b5FCc4A3e46075f68E247f17d13A0899e'
$body = @{prompt='Check my balance';wallet_address=$wallet} | ConvertTo-Json
Invoke-RestMethod https://monad-ai-concierge.vercel.app/api/chat -Method Post -ContentType application/json -Body $body
```

Amounts use exact decimal strings. Gas price is per gas unit, not a total transaction fee. Mock swap previews have transaction=null and simulation=mock_only. Real transfer previews use mode=transfer and bind the exact recipient, token and amount. Unknown tokens, invalid or invented recipients, malformed output, omitted conditions, expired/tampered previews, insufficient balance and simulation failures are rejected. The read-only account explorer cannot sign.

## Checks

```powershell
.\backend\.venv\Scripts\python.exe -m pytest backend/tests -q
npm --prefix frontend run test
npm --prefix frontend run typecheck
npm --prefix frontend run build
# With local frontend/backend running:
npm --prefix frontend run test:e2e
# Optional production check: direct commands plus one live AI request; no signing:
.\backend\.venv\Scripts\python.exe scripts/production-smoke.py --ai
```

Current results: 124 backend/contract tests, 32 frontend safety tests, 20 desktop/mobile browser cases passed; TypeScript and production builds passed. PWA activation/offline checks passed separately. Real MON transfer simulation/revalidation passed against Monad Testnet; no signed transfer was submitted. Live local ZeroDev registration/recovery passed with a virtual authenticator. Test fixtures are confined to tests. NVIDIA transport/validation is tested with controlled responses; no live NVIDIA key test has been performed.

## Structure

```text
backend/app/                 FastAPI routes, schemas, policies, real RPC and deterministic builder
backend/app/constants/       Verified token and contract registry, minimal ABIs
backend/tests/               Schema, policy, preview, auth and simulation checks
frontend/app/                Next.js pages and server-only API/provider gateway
frontend/components/         Chat, login, messages and approval dialog
frontend/lib/                Typed API, chain helpers and ZeroDev passkey wallet
frontend/unit/               Wallet approval and receipt safety tests
frontend/tests/              Desktop/mobile browser acceptance
scripts/                     Local launcher, secret-safe config check, production smoke
DEPLOYMENT.md                Provider setup, production variables and deployment commands
DEMO.md                      Honest 60-second judge walkthrough
```

Free-tier quotas apply. This is a testnet hackathon demo, not a mainnet-ready financial service. See deployment notes for per-instance rate-limit limits and provider setup.


