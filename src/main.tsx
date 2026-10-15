import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initFirebase } from './lib/firebase';

async function bootstrap() {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    throw new Error('Root element #root not found');
  }

  const root = createRoot(rootEl);

  try {
    await initFirebase();
    root.render(<App />);
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    const message = error instanceof Error ? error.message : String(error);
    root.render(
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
          background: '#0f172a',
          color: '#e2e8f0',
        }}
      >
        <div style={{ maxWidth: 520 }}>
          <h1 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>
            Firebase configuration error
          </h1>
          <p style={{ lineHeight: 1.5, opacity: 0.9 }}>{message}</p>
          <p style={{ marginTop: '1rem', fontSize: '0.875rem', opacity: 0.7 }}>
            Confirm Cloud Run env vars are set and{' '}
            <code>/api/config/firebase</code> returns a valid apiKey.
          </p>
        </div>
      </div>
    );
  }
}

bootstrap();
