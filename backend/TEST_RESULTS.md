# Verification — updated October 4, 2026 (India time)

## October 4 reliability repair

- **192 backend tests passed**; 68 new prompt/policy/retry cases supplement prior coverage. Tests discovered and fixed leading-zero amount reinterpretation and unrecognized mainnet qualifiers in transfer requests.
- **40 frontend unit tests passed**; domain-denial mapping, preserved Origin, bounded read retry, no submission retry, and deterministic operation hash retention after ambiguous submission are covered. Definitive 403/429 rejections do not become pending submissions.
- **26 browser cases passed** on desktop/mobile. Voice now has persistent status, actionable denied/unsupported/network feedback and review-before-send. The 22-example prompt picker only fills the composer. Hydration warnings were not reproduced; they have not been suppressed.
- Live local ZeroDev registration/recovery passed using an unfunded virtual authenticator. Test logging was repaired to tolerate responses finishing after navigation.
- Live local wallet bundler estimation passed for a newly generated P-256 account using **simulation-only balance override**, with an observed approximately 0.34 MON maximum fee including account deployment. No signature or funds movement; this is not a user transfer acceptance test.
- Root cause of reported fee failure: omitted Origin caused ZeroDev HTTP 403 allowlist rejection. With the actual localhost origin, chain and gas estimation succeed. Production origin is still rejected until configured by the owner. The final gateway preserves definitive 401/403/429 statuses and maps messages without leaking URLs/keys.
- Production smoke passed health, MON/gas, gas safeguards, demo preparation/revalidation, real MON transfer simulation/revalidation and raw-RPC submission rejection. New USDC balance and product-guide answers returned HTTP 200. A Windows HTTP client diagnostic encountered a connection reset; a fresh request succeeded. This is not evidence that network failures can never recur.
- Deployed PWA checks passed manifest/icons, service-worker control, no cached API data, offline fallback and microphone policy. Desktop/mobile production checks passed theme persistence, example selection, no overflow, no client exceptions and no hydration warnings. Mobile light layout was visually inspected.
- Live Gemini prompt audit: **16 passed; 4 rate-limited**. The latter remain unverified as live model classifications, with no execution. Results: prompt-audit-results.json. Exact commands and built-in guide answers do not depend on Gemini quota.
- Still external: production ZeroDev ACL/passkey domain; physical microphone/mobile install/passkey checks; funded signed transfer receipt; sponsorship policy; Telegram credentials; activity-contract deployment. Default swaps remain demos.

## Advanced release verification

- Backend: **124 passed**, including contact uniqueness/address resolution, native and USDC transfer preparation, precision and amount limits, false-return/revert handling, HMAC-bound recipient, changed balance at revalidation, strict two-step balance threshold, cached live gas, and Telegram command behavior.
- Contract: tests above include **7 local PyEVM tests** against compiled Solidity bytecode: actual native balance movement, completion event/counter, simulation leaving count unchanged, failed recipient rollback, duplicate intent rejection, amount bounds and deployed runtime-code matching. This is local EVM evidence, not a Monad deployment.
- Frontend: **32 passed**, including exact native transfer call construction and rejection of silently unsponsored operations.
- Browser: **20 desktop/mobile cases passed** (19 initial, mobile contact test corrected to close the drawer with its visible toggle, then passed). Covers new layout/modal, quick chips, contacts persistence, full transfer recipient, read-only signing prohibition, sequential workflow confirmation, independent gas recovery, themes, Ctrl+K, clean hydration, voice filling without submission, error toasts and gateway restrictions.
- Production build: passed. PWA-specific browser test passed against a local production build: manifest/512px icon, service-worker control, no cached API responses, offline fallback with no submission UI, microphone permission policy. Physical mobile installation is not covered by browser emulation.
- Live local smoke with Gemini passed through the gateway, including the new gas endpoint and native transfer preview/revalidation. Separately, live Monad native transfer simulation for **0.001 MON** passed; registered USDC contract has **1,798 bytes of code** and reports **6 decimals**. No signature or funds transfer was performed.
- Live local ZeroDev registration/recovery passed after the modal redesign with a Chromium virtual authenticator and P-256 key. User's physical authenticator and actual funded transfer receipt remain unverified.
- Contract compiler dependency audit: **0 reported vulnerabilities** after pinning solc 0.8.37 and patched tmp 0.2.7. Existing Python dependency deprecation warnings include cached_property under Python 3.14; they do not affect these test results.
- Sponsorship, Telegram and public activity-registry deployment await owner configuration. No fake sponsored badge, reputation points for simulations or ERC-8004 implementation claim is made. See ADVANCEMENTS.md for activation and exact boundaries.

## October 3 repair verification

- 96 backend tests passed, including exact-command boundaries, no-model availability, NVIDIA authorization/quota/timeout handling and rejection of incomplete/unsafe model output.
- 27 frontend safety tests passed. TypeScript and local/cloud production builds passed.
- 16 desktop/mobile browser cases passed (14 in the initial run, then both corrected outage-fixture cases passed). New checks cover an RPC outage leaving configured passkeys enabled, retry preserving entered account name, clean hydration, and transparent command provenance. React development Strict Mode runs the mount effect twice; the test fixture now models a persistent outage until recovery instead of counting requests.
- Direct live Gemini request passed. Full local and deployed `production-smoke.py --ai` passed: actual Gemini interpretation, real Monad balance/gas, numerical gas safeguard, preparation/revalidation and rejected raw transaction submission. Exact commands are labelled `command`; the natural-language probe is labelled `gemini`.
- Live local ZeroDev registration/recovery passed again with a Chromium virtual authenticator using P-256 (-7). Provider registration verified=true; recovery returned the same smart account. No funds or transactions were used.
- Production ZeroDev URLs are now installed server-side. Production registration remains blocked by provider configuration: registration options returned `rp.id=localhost` for a request from `monad-ai-concierge.vercel.app`. The browser correctly rejected the domain before registration verification. This requires the ZeroDev production passkey domain to match the stable hostname; do not disable WebAuthn origin validation. Keep local and production configurations separate if both are needed.
- Physical-device creation, recovery and funded rehearsal approval remain pending. NVIDIA is implemented and covered by controlled transport tests but has not been tested with a live key; Gemini remains selected at the user's request.

