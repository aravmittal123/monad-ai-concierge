# Monad Concierge

An AI-assisted, non-custodial wallet on Monad Testnet. Ask by text or voice, review a live preview, and approve with a passkey.

**Live app:** https://monad-ai-concierge.vercel.app

**Backend health:** https://monad-ai-concierge-api.vercel.app/health

## Features

- ZeroDev passkey smart accounts with creation and recovery.
- Real MON and Circle testnet USDC transfers to addresses or browser-local saved contacts. No fixed 10 MON transfer ceiling; positive amounts, precision, balance and full wallet fees are checked.
- Real MON-to-USDC swaps through PuddleSwap V2 with live quotes, minimum received, slippage, expiry, simulation and passkey approval. USDC goes to the connected account. Other swap pairs and mainnet are not enabled.
- Live MON/USDC balances, gas and block number, five-second visible-page network polling, retry/backoff and stale-state indicators.
- Supported conditional balance/gas workflows with review before approval. Arbitrary autonomous workflows are not supported.
- Gemini interpretation and direct commands that work without AI; optional NVIDIA provider support and distinct configuration/authentication/quota errors.
- Voice input fills the composer for review. Free browser text-to-speech reads replies and authorization instructions with speaker opt-in, voice selection, stop and replay. No voice API key is required. Voice selection changes pronunciation, not translation of English replies.
- Progressive reply reveal, purple CSS 3D emblem, dark/light themes, mobile drawer, quick prompts and Ctrl/Cmd+K.
- Browser-local activity with pending/failed/confirmed states and explorer receipts; this is not a complete indexed wallet history.
- Mobile PWA installation support and an offline screen. Offline mode cannot transact.
- Optional sponsorship, Telegram interface and on-chain activity contract require owner configuration. The activity score is not ERC-8004 compliance or a financial trust rating.

## Run locally on Windows

Install Node.js/npm and a Python version supported by the backend dependencies. From the project root:

```powershell
python -m venv backend/.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
npm ci --prefix frontend
```

For a fresh checkout, copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env.local`. Preserve existing configured files.

| File | Configuration |
| --- | --- |
| `backend/.env` | `AI_PROVIDER=gemini`, `GEMINI_API_KEY`, independent random `API_ACCESS_TOKEN` and `PREVIEW_SECRET`, `SWAP_MODE=puddleswap_v2` |
| `frontend/.env.local` | `BACKEND_URL=http://127.0.0.1:8000`, matching `BACKEND_API_TOKEN`, ZeroDev Monad Testnet `ZERODEV_RPC_URL` and `ZERODEV_PASSKEY_SERVER_URL` |
| Optional sponsorship | Paymaster URL and `SPONSOR_GAS=true`, after configuring a valid ZeroDev gas policy |

Keep secrets out of Git and `NEXT_PUBLIC_*`. No customer private key is required. Localhost and production use separate passkeys; see [deployment setup](DEPLOYMENT.md).

Start two PowerShell terminals from the root:

```powershell
# Terminal 1
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

```powershell
# Terminal 2
cd frontend
npm run dev
```

Open **http://localhost:3000** in Chrome or Edge. Restart servers after environment changes. Use `backend/.venv`, not `backend/venv`. If port 8000 is occupied or restricted, choose an available port such as 8001 and update frontend `BACKEND_URL` to match.

## Try it

1. Connect Wallet → Create Account or Log In. Fund the displayed smart account from https://faucet.monad.xyz, including enough for its full wallet fee.
2. Ask `Check my balance`, `Check my USDC balance` or `Check gas`.
3. Save a verified contact. Ask `Send 0.001 MON to Father`, review the full address, amount and fee, then approve with your passkey.
4. Ask `Swap 0.01 MON to USDC`. Review REAL TESTNET SWAP, minimum received and fee. Approve, wait for a successful receipt, then refresh USDC.
5. Try `Check my balance, and if I have more than 5 MON, swap 2 to USDC`. The condition is rechecked before approval.
6. Enable the speaker beside the microphone. Dictation still requires Send; speaking cannot authorize payments.
7. Open the receipt in Recent activity. Check pending operations before submitting again.

Try Demo Account is read-only. Optional `SWAP_MODE=mock` provides explicitly labelled simulations with unchanged balances. Current local and production settings use `puddleswap_v2` for real testnet swaps.

## Safety and scope

AI interprets requests; it does not hold keys or approve payments. Previews bind amounts, recipients, conditions and expiry and are revalidated before signing. Swaps verify pinned contract identities, pool tokens and liquidity, reject excessive price impact and simulate the exact call. Completion requires a successful mined receipt.

PuddleSwap is an unaudited testnet DEX; runtime checks are not an audit. This prototype supports Monad Testnet, not fiat payments or mainnet funds. Browser voices vary; some voices and recognition use online browser services.

## Tests and deployment

```powershell
.\backend\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
.\backend\.venv\Scripts\python.exe -m pytest backend/tests
npm run test --prefix frontend
npm run typecheck --prefix frontend
# Requires local servers and installed Playwright Chromium
npm run test:e2e --prefix frontend
```

The live-swap release passed 216 backend tests and 38 desktop/mobile browser tests. Spoken replies passed 44 frontend unit tests, eight targeted desktop/mobile browser tests, TypeScript and the production build. Production speaker controls were checked without page errors. Speech tests use mocks; physical audible output and a funded signed swap were not verified by these diagnostics. Virtual passkey registration/recovery and unsigned live RPC/bundler simulations passed.

For the linked Vercel projects, `pwsh -File scripts/sync-production-env.ps1 -Deploy` uploads configured server-side values and redeploys both projects. Review configuration first and never commit secret environment files. See [DEPLOYMENT.md](DEPLOYMENT.md) and [deployment.json](deployment.json).

## Documentation

- [Local testing](RUN_LOCAL.md)
- [Current live-swap release](RELEASE_OCT11.md)
- [Spoken replies](SPOKEN_REPLIES.md)
- [Optional integrations](ADVANCEMENTS.md)
- [October 10 fixes](RELEASE_OCT10.md) — historical demo-swap status superseded by October 11.

This README and the October 11 release describe current behavior. Earlier release notes may describe older demo modes and transfer limits.
