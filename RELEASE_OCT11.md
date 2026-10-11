# Live testnet swaps and 3D frontend — October 11

Local backend `.env` and Vercel production now use `SWAP_MODE=puddleswap_v2`. Restart an existing local backend process to load this setting. The example env and production-sync helper support the same mode.

## Actual swaps

MON is wrapped and exchanged for Circle testnet USDC through PuddleSwap's direct V2 pool. USDC goes to the connected smart account. The UI displays the live quote, minimum received, slippage, expiry, full wallet fee and an explicit real-testnet warning. A passkey is required before submission. A successful receipt is required before reporting completion. No ERC-20 allowance is needed for native MON input.

The adapter pins router/factory/wrapped-token runtime hashes, verifies contract identities and pool tokens, rejects empty pools and price impact above 3% including pool fees, encodes recipient/minimum/deadline, and simulates the exact call. Existing HMAC binding, balance/gas conditions and fresh pre-submission simulation remain. Failure never silently falls back to a fictional quote.

Deployment source: https://github.com/portdeveloper/puddleswap . This is an unaudited testnet DEX. Runtime checks are not an audit. Other token pairs and mainnet are not enabled.

## Frontend

A purple CSS 3D emblem with orbiting rings, floating motion and mouse tilt replaces the small landing icon. It needs no WebGL library or external model download. Reduced-motion preferences disable animation; compact mobile screens omit the decoration. Swap prompt examples and guide wording now distinguish live execution from optional demo configuration.

## Verification

- 216 backend tests passed, including exact recipient/path/value/minimum/deadline binding and rejected contract changes, pool mismatch, empty liquidity, excessive price impact, reverts and insufficient call gas.
- 38 desktop/mobile browser tests passed, plus 4 layout/reduced-motion checks after the final mobile spacing adjustment. TypeScript and production builds passed.
- Local live RPC quote, swap simulation and preview revalidation passed.
- Production live 0.01 MON preview and revalidation passed. Observed quote: 0.042166 USDC; minimum 0.041955 USDC. Quotes are not fixed rates.
- ZeroDev estimated the actual swap call through a counterfactual P-256 smart account with a simulated balance override. Fee cap observed: about 0.38645 MON, not a guaranteed or final charged fee.
- No signature or transaction was sent by these diagnostics. The final funded passkey transaction must be completed by the wallet owner.

## Test after deployment

1. Refresh https://monad-ai-concierge.vercel.app and log in with the production passkey.
2. Fund the displayed smart account with testnet MON, including enough for the full fee shown in the preview.
3. Ask `Swap 0.01 MON to USDC`.
4. Confirm the preview says `REAL TESTNET SWAP`; review minimum received and wallet fee before approving.
5. Wait for a successful receipt, open it in Recent activity, and refresh the USDC balance in the sidebar.

The local checkout contains these changes for the owner's GitHub update. Secret environment files remain ignored and are not to be committed. No GitHub push was performed.
