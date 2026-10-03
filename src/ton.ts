import { beginCell, Cell, loadMessage, storeMessage, type Message } from '@ton/core';
import { net, TONCENTER_API_KEY } from './config';

export function shortenAddress(address: string, head = 6, tail = 4): string {
  return address.length <= head + tail + 3 ? address : `${address.slice(0, head)}…${address.slice(-tail)}`;
}

/**
 * TON Connect returns the signed external-in message, not a tx hash.
 * Indexers key it by the TEP-467 normalized hash: src/import_fee/init stripped, body forced into a ref.
 */
export function normalizedMessageHash(boc: string): string {
  const message = loadMessage(Cell.fromBase64(boc).beginParse());
  if (message.info.type !== 'external-in') {
    throw new Error(`Expected external-in message, got ${message.info.type}`);
  }
  const normalized: Message = {
    ...message,
    init: null,
    info: { ...message.info, src: undefined, importFee: 0n },
  };
  return beginCell().store(storeMessage(normalized, { forceRef: true })).endCell().hash().toString('hex');
}

export type ConfirmedTx = { hash: string; success: boolean; timestamp: number };

type ToncenterTx = {
  hash: string;
  now: number;
  description?: { aborted?: boolean; compute_ph?: { success?: boolean } };
};

/** Polls TON Center until the transaction that consumed `msgHash` lands on-chain. */
export async function waitForTransaction(
  msgHash: string,
  { timeoutMs = 120_000, intervalMs = 3_000, signal }: { timeoutMs?: number; intervalMs?: number; signal?: AbortSignal } = {},
): Promise<ConfirmedTx> {
  const url = `${net.toncenter}/api/v3/transactionsByMessage?msg_hash=${msgHash}&direction=in&limit=1`;
  const headers: HeadersInit = TONCENTER_API_KEY ? { 'X-API-Key': TONCENTER_API_KEY } : {};
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    try {
      const res = await fetch(url, { headers, signal });
      if (res.ok) {
        const { transactions } = (await res.json()) as { transactions?: ToncenterTx[] };
        const tx = transactions?.[0];
        if (tx) {
          return {
            hash: base64ToHex(tx.hash),
            success: !tx.description?.aborted && tx.description?.compute_ph?.success !== false,
            timestamp: tx.now,
          };
        }
      }
      // 404 / 429 / empty list just mean "not indexed yet" or "slow down" — keep polling.
    } catch (e) {
      if (signal?.aborted) throw e;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Timed out waiting for confirmation');
}

function base64ToHex(b64: string): string {
  if (/^[0-9a-f]{64}$/i.test(b64)) return b64.toLowerCase();
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  return Array.from(bin, (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}

export const explorerTxUrl = (hash: string) => `${net.explorer}/transaction/${hash}`;
export const explorerAddressUrl = (address: string) => `${net.explorer}/${address}`;
