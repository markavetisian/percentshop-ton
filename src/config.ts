import { CHAIN } from '@tonconnect/ui-react';
import { Address, toNano } from '@ton/core';

// ─── Switch networks here. 'testnet' → 'mainnet' is the only change needed to go live. ───
export const NETWORK: 'testnet' | 'mainnet' = 'testnet';

const NETWORKS = {
  testnet: {
    label: 'Testnet',
    chain: CHAIN.TESTNET,
    toncenter: 'https://testnet.toncenter.com',
    explorer: 'https://testnet.tonviewer.com',
  },
  mainnet: {
    label: 'Mainnet',
    chain: CHAIN.MAINNET,
    toncenter: 'https://toncenter.com',
    explorer: 'https://tonviewer.com',
  },
} as const;

export const net = NETWORKS[NETWORK];
export const IS_TESTNET = NETWORK === 'testnet';

// Toncoin was renamed Gram (GRAM) on 2026-06-15; wallets now display GRAM. Change here to match.
export const TICKER = 'TON';
export const PAYMENT_AMOUNT = '0.05';
export const PAYMENT_NANO = toNano(PAYMENT_AMOUNT).toString(); // "50000000" nano

export const MANIFEST_URL =
  import.meta.env.VITE_TONCONNECT_MANIFEST_URL || `${window.location.origin}/tonconnect-manifest.json`;

export const TONCENTER_API_KEY: string | undefined = import.meta.env.VITE_TONCENTER_API_KEY || undefined;

/**
 * Recipient from VITE_RECIPIENT_ADDRESS, re-encoded as non-bounceable for the active network.
 * Non-bounceable matters: a fresh wallet that has never sent a tx is uninitialized, and a
 * bounceable transfer to it would bounce straight back to the sender.
 */
export const RECIPIENT: { address: string } | { error: string } = (() => {
  const raw = (import.meta.env.VITE_RECIPIENT_ADDRESS ?? '').trim();
  if (!raw) return { error: 'VITE_RECIPIENT_ADDRESS is not set. Add it to .env and restart the dev server.' };
  try {
    return { address: Address.parse(raw).toString({ bounceable: false, testOnly: IS_TESTNET }) };
  } catch {
    return { error: `VITE_RECIPIENT_ADDRESS is not a valid TON address: "${raw}"` };
  }
})();
