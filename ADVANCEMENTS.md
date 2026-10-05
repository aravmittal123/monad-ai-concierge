# Advanced feature release — October 3, 2026

## What is implemented

| Request | Implementation and boundaries |
| --- | --- |
| Live gas and block | `/api/gas`, 5-second visible-page polling, bounded retry/backoff, stale-state label, manual refresh; green <1, amber 1–5, red >5 gwei |
| Transaction history | Last 50 actions per account in this browser; recent 8 in sidebar. Cancelled, pending, failed, confirmed and demo-approved are distinct. Pending operations can be checked; new payments are blocked while a recorded operation is pending. This is not a complete indexed wallet history. |
| Friendly failures | Toasts, actionable amount/balance errors, missing-contact guidance, retry controls, explicit AI-vs-command provenance |
| Two-step requests | `Check my balance, and if I have more than 5 MON, swap 2 to USDC`. Reads balance, pauses for Continue to preview, then requires a separate passkey approval. The strict > condition is bound to the preview and rechecked. Other arbitrary workflows remain unsupported. |
| Voice | Browser speech recognition fills the composer. User reviews and sends; recognition never auto-signs. Permission/unsupported states fall back to typing. Browser speech services may process audio online. |
| Gas sponsorship | User opt-in under Safeguards & sponsorship. Requires configured ZeroDev policy and server flag. A preview claims sponsorship only when a paymaster is present in the estimated operation. Rejection never silently switches to a user-paid operation. |
| On-chain activity | Compiled and locally EVM-tested `ConciergeActivity.sol` routes real MON payments, emits receipts and increments the sender's activity score. Reverted/simulated payments earn nothing. Optional deployment required; direct transfers work without it. This score is not identity, safety, creditworthiness or ERC-8004 compliance. |
| Bot | Opt-in Telegram private-chat bot: `/wallet`, `/balance`, `/gas`, `/swap`, `/send`. Real chain reads; payment links return to the web wallet for review and passkey approval. No bot custody/signing. Requires owner token and numeric user allowlist. |
| Mobile PWA | Manifest, 192/512 icons, maskable icon, Apple touch icon, install affordance, service worker and offline screen. API data and approvals are never cached; offline screen cannot transact. Physical Android/iOS installation and passkeys need device acceptance. |
| Real transfers + contacts | MON and Circle testnet USDC, exact amounts, full recipient address, explicit recipient acknowledgement, RPC simulation, full UserOperation fee estimate and passkey signature. Contact names resolve from this browser's saved address book, never from AI guesses. |
| UI | Two columns, header Connect Wallet modal, quick-action chips, animated purple glow, glass panels, gradient headline, loading shimmer, message transitions, success glow, dark/light themes, mobile drawer, Ctrl/Cmd+K, copy address, concise footer and demo guide icon |

**Swaps remain demos by default. Transfers move actual testnet tokens.** A successful simulation is not a completed transfer. A real success requires a successful mined UserOperation receipt.

## Test a family payment

1. Run the local servers and use http://localhost:3000. Click **Connect Wallet → Create Account** or **Log In**. A new passkey wallet has its own smart-account address.
2. Fund that smart account with MON from https://faucet.monad.xyz. For USDC, obtain Monad Testnet USDC from https://faucet.circle.com. Sponsorship covers fees only, never the amount sent.
3. Open **Saved contacts** in the account card (hamburger menu on mobile). Save Father's or Daughter's actual Monad-compatible recipient address. Confirm it directly with that person. Contacts are local to the browser, not synchronized identity records.
4. Send `Send 0.001 MON to Father`. Review **REAL TESTNET TRANSFER**, the full address, amount and full wallet fee. Check the recipient acknowledgement box, then approve with your passkey.
5. Wait for the actual receipt. Open its explorer link in Recent Activity. If it stays pending, use **Check receipt** instead of sending it again.
6. For USDC, use `Send 1 USDC to Father`. `USD` alone is intentionally ambiguous and not accepted as USDC. The allowlisted Circle contract is `0x534b2f3A21130d7a60830c2Df862319e593943A3` with 6 decimals; runtime code and decimals are checked before preparation.

