import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  CHAIN,
  TonConnectButton,
  UserRejectsError,
  useIsConnectionRestored,
  useTonAddress,
  useTonConnectUI,
  useTonWallet,
} from '@tonconnect/ui-react';
import { net, PAYMENT_NANO, PAYMENT_AMOUNT, RECIPIENT, TICKER } from './config';
import {
  explorerAddressUrl,
  explorerTxUrl,
  normalizedMessageHash,
  shortenAddress,
  waitForTransaction,
  type ConfirmedTx,
} from './ton';

type Status =
  | { kind: 'idle' }
  | { kind: 'signing' }
  | { kind: 'confirming'; msgHash: string }
  | { kind: 'confirmed'; tx: ConfirmedTx }
  | { kind: 'unconfirmed'; msgHash: string }
  | { kind: 'error'; message: string };

export function App() {
  const [tonConnectUI] = useTonConnectUI();
  const restored = useIsConnectionRestored();
  const wallet = useTonWallet();
  const address = useTonAddress();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  // Ask wallets to connect on our network. Throws if a session is already live, which is fine.
  useEffect(() => {
    if (!restored || tonConnectUI.connected) return;
    try {
      tonConnectUI.setConnectionNetwork(net.chain);
    } catch {
      /* already connected */
    }
  }, [restored, tonConnectUI, wallet]);

  // Reset the flow whenever the wallet changes or disconnects.
  useEffect(() => {
    abortRef.current?.abort();
    setStatus({ kind: 'idle' });
  }, [address]);

  const wrongNetwork = !!wallet && wallet.account.chain !== net.chain;

  async function pay() {
    if ('error' in RECIPIENT) return;
    setStatus({ kind: 'signing' });
    try {
      const { boc } = await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 5 * 60,
        network: net.chain,
        messages: [{ address: RECIPIENT.address, amount: PAYMENT_NANO }],
      });

      const msgHash = normalizedMessageHash(boc);
      setStatus({ kind: 'confirming', msgHash });

      const abort = (abortRef.current = new AbortController());
      try {
        const tx = await waitForTransaction(msgHash, { signal: abort.signal });
        setStatus(
          tx.success
            ? { kind: 'confirmed', tx }
            : { kind: 'error', message: 'Transaction landed on-chain but failed. Check the wallet balance.' },
        );
      } catch {
        if (!abort.signal.aborted) setStatus({ kind: 'unconfirmed', msgHash });
      }
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof UserRejectsError ? 'Request was declined in the wallet.' : errorMessage(e),
      });
    }
  }

  return (
    <div className="page">
      <header className="header">
        <div className="brand">
          <span className="logo">%</span>
          <span>Percent Shop</span>
        </div>
        <div className="header-right">
          <span className="pill">{net.label}</span>
          {/* Single official button: centered CTA while disconnected, wallet menu in the header once connected. */}
          {wallet && <TonConnectButton />}
        </div>
      </header>

      <main className="main">
        <section className="card">
          {status.kind === 'confirmed' ? (
            <Success tx={status.tx} onReset={() => setStatus({ kind: 'idle' })} />
          ) : (
            <>
              <p className="eyebrow">Test payment</p>
              <h1 className="amount">
                {PAYMENT_AMOUNT} <span>{TICKER}</span>
              </h1>

              <dl className="rows">
                <div className="row">
                  <dt>From</dt>
                  <dd className="mono">{address ? shortenAddress(address) : '—'}</dd>
                </div>
                <div className="row">
                  <dt>To</dt>
                  <dd className="mono">{'address' in RECIPIENT ? shortenAddress(RECIPIENT.address) : '—'}</dd>
                </div>
                <div className="row">
                  <dt>Network</dt>
                  <dd>TON {net.label}</dd>
                </div>
              </dl>

              {'error' in RECIPIENT ? (
                <Notice tone="error">{RECIPIENT.error}</Notice>
              ) : !restored ? (
                <button className="btn" disabled>
                  Loading…
                </button>
              ) : !wallet ? (
                <TonConnectButton className="connect-cta" />
              ) : wrongNetwork ? (
                <>
                  <Notice tone="error">
                    Your wallet is connected on {wallet.account.chain === CHAIN.MAINNET ? 'Mainnet' : 'another network'}.
                    Switch it to {net.label} and reconnect.
                  </Notice>
                  <button className="btn btn-ghost" onClick={() => tonConnectUI.disconnect()}>
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  className="btn"
                  onClick={pay}
                  disabled={status.kind === 'signing' || status.kind === 'confirming'}
                >
                  {status.kind === 'signing' ? (
                    <>
                      <Spinner /> Confirm in wallet…
                    </>
                  ) : status.kind === 'confirming' ? (
                    <>
                      <Spinner /> Confirming on-chain…
                    </>
                  ) : (
                    'Send Test Payment'
                  )}
                </button>
              )}

              {status.kind === 'error' && <Notice tone="error">{status.message}</Notice>}
              {status.kind === 'unconfirmed' && (
                <Notice tone="info">
                  Sent, but not indexed yet. Check{' '}
                  <a href={explorerAddressUrl(address)} target="_blank" rel="noreferrer">
                    your wallet on the explorer
                  </a>
                  .<br />
                  <span className="mono small">msg {shortenAddress(status.msgHash, 8, 8)}</span>
                </Notice>
              )}
            </>
          )}
        </section>
      </main>

      <footer className="footer">Powered by TON Connect</footer>
    </div>
  );
}

function Success({ tx, onReset }: { tx: ConfirmedTx; onReset: () => void }) {
  return (
    <div className="success">
      <div className="check" aria-hidden>
        <svg viewBox="0 0 24 24" width="32" height="32">
          <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2>Payment confirmed</h2>
      <p className="muted">
        {PAYMENT_AMOUNT} {TICKER} sent on {net.label}
      </p>

      <dl className="rows">
        <div className="row">
          <dt>Tx hash</dt>
          <dd className="mono">{shortenAddress(tx.hash, 8, 8)}</dd>
        </div>
        <div className="row">
          <dt>Time</dt>
          <dd>{new Date(tx.timestamp * 1000).toLocaleTimeString()}</dd>
        </div>
      </dl>

      <a className="btn" href={explorerTxUrl(tx.hash)} target="_blank" rel="noreferrer">
        View on Tonviewer ↗
      </a>
      <button className="btn btn-ghost" onClick={onReset}>
        Send another
      </button>
    </div>
  );
}

function Notice({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  return <div className={`notice notice-${tone}`}>{children}</div>;
}

function Spinner() {
  return <span className="spinner" aria-hidden />;
}

function errorMessage(e: unknown): string {
  if (e instanceof Error && e.message) return e.message.replace(/^\[TON_CONNECT_SDK_ERROR\]\s*/, '');
  return 'Something went wrong. Try again.';
}
