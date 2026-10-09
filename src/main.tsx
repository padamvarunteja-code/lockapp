import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register the service worker in production builds only (offline app shell).
// API traffic, WebSocket signaling, and APK downloads bypass it (see public/sw.js).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support is best-effort; the app works fine without it.
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
