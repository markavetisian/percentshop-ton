import { useSyncExternalStore } from 'react';
import {
  TonConnectButton,
  UserRejectsError,
  useIsConnectionRestored,
  useTonAddress,
  useTonConnectUI,
  useTonWallet,
  type SendTransactionRequest,
} from '@tonconnect/ui-react';
import { Address, beginCell, external, storeMessage } from '@ton/core';
import { Buffer } from 'buffer';
import { DEMO_MODE, IS_TESTNET, net, PAYMENT_AMOUNT, TICKER } from './config';
import { shortenAddress, waitForTransaction, type ConfirmedTx } from './ton';

/** What the payment UI needs from a wallet. Implemented by TON Connect (real) and a simulated wallet (demo). */
export type Wallet = {
  ready: boolean;
  address: string;
  chain: string | null;
  disconnect: () => void;
  sendTransaction: (req: SendTransactionRequest) => Promise<{ boc: string }>;
  waitForTransaction: typeof waitForTransaction;
  isRejection: (e: unknown) => boolean;
};

// ─── Real: TON Connect ───────────────────────────────────────────────────────

function useTonConnectWallet(): Wallet {
  const [tonConnectUI] = useTonConnectUI();
  const ready = useIsConnectionRestored();
  const wallet = useTonWallet();
  const address = useTonAddress();

  return {
    ready,
    address,
    chain: wallet?.account.chain ?? null,
    disconnect: () => void tonConnectUI.disconnect(),
    sendTransaction: (req) => tonConnectUI.sendTransaction(req),
    waitForTransaction,
    isRejection: (e) => e instanceof UserRejectsError,
  };
}

// ─── Demo: simulated wallet, nothing leaves the browser ──────────────────────

class DemoRejection extends Error {}

type Pending =
  | { kind: 'connect' }
  | { kind: 'tx'; req: SendTransactionRequest; resolve: (r: { boc: string }) => void; reject: (e: Error) => void };

type DemoState = { address: string; pending: Pending | null; busy: boolean };

const DEMO_ADDRESS = Address.parseRaw(`0:${'5e'.repeat(32)}`).toString({ bounceable: false, testOnly: IS_TESTNET });

const demo = (() => {
  let state: DemoState = { address: '', pending: null, busy: false };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<DemoState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  return {
    subscribe: (l: () => void) => (listeners.add(l), () => listeners.delete(l)),
    get: () => state,
    openConnect: () => set({ pending: { kind: 'connect' } }),
    disconnect: () => set({ address: '', pending: null }),
    sendTransaction: (req: SendTransactionRequest) =>
      new Promise<{ boc: string }>((resolve, reject) => set({ pending: { kind: 'tx', req, resolve, reject } })),

    async approve() {
      const p = state.pending;
      if (!p) return;
      set({ busy: true });
      await sleep(700);
      if (p.kind === 'connect') {
        set({ address: DEMO_ADDRESS, pending: null, busy: false });
      } else {
        // A real external-in message cell, so the app's hashing path runs exactly as in production.
        const to = Address.parse(p.req.messages![0].address);
        const body = beginCell().storeUint(Date.now(), 64).endCell();
        const boc = beginCell().store(storeMessage(external({ to, body }))).endCell().toBoc().toString('base64');
        set({ pending: null, busy: false });
        p.resolve({ boc });
      }
    },
    reject() {
      const p = state.pending;
      set({ pending: null, busy: false });
      if (p?.kind === 'tx') p.reject(new DemoRejection('Rejected in demo wallet'));
    },

    async waitForTransaction(msgHash: string): Promise<ConfirmedTx> {
      await sleep(2200);
      const hash = beginCell().storeBuffer(Buffer.from(msgHash, 'hex')).endCell().hash().toString('hex');
      return { hash, success: true, timestamp: Math.floor(Date.now() / 1000) };
    },
  };
})();

function useDemoWallet(): Wallet {
  const { address } = useSyncExternalStore(demo.subscribe, demo.get);
  return {
    ready: true,
    address,
    chain: address ? net.chain : null,
    disconnect: demo.disconnect,
    sendTransaction: demo.sendTransaction,
    waitForTransaction: demo.waitForTransaction,
    isRejection: (e) => e instanceof DemoRejection,
  };
}

// ─── Mode switch (constant per page load, so hook order is stable) ───────────

export const useWallet: () => Wallet = DEMO_MODE ? useDemoWallet : useTonConnectWallet;

/** Big CTA shown while disconnected. */
export function ConnectButton() {
  if (!DEMO_MODE) return <TonConnectButton className="connect-cta" />;
  return (
    <button className="btn" onClick={demo.openConnect}>
      Connect Wallet
    </button>
  );
}

/** Header wallet menu shown once connected. */
export function HeaderWalletButton() {
  const { address } = useSyncExternalStore(demo.subscribe, demo.get);
  if (!DEMO_MODE) return <TonConnectButton />;
  return (
    <button className="wallet-chip" onClick={demo.disconnect} title="Disconnect">
      {shortenAddress(address, 4, 4)}
    </button>
  );
}

/** Bottom-sheet that stands in for the wallet app's approval screens. */
export function DemoWalletSheet() {
  const { pending, busy } = useSyncExternalStore(demo.subscribe, demo.get);
  if (!DEMO_MODE || !pending) return null;

  const isTx = pending.kind === 'tx';
  const to = isTx ? pending.req.messages![0].address : '';

  return (
    <div className="sheet-backdrop" onClick={() => !busy && demo.reject()}>
      <div className="sheet" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-app">
          <span className="logo">%</span>
          <div>
            <div className="sheet-title">{isTx ? 'Confirm transaction' : 'Connect to Percent Shop'}</div>
            <div className="muted small">Demo Wallet · {net.label}</div>
          </div>
        </div>

        {isTx ? (
          <dl className="rows">
            <div className="row">
              <dt>Amount</dt>
              <dd>
                {PAYMENT_AMOUNT} {TICKER}
              </dd>
            </div>
            <div className="row">
              <dt>Recipient</dt>
              <dd className="mono">{shortenAddress(to)}</dd>
            </div>
            <div className="row">
              <dt>Network fee</dt>
              <dd>≈ 0.0055 {TICKER}</dd>
            </div>
          </dl>
        ) : (
          <p className="muted">
            The app will see your wallet address <span className="mono">{shortenAddress(DEMO_ADDRESS)}</span>. It
            can't move funds without your approval.
          </p>
        )}

        <div className="sheet-actions">
          <button className="btn btn-ghost" disabled={busy} onClick={demo.reject}>
            Cancel
          </button>
          <button className="btn" disabled={busy} onClick={demo.approve}>
            {busy ? <span className="spinner" aria-hidden /> : isTx ? 'Confirm' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}
