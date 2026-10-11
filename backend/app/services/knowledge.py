"""Grounded product answers. No model-generated financial facts or signing."""
ANSWERS = {
 'capabilities': 'I can read your MON balance and live gas, prepare MON or testnet USDC transfers to saved contacts, and demonstrate MON-to-USDC swaps. Try: Send 0.001 MON to Father; Check my USDC balance; Explain wallet fees; or Check my balance, and if I have more than 5 MON, swap 2 to USDC. Every payment needs your review and passkey. I cannot send bank dollars, trade autonomously, schedule payments or promise investment returns.',
 'gas': 'Gas measures computation. Gwei is a price per gas unit, not the total fee. The live widget reads Monad Testnet. Your wallet fee cap also includes smart-account deployment and verification overhead. Set a gas limit under Safeguards & sponsorship; exceeding it stops preparation.',
 'passkeys': 'A passkey authorizes your smart account using your device or passkey provider. The app backend does not hold a wallet private key. Use a stable HTTPS hostname on mobile. Localhost and the deployed hostname have separate passkeys; ZeroDev must allow the correct domain. Losing access to every passkey copy can mean losing access to the wallet.',
 'fees': 'The preview shows the full wallet fee cap before approval. A first payment can cost more because it deploys the smart account. Gas sponsorship, when configured and accepted, covers fees only, not the tokens sent. Fund the smart-account address shown in the app, not a different browser-extension account.',
 'testnet': 'This app uses Monad Testnet, chain ID 10143. MON and USDC here are test tokens, not bank dollars or mainnet funds. Get MON from faucet.monad.xyz and testnet USDC from faucet.circle.com. Do not send mainnet assets to test this prototype.',
 'transfers': 'Save a verified address in Saved contacts, then ask Send 0.001 MON to Father or Send 1 USDC to Daughter. Review the full address, token, amount and fee; acknowledge the recipient and approve with your passkey. A simulation is not a payment. Success requires a mined receipt; finalized transfers cannot be recalled by this app.',
 'usdc': 'See Testnet USDC in the account sidebar and use Token transfers to open the on-chain explorer. Recent activity shows payments made in this browser with receipt links. This app supports Circle testnet USDC with six decimal places. Ask Check my USDC balance or Send 1 USDC to Father. USD alone is ambiguous; specify USDC. Testnet USDC is not a bank payout. A USDC transfer still needs MON for wallet fees unless sponsorship is accepted.',
 'safety': 'AI interprets your request; application code checks contacts, tokens, amounts, conditions and the exact transaction. An expiring signed preview is revalidated before sending. Read-only mode cannot sign. These controls are not a security audit or a guarantee. Verify recipient addresses directly with the person; local contact names are not verified identities.',
 'pending': 'Pending means no successful receipt has been confirmed yet. In Recent Activity, use Check receipt and keep the operation hash. Do not repeat the payment while it is pending. A mined revert is shown as failed, not paid. Activity is stored in this browser and is not a complete indexed wallet history.',
 'sponsorship': 'Gas sponsorship is optional and requires an active ZeroDev policy configured by the app owner. Enable Request gas sponsorship under Safeguards & sponsorship. Only an accepted paymaster operation shows sponsored. A refusal does not silently charge you; disable sponsorship and review a new self-funded estimate if you choose.',
 'reputation': 'The optional activity contract counts successful MON payments routed through it, capped at 100. Simulations and direct USDC transfers do not add points. Until the contract is deployed and configured, no on-chain score is claimed. It is not a safety rating, credit score, verified identity or ERC-8004 implementation.',
 'install': 'Open the deployed HTTPS app in your phone browser. On Android, use the browser menu → Install app or Add to Home Screen. On iPhone, open Safari → Share → Add to Home Screen. The offline screen cannot transact. Microphone and passkeys require browser/device support and permission.',
 'contacts': 'Open Saved contacts in the account card; on mobile, open the sidebar first. Add Father or Daughter with their verified full 0x address. Contacts stay in this browser. Names never authorize a transfer; every preview displays the actual address. I do not infer a family member’s wallet from their relationship to you.',
 'swaps': 'Only the MON-to-USDC demo pair is currently supported; other swap tokens require a verified contract and liquid DEX route. Default swaps are labelled Demo Mode: fictional quotes and a passkey approval, with no funds moved. The real DEX adapter is not a verified live route. MON and USDC transfers are separate and move actual testnet tokens. A conditional demo swap checks balance first and pauses before preparation.',
}

EXAMPLES = {
 'which tokens can i swap':'swaps', 'can i swap other tokens':'swaps', 'why did my balance not change':'swaps',
 'where can i see my usdc transfers':'usdc', 'where is my usdc':'usdc',
 'help':'capabilities', 'what can you do':'capabilities', 'what can i ask':'capabilities',
 'hello':'capabilities', 'hi':'capabilities', 'explain gas':'gas', 'what is gas':'gas',
 'explain wallet fees':'fees', 'why is the fee so high':'fees', 'what is a passkey':'passkeys',
 'how do passkeys work':'passkeys', 'is this real money':'testnet', 'where can i get test tokens':'testnet',
 'how do i send money to my father':'transfers', 'what is usdc':'usdc', 'is this safe':'safety',
 'why is my transaction pending':'pending', 'how does sponsorship work':'sponsorship',
 'what is the trust score':'reputation', 'how do i install this on my phone':'install',
 'how do i save a contact':'contacts', 'are swaps real':'swaps',
}
