# Spoken replies

Enable the speaker button beside the microphone once per session. Typed and dictated requests then receive spoken replies. Stop and Replay controls appear beside it, together with the browser's available voice choices. The same controls are available inside the action preview.

There is no text-to-speech API key or paid provider integration. Browser SpeechSynthesis reads the text; voices and pronunciation depend on the device. Device voices are labelled in the selector. Some browser voices use an online service. Choosing a voice changes pronunciation; it does not translate the app's English answers.

Transfers read the amount and named recipient, ask the customer to verify the full address on screen, and describe the wallet fee cap. Swaps read the amount, estimated USDC and protected minimum. The spoken prompt asks for review and Confirm with Passkey. Speech cannot authorize, sign or submit a transaction. Read-only accounts receive a connection instruction rather than an authorization request; mock swaps explicitly say that no funds move.

Speech is cancelled before dictation, new requests, approval, cancellation, disconnect and a new conversation. Starting a new reply replaces queued audio. Playback failures have inline recovery guidance. Browser voice support is detected after mount to preserve server/client rendering consistency.

The source changes are local and are deployed to the existing Vercel frontend. Backend signing and transaction handling do not need a speech API or additional secrets.

Validation: 44 frontend unit tests and eight targeted desktop/mobile browser tests passed. The production speaker toggle and voice selector were checked with no page errors. Speech behavior was tested with a browser speech mock; audible output on a physical device still depends on its installed voices.
