# October 10 repair release

Live app: https://monad-ai-concierge.vercel.app

- Removed the fixed MON/USDC transfer ceiling. Positive amounts, token precision, actual balance, fresh simulation, full wallet fee estimate and explicit passkey approval remain required. Legacy MAX_TRANSFER_MON/MAX_TRANSFER_USDC environment variables are no longer used.
- Supported balance conditions accept optional “and”, “then”, MON before/after the threshold, and swap “to”, “into” or “with” USDC. Full-string matching still rejects added unsupported instructions. Strictly more than 5 excludes exactly 5.
- USDC balance, refresh and token-transfer explorer link are in the account sidebar. Receipts for this browser's confirmed actions remain in Recent activity.
- Request failures remain in chat rather than disappearing with a toast. Gemini missing configuration, authentication, rate/quota and provider failures have separate errors.
- Existing quiet voice input and progressive reply effects remain.

## Verification

207 backend tests, 40 frontend unit tests and 34 desktop/mobile browser tests passed. TypeScript and Vercel production builds passed.

Live production checks passed: the user's conditional phrasing returned an action plan without AI; a 50 MON request against 13.51 MON returned insufficient_balance; USDC returned an actual zero balance; Gemini answered “How much MON do I currently hold?”. The initial Python HTTP probe hit a local TLS connection error; Node requests and browser provider tests succeeded.

Production passkey creation and same-account recovery passed with a virtual authenticator. A counterfactual account fee estimate passed using a simulated balance override. No transaction was signed or submitted by these checks; physical authenticator and funded receipt tests remain user-driven.

## Remaining scope

Swaps remain MON-to-USDC simulations. On this check, configured factory, quoter and router addresses each returned zero bytes of code on Monad Testnet. No live exchange or extra token pair is claimed. Real MON and registered testnet USDC transfers are separate operations. Other tokens require verified contracts and, for swaps, a working liquid route.

Gemini responded successfully during the live check. A future 429 means rate/quota exhaustion, not a missing key. Limits are per project; another key in the same project does not grant more quota.

## Try it

Hard-refresh the live app and log in. Ask “Check my USDC balance”; use Refresh USDC or Token transfers in the sidebar. Ask “check my balance, if I have MON more than 5, then swap 2 MON with USDC” and continue to the simulation preview. For a real payment, save the recipient's verified address, request a small MON or USDC transfer, review the full fee and recipient, then approve with your passkey. Use the receipt link to verify the result.