Read-only Demo Account cannot sign. Default caps: 10 MON / 1,000 testnet USDC per transfer. These are configurable server limits, not market or fiat valuations.

## Activate sponsorship

Configure an appropriate Monad Testnet gas policy in the ZeroDev dashboard, including its spending/request limits and any credits required by your account. Do not assume depositing a fixed 1–2 MON is the correct provider setup. Save the paymaster URL server-side and set `SPONSOR_GAS=true` in frontend/.env.local. Restart the frontend. For deployment, the sync helper now preserves that setting and uploads the optional paymaster URL.

Toggle **Request gas sponsorship**, prepare a real transfer and verify the fee preview says sponsored. A provider refusal keeps confirmation disabled; turn sponsorship off and prepare again to explicitly review a self-funded fee.

Official reference: https://docs.zerodev.app/api-and-toolings/infrastructure/gas-policies

## Activate Telegram

Create your bot with Telegram's official BotFather. Save these locally in backend/.env:

```dotenv
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_USER_IDS=
BOT_BACKEND_URL=http://127.0.0.1:8000
APP_PUBLIC_URL=https://monad-ai-concierge.vercel.app
```

Use your numeric Telegram user ID(s), comma separated, for the allowlist. Keep keys out of chat. From backend, run `./.venv/Scripts/python.exe bot.py` while the backend runs. This is a local long-running polling process; Vercel's serverless request runtime does not host it as a persistent worker. Leave it stopped until credentials are available. Unit tests cover command behavior; no live Telegram messages were sent during development.

Official API: https://core.telegram.org/bots/api

## Deploy the optional on-chain activity contract

Source: contracts/ConciergeActivity.sol. Compiled artifact: backend/app/constants/activity_registry.json. Compiler pinned in contracts/package-lock.json; Paris EVM target. The backend compares deployed runtime bytecode exactly before routing funds through this contract.

```powershell
cd contracts
npm ci
npm run compile
cd ../backend
# Save a dedicated, faucet-funded TESTNET-ONLY DEPLOYER_PRIVATE_KEY in .env first.
# This is not your passkey and is never needed by the running application.
.\.venv\Scripts\python.exe deploy_activity.py
# Review the dry-run fee. The next command actually broadcasts:
.\.venv\Scripts\python.exe deploy_activity.py --deploy
```

Save the verified output address as `ACTIVITY_REGISTRY_ADDRESS` in backend/.env and the backend production environment. Restart/redeploy. MON transfers will then route through the contract atomically; successful payments increment the on-chain score, up to 100. USDC transfers stay direct and are not counted by this native-payment contract. View the account card again after a confirmed transfer to refresh the score.

This is not an ERC-8004 implementation. The competition brief presents ERC-8004 as an example within Track 04, not a requirement that every project must implement. Actual ERC-8004 includes standardized identity/reputation registry interfaces: https://eips.ethereum.org/EIPS/eip-8004.

## External setup still needed for live acceptance

- The current ZeroDev project returns `localhost` in registration options. The deployed site needs a project passkey domain of `monad-ai-concierge.vercel.app`; use separate configuration if you want both local and production environments. Do not transfer localhost credentials across domains.
- A real physical passkey, a funded smart account and an actual recipient are needed for a complete signed transfer acceptance test. Automated registration/recovery uses a virtual authenticator; no user's funds were sent during development.
- Sponsorship, Telegram and public-chain activity-contract deployment remain inactive without the owner's credentials/policy/deployer funds. Their code paths are implemented and tested to the extent stated above.
- Voice depends on browser support. Mobile browser emulation does not prove physical phone passkey/installation behavior: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition.

## October 4 repair release

See REPAIR_AND_MOBILE.md for the diagnosed ZeroDev Origin/allowlist failure, bounded RPC retry, persistent voice feedback, broader prompt library, USDC balance reads and grounded wallet explanations. The repaired proxy passes the localhost allowlist; production still requires both its origin allowlist and passkey domain configuration. Live simulated wallet fee estimation is now verified, but no signed transfer has been sent.
