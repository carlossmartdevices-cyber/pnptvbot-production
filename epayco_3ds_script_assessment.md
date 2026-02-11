The Epayco integration uses two main approaches:

1.  **Epayco Checkout.js (Hosted Checkout):**
    *   Files like `public/meet-greet-checkout.html` and `public/pnp-live-checkout.html` correctly include the official Epayco `checkout.js` script (`https://checkout.epayco.co/checkout.js`).
    *   This script is configured with `key: booking.epaycoPublicKey` and `test: booking.testMode`, and then `epaycoHandler.open(epaycoData)` is called.
    *   **Conclusion:** This is the correct and recommended way to integrate Epayco's hosted checkout, which handles 3DS authentication transparently within its flow (e.g., via a modal or redirection managed by the script itself). This part of the integration correctly uses the Epayco 3DS script.

2.  **API Integration with Server-Side Tokenization (`processTokenizedCharge`):**
    *   The backend function `PaymentService.processTokenizedCharge` (exposed via `/api/payment/tokenized-charge`) is designed for server-side processing, where card details are tokenized and a charge is initiated directly from the server.
    *   If Epayco determines that 3DS authentication is required for this type of transaction, `processTokenizedCharge` will return a `result.redirectUrl` (e.g., `urlbanco`) to the frontend.
    *   **Conclusion:** The backend correctly provides this `redirectUrl`. However, the specific client-side code that consumes this `redirectUrl` and performs the actual browser redirection for 3DS authentication is not directly visible in the `public/` files that implement `checkout.js`. This implies that `processTokenizedCharge` is likely used by a different frontend component or a more custom payment flow. To fully verify the 3DS script usage for *this* integration path, the frontend code that calls `/api/payment/tokenized-charge` and handles the `redirectUrl` would need to be inspected.

Based on the available information, the hosted checkout pages (`meet-greet-checkout.html`, `pnp-live-checkout.html`) are correctly using the official `checkout.js` script for 3DS handling. The backend API (`processTokenizedCharge`) also correctly signals when a 3DS redirect is needed, leaving the final redirection to the client-side.