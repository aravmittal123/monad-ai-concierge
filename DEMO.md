# Judge walkthrough

**Pitch:** Send a family payment in ordinary language. Monad AI Concierge resolves a saved contact, checks real chain data, shows the exact payment and asks for a passkey approval.

## 60-second demonstration

Before presenting, configure the ZeroDev production passkey domain, create and fund a smart account, and save a verified recipient as Father. Complete a physical-device payment test first. Testnet tokens have no claimed fiat value.

| Time | Show | Explain |
| --- | --- | --- |
| 0–10s | Connect Wallet → Log In | Passkey account; no seed phrase in the primary flow |
| 10–20s | `How much MON do I currently hold?` | Gemini interprets; Monad supplies balance, block and gas |
| 20–35s | Dictate or type `Send 0.001 MON to Father` | Voice fills the composer; the saved contact supplies the address |
| 35–50s | Inspect recipient, amount and full wallet fee | Explicit recipient acknowledgement and passkey approval |
| 50–60s+ | Recent Activity and explorer receipt | Pending is not success; confirmation can take longer |

This is an actual testnet transfer. Never claim completion before the successful mined receipt. If provider setup is incomplete, use Try Demo Account for live reads and previews; explain that read-only mode cannot approve.

## Additional demonstrations

- `Check my balance, and if I have more than 5 MON, swap 2 to USDC`: balance check → Continue to preview → separate approval. Swaps remain labelled demos with a fictional rate and no funds moved.
- A gas limit below the live price blocks preparation. Use the current widget rather than assuming a fixed network price.
- Exact `Check my balance` and `Check gas` work without AI and disclose that source.
- Cancel a preview, show a rejected unknown contact, switch themes, or demonstrate mobile installation.
- Sponsorship, Telegram and the activity contract are optional integrations. Show them as live only after their configuration and acceptance checks.

## Engineering evidence

Expiring HMAC previews bind the account, chain, recipient, token, amount, conditions and exact transaction. Revalidation checks changed balances before signing. Full wallet-operation fees include smart-account overhead. Pending operations retain their hash and can be checked without resending. The backend holds no user transaction key.

See backend/TEST_RESULTS.md and ADVANCEMENTS.md: 124 backend tests, 32 frontend unit tests, 20 browser cases, local virtual-authenticator registration/recovery, live RPC transfer simulation and PWA checks. A simulation is not a signed payment. The optional score counts completed on-chain MON payments; it is not a safety rating or ERC-8004 implementation. The real DEX adapter remains disabled until a functioning route is verified.
