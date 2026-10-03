import './polyfills';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { THEME, TonConnectUIProvider } from '@tonconnect/ui-react';
import { App } from './App';
import { MANIFEST_URL } from './config';
import './index.css';

const ACCENT = '#0098EA';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TonConnectUIProvider
      manifestUrl={MANIFEST_URL}
      uiPreferences={{
        theme: THEME.DARK,
        borderRadius: 'm',
        colorsSet: {
          [THEME.DARK]: {
            accent: ACCENT,
            connectButton: { background: ACCENT, foreground: '#ffffff' },
            background: { primary: '#12151c', secondary: '#1a1e27' },
          },
        },
      }}
    >
      <App />
    </TonConnectUIProvider>
  </StrictMode>,
);
