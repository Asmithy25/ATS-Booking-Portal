import { createRoot } from 'react-dom/client';

import App from './App';
import { ThemeProvider } from './components/theme-provider';
import { setBaseUrl } from '@workspace/api-client-react';
import './index.css';
setBaseUrl(import.meta.env.VITE_API_URL ?? null);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', { scope: import.meta.env.BASE_URL })
      .catch(() => undefined);
  });
}

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
);
