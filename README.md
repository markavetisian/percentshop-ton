# Percent Shop · TON Connect payment demo

Minimal wallet-connect-and-pay flow on TON: connect a wallet with TON Connect, send 0.05 TON, and see the on-chain confirmation.

Stack: React 19 + Vite + TypeScript, `@tonconnect/ui-react` v3, `@ton/core` (hashing the transaction for confirmation lookup).

## Flow

1. **Connect Wallet** uses the official TON Connect button and modal (QR code, Tonkeeper, Telegram Wallet, and others).
2. Once connected, the card shows the shortened wallet address (`0QAb…xyz`). The official button moves to the header and becomes the wallet menu, which has Disconnect.
3. **Send Test Payment** sends a TON Connect `sendTransaction` request for 0.05 TON (50,000,000 nanoTON) to `VITE_RECIPIENT_ADDRESS`.
4. The wallet returns the signed message (a BoC). The app computes its [TEP-467](https://github.com/ton-blockchain/TEPs/blob/master/text/0467-normalized-message-hash.md) normalized hash, then polls TON Center until the transaction is on-chain (usually 5–15 s).
5. The success screen shows the tx hash, the time, and a link to Tonviewer.

Edge cases handled:
- The wallet is on the wrong network.
- The user declines in the wallet.
- The recipient address is missing or invalid.
- The transaction lands but fails on-chain.
- The indexer is slow (shows "sent, not indexed yet" with an explorer link).

## Setup

```bash
npm install
cp .env.example .env      # then set VITE_RECIPIENT_ADDRESS
npm run dev
```

| Variable | Required | Purpose |
|---|---|---|
| `VITE_RECIPIENT_ADDRESS` | yes | Wallet that receives the payment. Any format works; the app re-encodes it as non-bounceable for the active network. |
| `VITE_TONCONNECT_MANIFEST_URL` | no | Overrides the manifest URL. Defaults to `<origin>/tonconnect-manifest.json`. |
| `VITE_TONCENTER_API_KEY` | no | Raises the TON Center rate limit from 1 req/s. Get a key from [@tonapibot](https://t.me/tonapibot). |

## Testnet → mainnet

There's one line to change in `src/config.ts`:

```ts
export const NETWORK: 'testnet' | 'mainnet' = 'testnet';
```

The chain ID sent to wallets, the TON Center endpoint, the explorer links, address formatting, and the network badge all follow from it. When you switch, also set `VITE_RECIPIENT_ADDRESS` to a wallet you control on mainnet.

## The manifest must be publicly reachable

The **wallet** downloads `tonconnect-manifest.json`, not your browser. A phone can't reach `localhost`, so connecting fails with a "manifest" error until the file is on public HTTPS. Two ways to fix that:

- **Deploy first (recommended).** Push to Vercel or Netlify, then edit `public/tonconnect-manifest.json`:
  ```json
  {
    "url": "https://your-app.vercel.app",
    "name": "Percent Shop TON Demo",
    "iconUrl": "https://your-app.vercel.app/icon.png"
  }
  ```
  `url` must match where the app is served. `iconUrl` must be a PNG (180×180 is ideal); `public/icon.png` is a ready-made placeholder.
- **Tunnel for local dev.** Run `npx cloudflared tunnel --url http://localhost:5173` (or ngrok), open the `https://…trycloudflare.com` URL, and put that URL in the manifest.

## Get a testnet wallet and test TON

### 1. Tonkeeper testnet account
- **Mobile (iOS/Android):** Settings → scroll to the bottom → tap the Tonkeeper logo/version 5–7 times to open the Dev Menu. Then go to **Add Wallet → For developers → Testnet Account** and import a recovery phrase. A fresh throwaway phrase is safest; using your main phrase gives a separate testnet balance, but there's no reason to expose it.
- **Desktop/extension:** same idea. Tap the logo in Settings repeatedly to reveal the dev options, then add a testnet account.
- The wallet now shows a **TESTNET** badge, and its address starts with `0Q…` or `kQ…`. Copy it.

You need **two** testnet addresses: the payer (the Tonkeeper account above) and the recipient (`VITE_RECIPIENT_ADDRESS`). Create a second testnet account in Tonkeeper for the recipient, or reuse the payer address and pay yourself. Paying yourself works, but the demo is clearer with two.

### 2. Faucet
- Open [@testgiver_ton_bot](https://t.me/testgiver_ton_bot) in Telegram → **Get 2 GRAM in testnet** → solve the captcha → paste your testnet address. That's 2 test coins, repeatable every hour, which covers about 35 demo payments after fees.
- Check arrival at `https://testnet.tonviewer.com/<your-address>`.

### 3. Run the flow
1. Set `VITE_RECIPIENT_ADDRESS` and make the manifest reachable (see above).
2. Open the app → **Connect Wallet** → scan the QR code with Tonkeeper (testnet account selected).
3. **Send Test Payment** → approve in Tonkeeper → watch it go from "Confirming on-chain…" to "Payment confirmed".

## Recording tips

- Fund the payer with ≥ 0.2 test TON so fees never cause a failure on camera.
- Do one dry run first. The first transaction from a brand-new wallet also deploys the wallet contract, which costs slightly more.
- For a desktop recording, put Tonkeeper's QR scan on your phone and record the browser screen.
