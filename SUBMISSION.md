# Metropolis submission draft

Recommended track: **Trust, Identity & AI Infrastructure**. The supplied competition brief lists P256/WebAuthn passkey-native accounts. Consumer onboarding is a supporting benefit; choose one track as the brief requests.

## Short write-up

Monad AI Concierge turns “Send 0.001 MON to Father” into a reviewable testnet payment. Users save a verified recipient address once, speak or type their request, inspect the amount, recipient and wallet fee, then approve with a passkey. This addresses the friction of paying a familiar person through unfamiliar wallet screens while retaining explicit authorization.

The application separates natural-language interpretation, deterministic validation and signing. Gemini extracts constrained intent data. Application code resolves contacts, constructs allowlisted MON or USDC calls, simulates them against Monad Testnet and creates an expiring HMAC-bound preview. Before approval, it rechecks balances and conditions. The model cannot invent recipient addresses, supply executable code or authorize a transaction.

A live block/gas widget and receipt-based activity feed make the chain state visible. Exact commands remain available during AI outages. A bounded two-step workflow checks balance and pauses before preparing a conditional demo swap. Voice fills the composer for review; mobile PWA support, themes and keyboard shortcuts make the same workflow accessible across devices.

Transfers move testnet tokens. Default swaps remain explicitly labelled rehearsals with fictional quotes; no executed DEX swap is claimed. Sponsorship needs an active ZeroDev policy. An optional, locally EVM-tested payment contract records successful MON payment counts, but is not deployed yet and does not implement ERC-8004. The optional Telegram bot returns users to the web wallet for signing.

## Evidence and remaining acceptance

- 124 backend tests, including 7 local EVM contract tests; 32 frontend unit tests; 20 desktop/mobile browser cases.
- Live Monad native-transfer simulation and USDC contract/decimal verification; no signed transfer sent during development.
- Live local ZeroDev registration/recovery with a virtual authenticator; physical-device approval remains to be tested.
- Production ZeroDev registration currently returns a localhost RP ID. Configure the production hostname before demonstrating login there.
- Contract deployment, live sponsorship and Telegram activation require owner setup. See ADVANCEMENTS.md for precise boundaries.

Do not claim a security audit, guaranteed judging outcome, autonomous trading, ERC-8004 compliance or completed live swap.

## Submission materials

- Product: https://monad-ai-concierge.vercel.app
- Walkthrough: https://monad-ai-concierge.vercel.app/demo-guide
- Demo script: DEMO.md; verification: backend/TEST_RESULTS.md; setup: RUN_LOCAL.md and ADVANCEMENTS.md.
- Owner still supplies project/team profile, a judge-accessible code repository, and a recording showing the physical passkey and actual receipt. This workspace currently has no Git repository; no code URL is invented.

The user-provided brief gives a 13 October deadline, judging 14–27 October, and winners 3 November. Verify cutoff time/timezone in the portal. It asks for a working product, public profile, demo, short write-up, code link and verifiable sprint work. These notes are based on the supplied brief, not an independently verified judging scorecard.