Earlier evidence follows for history; this section supersedes older pending/setup statuses.

Both projects are deployed. Public site: https://monad-ai-concierge.vercel.app. Backend: https://monad-ai-concierge-api.vercel.app.

| Check | Result | Evidence / scope |
| --- | --- | --- |
| Backend tests | 69 passed | Strict schemas, model failures, exact units, prompt policy, token/account/chain/expiry binding, tampering, balance/gas caps, real builder simulation paths, API authentication/rate limiting |
| Wallet safety tests | 17 passed | Controlled SDK/provider responses; cancellation, invalid signature, JSON order, wrong account/chain, changed calldata, full wallet fees, post-sign expiry/policy, pending receipt, revert and success distinction |
| Browser tests | 12 passed | Desktop Chrome + Pixel 7; controlled HTTP fixtures, escaping, preview/cancel, disabled observer signing, gas block, readable failures, gateway method/origin rejection |
| TypeScript / production build | Passed | Local compiler and Vercel cloud build |
| Live deployed health | HTTP 200 | Real chain 10143, block 67334012 during production smoke |
| Live balance prompt | HTTP 200 | Gemini check_balance, real public account balance 10 MON, block 67334023 |
| Live gas prompt | HTTP 200 | Gemini gas_check; real 102 gwei suggestion, not a total fee |
| Live conditional swap | HTTP 409 at preparation | Gemini preserved explicit below-1-gwei condition; gas_limit_exceeded; no signature or send |
| Live unconditional swap | HTTP 200 preparation/revalidation | Honest rehearsal, transaction=null, simulation=mock_only, fictional quote 0.1 demo USDC |
| Direct backend API without token | HTTP 401 | Protected gateway-only access |
| Public raw transaction RPC | HTTP 400 | eth_sendRawTransaction rejected |
| Selected ZeroDev contracts | Nonempty code | Kernel 24469 bytes; factory 950; metafactory 1871; passkey validator 4739; EntryPoint 16035 |
| Selected Uniswap contracts | Unavailable | Factory, quoter and router returned zero code; real adapter fails closed |
| Live passkey create/recover/sign | Pending | Owner must save ZeroDev URLs, configure stable origin, then complete device interaction |
| Real on-chain swap | Not performed | No verified executable DEX route; mock is explicitly allowed by the project brief |

`production-results.json` contains actual deployed responses and an observation timestamp. Preview tokens are removed. `live-results.json` retains the earlier Milestone 1 observations. Screenshots in frontend/screenshots are ignored local review artifacts. Values may change with chain state, network/provider availability and testnet resets.

Run checks using the README commands. production-smoke.py consumes four Gemini requests and performs no signing or submission. Browser fixture tests do not prove live passkey/provider compatibility; wallet unit tests do not prove on-chain deployment or liquidity. There is no fake success response in the application.

Two harmless Python dependency deprecation warnings remain: Starlette's httpx adapter and Google's internal union typing alias. ZeroDev transitively depends on deprecated SimpleWebAuthn packages; no direct replacement was made because its signer must remain compatible with the selected SDK. npm audit reported zero vulnerabilities when dependencies were installed.

The live Gemini service returned one transient unavailable response during earlier local testing; subsequent production checks passed. Errors remain visible and retryable; health reports key configuration, not guaranteed model availability. Application rate limits are per instance and cannot establish a distributed abuse limit.

Completion of the passkey acceptance test must be recorded after real registration, recovery, cancellation and signed rehearsal verification. No user private key is required or requested.

Live production browser verification also passed on desktop and Pixel 7: no horizontal overflow, no browser exceptions, and a real balance chat response on desktop. Screenshots: frontend/screenshots/production-desktop.png, production-mobile.png and production-balance.png. Final desktop layout was visually inspected; suggested commands and trust notice are fully visible.

Passkey fix verification: live ZeroDev registration and smart-account construction passed on localhost using a Chromium virtual authenticator with ES256 (-7); disconnect/login recovered the same account. Gateway now retains the EntryPoint's ABI revert data while redacting provider messages. 27 frontend unit tests passed, including the two regression cases; 12 desktop/mobile browser tests passed. No funds or UserOperations were sent. The user's physical authenticator and signed rehearsal approval remain pending.

Advanced production release (October 3): frontend dpl_8Y18bWVtqK3m49xzT6nZojwd9QKW and backend dpl_B5TAHnUa4XNCX3Kfdidx3gvDxF9y deployed successfully. Production smoke passed live Gemini interpretation, balance, gas/block, safeguards, demo preview/revalidation, real MON transfer simulation/recipient binding, and rejected raw RPC submission. Production PWA smoke passed manifest, service worker, network-only API caching policy, offline fallback and microphone policy. No transfer was signed or broadcast. ZeroDev production RP-domain correction and physical-device acceptance remain outstanding.


