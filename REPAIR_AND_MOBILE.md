# October 4 repair release and mobile setup

Live app: https://monad-ai-concierge.vercel.app

## What caused the reported errors

- **Transfer fee estimation:** ZeroDev returned HTTP 403, “Neither IP nor domain is on the allowlist.” Our server proxy omitted the website Origin. It now forwards the validated origin. The local origin succeeds; the production origin still needs to be allowed in your ZeroDev project.
- **Intermittent 503:** the chain provider failed a read, so the app correctly refused to call the data current or prepare a transaction. Safe reads now get one bounded retry, and the gas widget retains its explicit stale state/backoff. Transactions are never automatically resubmitted.
- **Microphone:** clicking the old unsupported button did nothing, and recognition failures had vague feedback. The button now shows persistent listening/permission/browser/network guidance, times out cleanly, and fills text only. A microphone icon does not necessarily open an operating-system window; use the in-page Listening indicator. Physical microphone recognition still requires a supported browser, working microphone and permission.
- **Hydration warning:** not reproduced in clean Chromium on localhost, including desktop/mobile, theme persistence and reloads. Warnings are not suppressed. If it remains, test an extension-free Chrome window and paste the actual +/− attribute lines from the Next.js error; the generic heading does not identify the mismatch. Browser extensions can modify pre-hydration HTML: https://nextjs.org/docs/messages/react-hydration-error.

## ZeroDev settings still required for the live site

In the ZeroDev project for Monad Testnet:

1. Add `https://monad-ai-concierge.vercel.app` to the RPC/domain ACL allowlist. Keep `http://localhost:3000` if you also test locally. Use the exact origin for the ACL.
2. Set the production passkey domain/RP ID to `monad-ai-concierge.vercel.app` (hostname only). Localhost uses a separate configuration with an empty passkey domain. Prefer a separate project for local and production passkeys; changing a domain does not migrate old credentials.
3. If you create a separate project, save its production URLs locally and sync them to the production environment. Do not paste API keys or private keys into chat.

Official references: https://docs.zerodev.app/wallets/quickstart and https://docs.zerodev.app/onboarding/passkeys/overview.

## Test a real payment

1. On the target hostname, Connect Wallet → Create Account / Log In.
2. Copy the smart-account address shown by this app and fund it with testnet MON. The first operation deploys the account, so the required fee can be much larger than 0.001 MON. A diagnostic estimate was approximately 0.34 MON; use your own fresh preview, not this historical value.
3. Save Father with his verified recipient address, then type `Please send 0.001 MON to Father`.
4. Inspect the full recipient, amount and fee. On an estimation error, use Retry fee estimate; on expiry, cancel and prepare again.
5. Acknowledge the address and approve with the passkey. A successful mined receipt is the evidence of payment. Pending/unknown submission retains an operation hash; check it before resending.
6. USDC uses `Send 1 USDC to Father`; first obtain testnet USDC and keep MON for unsponsored fees. `USD` is not silently interpreted as USDC.

No real payment was signed or sent during the repair. The diagnostic bundler test used a temporary balance override only for simulation. Live passkey registration and recovery used an unfunded virtual authenticator account.

## Install on a phone

Open the **HTTPS live app**, not your computer’s localhost.

- Android: open Chrome → browser menu → Install app / Add to Home Screen. The app also has an Install icon in the sidebar.
- iPhone: open Safari → Share → Add to Home Screen.
- Allow microphone permission using browser site controls. If browser speech recognition is unavailable, use the microphone on the phone keyboard to dictate into the composer. Recognition support varies: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition.
- The offline fallback never submits transactions or caches account/API responses. A network connection is required for live chain data and payments.

## Broader prompts

The **What can I ask?** button offers 22 examples. Beyond MON/gas reads, the release adds USDC balance reads and grounded product explanations for fees, contacts, passkeys, testnet assets, swaps, sponsorship, pending receipts, installation, activity scores and safety limits. Natural transfer variants include polite requests, recipient-first requests, numeric decimals and one through ten. Every executable request is independently checked against the original text.

Investment predictions, bank payouts, scheduled transfers, all-funds requests, multiple payments and unsupported conditions are declined. Unknown contact addresses are never guessed. Default swaps remain demos. Sponsorship, Telegram and the optional activity contract still need owner configuration described in ADVANCEMENTS.md.

## Verification

- 192 backend tests passed, including 68 new prompt/retry tests and 7 existing local-EVM contract tests.
- 40 frontend unit tests passed, including origin forwarding, sanitized allowlist errors, no automatic submission retry, and retained operation hash after ambiguous submission.
- 26 desktop/mobile browser cases passed, including voice permission/unsupported states, prompt library, clean hydration and persistent theme.
- Live local ZeroDev registration/recovery passed with a virtual authenticator.
- Live P-256 account/bundler fee simulation passed using a temporary simulated balance. No signing/submission.
- Live Gemini prompt audit: 16 passed; the last 4 returned rate limit errors and are not claimed as passed. They remain safely non-executed. Local tests independently cover rejection of ambiguous/compound/unsafe requests. The audit result file records all outcomes.
- Production checks are recorded in backend/TEST_RESULTS.md and deployment.json. Physical phone installation, microphone recognition and a funded signed transfer remain device acceptance steps.

