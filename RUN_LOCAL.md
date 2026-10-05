# Run and test on your Windows computer

Gemini remains selected. Your existing Gemini and ZeroDev values are already saved locally; you do not need another key to test the current setup.

## Start

For development, open two PowerShell terminals. Stop old copies with Ctrl+C first so ports 8000 and 3000 are free.

Terminal 1:

```powershell
cd "C:\Users\rekha\OneDrive\Desktop\Monda AI\backend"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Terminal 2:

```powershell
cd "C:\Users\rekha\OneDrive\Desktop\Monda AI\frontend"
npm run dev
```

Open **http://localhost:3000** in current Chrome or Edge. Use localhost for passkeys even if the terminal prints 127.0.0.1. Localhost and the deployed hostname have separate passkeys. After changing either .env file, restart the corresponding server; Python reload does not reliably detect .env changes.

Alternatively, with both ports free, run `pwsh -File scripts/start.ps1` from the project root. It builds the latest frontend and launches both servers in the background, printing their process IDs. Stop those exact app processes with `Stop-Process -Id <printed-id>` before starting another copy. `-SkipBuild` is only for reusing a known current build.

## Test passkeys and chat

1. In ZeroDev, use the Monad Testnet project (chain 10143). For localhost testing, leave the project's passkey domain empty. For production, configure the exact stable hostname. Do not change this to a random Vercel preview hostname.
2. Click **Connect Wallet → Create Account**. Use Windows Hello or the browser's supported passkey device. If you created a credential before the P-256 fix, create a fresh one and choose it during login.
3. Copy the smart account address displayed in the app. This is your new wallet address; it is not automatically your MetaMask address. Fund that address from https://faucet.monad.xyz before preparing a 1 MON rehearsal.
4. Ask `Check my balance`, then `Check gas`. These exact commands read the real chain without needing Gemini. Zero balance on a new wallet is normal.
5. Ask `How much MON do I currently hold?` to test Gemini. The response must say **Intent interpreted by Gemini**. The balance still comes from RPC.
6. With at least 1 testnet MON in this smart account, ask `Swap 1 MON to USDC only if gas is below 1 gwei`. When live gas is above that limit, approval must be blocked.
7. Ask `Swap 1 MON to USDC`, review the rehearsal label, cancel once, then prepare again and confirm with your passkey. This is a fictional quote; no funds move.
8. Disconnect and choose **Connect Wallet → Log In**. It should recover the same smart account.

For real family payments, open **Saved contacts** in the account card, save the verified recipient address, and ask `Send 0.001 MON to Father` or `Send 1 USDC to Daughter`. Review the complete recipient address and fee, check the recipient confirmation box, then approve with the passkey. These transfers move real testnet tokens; swaps remain demos. See ADVANCEMENTS.md for sponsorship, Telegram, the optional on-chain activity contract, PWA and the two-step workflow.

To test reads before creating a passkey, choose **Connect Wallet → Try Demo Account**. It selects `0xdA6bEa0b5FCc4A3e46075f68E247f17d13A0899e`, the public address from the existing project. It grants no signing access. Its balance can change.

## Configuration and failures

- Backend `.env`: `AI_PROVIDER=gemini`, `GEMINI_API_KEY`, `API_ACCESS_TOKEN`, `PREVIEW_SECRET`.
- Frontend `.env.local`: local `BACKEND_URL=http://127.0.0.1:8000`, matching `BACKEND_API_TOKEN`, `ZERODEV_RPC_URL`, `ZERODEV_PASSKEY_SERVER_URL`. Paymaster URL is optional while `SPONSOR_GAS=false`.
- Do not put provider credentials in `NEXT_PUBLIC_*` variables or paste them into chat.
- A Monad RPC failure now leaves wallet configuration loaded. Use **Retry connection**; your account-name field and conversation remain intact. A network outage can still prevent actual account creation or live reads.
- A Gemini outage does not break the exact commands above. Other wording still requires a reachable, authorized model. API errors distinguish authorization, quota, timeout and connection problems where the provider exposes them.
- The pasted hydration warning did not reproduce in clean desktop/mobile browsers. If it persists, test in a browser profile with extensions disabled and hard-refresh. Do not erase a passkey to troubleshoot this warning.

Optional NVIDIA support is implemented but not live-tested with your key. To switch later, save `NVIDIA_API_KEY` in backend/.env, set `AI_PROVIDER=nvidia`, and restart the backend. Default: `nvidia/nemotron-3-super-120b-a12b`. This is a configurable alternative, not a claim that it outperforms Gemini for this task. Official endpoint: https://build.nvidia.com/nvidia/nemotron-3-super-120b-a12b.

## Repeatable checks

From the project root with both servers running:

```powershell
pwsh -File scripts/check-config.ps1
.\backend\.venv\Scripts\python.exe scripts/production-smoke.py --url http://localhost:3000 --ai
```

The smoke test checks real reads, one Gemini interpretation, policy blocking and unsigned rehearsal previews. It never approves or sends a transaction. It assumes the public test address has at least 1 MON.
