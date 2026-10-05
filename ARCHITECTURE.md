# Architecture and verified integrations

Verified during development on September 30–October 2, 2026. Live observations are snapshots, not permanent network guarantees.

| Integration | Decision and primary reference |
| --- | --- |
| Monad | Testnet 10143, native MON, official RPC https://testnet-rpc.monad.xyz, explorer https://testnet.monadscan.com, faucet https://faucet.monad.xyz. [Current facts](https://docs.monad.xyz/ai/current-facts), [transactions](https://docs.monad.xyz/developer-essentials/transactions). Chain ID is checked on reads and approval; no silent mainnet switch. |
| Gemini | google-genai 2.25.0, gemini-3.1-flash-lite; schema output independently validated with Pydantic. [Models](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite), [structured output](https://googleapis.github.io/python-genai/), [free pricing](https://ai.google.dev/gemini-api/docs/pricing). |
| Passkeys | ZeroDev Kernel 0.3.3, EntryPoint 0.7, patched passkey validator 0.0.3; installed SDK APIs checked. [Tutorial](https://docs.zerodev.app/onboarding/passkeys/tutorial), [Monad support](https://docs.zerodev.app/api-and-toolings/faqs/chains), [Sandbox pricing](https://www.zerodev.app/pricing). The selected factory, implementation, metafactory, validator and EntryPoint have nonempty live code. Provider credentials/device acceptance remain pending. |
| Alternative AA | Biconomy's current stack uses Nexus/AbstractJS/MEE; no simpler passkey/free path was established. Pimlico is a documented infrastructure fallback, not the chosen signer. [Biconomy chains](https://docs.biconomy.io/contracts-and-audits/supported-chains), [Pimlico chains](https://docs.pimlico.io/guides/supported-chains). |
| Tokens | Native MON 18 decimals; USDC 6 at 0x534b2f3A21130d7a60830c2Df862319e593943A3; WMON 0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541. [Circle registry](https://developers.circle.com/stablecoins/usdc-contract-addresses), [Monad token registry](https://github.com/monad-crypto/token-list/blob/main/tokenlist-testnet.json). |
| DEX | Uniswap official feed supplied factory, QuoterV2 and SwapRouter02 addresses in constants/tokens.py. All three returned zero code in live checks, so production uses a labelled off-chain rehearsal. [Official deployments feed](https://developers.uniswap.org/deployments.json). No route, liquidity or market rate is invented. |
| Hosting | Next.js and FastAPI deployed as two Vercel projects on the signed-in account. [FastAPI support](https://vercel.com/docs/frameworks/backend/fastapi), [Python runtime](https://vercel.com/docs/functions/runtimes/python), [Hobby eligibility](https://vercel.com/docs/plans/hobby). No Render account is required. |

## Trust boundaries

Prompt → Gemini intent schema → strict Pydantic validation and prompt policy → real chain snapshot → deterministic registry-backed preparation → simulation in real mode → signed expiring preview → explicit confirmation → fresh policy validation → passkey signature → bundler → verified receipt.

Allowed intents are balance, gas, MON-to-USDC swap, MON/USDC transfer and a bounded balance-then-swap workflow. Gemini sees prompt text only. Transfer recipient text must match the user's command and resolves deterministically against validated contacts or an explicit full address; the model never supplies executable calldata or token contracts. Unknown fields and precision errors fail closed. Explicit numerical conditions are preserved; vague or unsupported conditions cannot silently disappear into an unconditional action. Conditions are immediate checks, not background scheduling.

The backend signs preview metadata with a separate HMAC secret, not a user transaction. The preview binds account, chain, amount, recipient, token, min output, slippage, gas limit, balance condition, mode, calldata and expiry. Stateless signatures survive serverless instance changes. No user transaction signing key, seed phrase or private-key input is used by the runtime.

The Next.js server proxies only allow-listed backend, RPC, bundler, paymaster and passkey endpoints. Provider URLs and the backend access token stay server-side. Raw transaction submission is rejected by the public RPC proxy. React renders untrusted text without HTML interpretation. Browser origin checks and bounded request bodies complement secret-protected direct backend API access.

Passkey signers remain in browser memory. Account creation/recovery uses the current ZeroDev WebAuthn SDK and the stable production hostname as RP ID. Localhost credentials are separate. The frontend estimates the full wallet operation before approval, then signs the exact estimated operation. It checks expiry and backend policy again after signing before submission. Receipt timeout retains a pending operation hash; revert cannot become success. No unattended session permissions are created.

## Swap modes

`mock`: fixed fictional rate 1 MON = 0.10 demo USDC; real balance and gas checks; no unsigned transaction, no DEX simulation. Confirm signs a clearly marked off-chain approval message; ERC-6492-aware verification checks its smart-account signature. Only verified approval yields a rehearsal result. No funds move or transaction hash exists.

`uniswap_v3`: verify deployed bytecode, wrapped token and USDC decimals; quote direct pools at fees 500/3000/10000; construct minimum-output-protected native MON exactInputSingle wrapped in a deadline multicall; recipient is the preview account; eth_call and estimate_gas must succeed. Wallet fees include deployment/verification overhead and are shown before approval. This adapter is tested with controlled chain responses, but current live DEX checks block it. Do not enable it until the route and live AA operation are verified.

## Operational limits

Rate limits are held in instance memory and do not provide global distributed protection. Public chat/provider gateways are intentionally accessible; an Origin header is not a user identity. Provider quotas and platform controls must bound abuse for wider use. No paid resource or automatic paid fallback was selected. Free-tier prompts may be processed according to Google's free-tier terms.

Current chain probes confirm wallet contract presence, not provider registration, correct origin settings, device availability or successful passkey signing. Real swap availability can change after testnet resets. The hackathon track labels in the brief were not independently verified; the demo narrative should not imply acceptance or a judging guarantee.

Passkey integration corrections: registration options are constrained to ES256 (-7), because the signer imports a P-256 public key. RPC error sanitization preserves only bounded hexadecimal ABI revert bytes, enabling EntryPoint counterfactual-account discovery without exposing raw provider diagnostics. Live local provider registration and recovery passed with Chromium's virtual authenticator.
