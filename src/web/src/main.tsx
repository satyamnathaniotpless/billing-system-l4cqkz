import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';
import { registerServiceWorker } from 'workbox-core';
import { store } from './store';
import App from './App';

// Import global styles
import './assets/styles/global.css';
import './assets/styles/theme.css';
import './assets/styles/typography.css';
import './assets/styles/layout.css';

// Environment flags
const isDevelopment = process.env.NODE_ENV === 'development';
const PERFORMANCE_MONITOR_ENABLED = process.env.REACT_APP_PERFORMANCE_MONITOR_ENABLED === 'true';
const ERROR_TRACKING_ENABLED = process.env.REACT_APP_ERROR_TRACKING_ENABLED === 'true';

/**
 * Error fallback component for the error boundary
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" style={{ padding: '20px', textAlign: 'center' }}>
    <h2>Something went wrong</h2>
    <pre style={{ color: 'red' }}>{error.message}</pre>
    <button onClick={() => window.location.reload()}>Refresh Page</button>
  </div>
);

/**
 * Initializes application prerequisites before rendering
 */
const initializeApp = async (): Promise<void> => {
  // Initialize performance monitoring if enabled
  if (PERFORMANCE_MONITOR_ENABLED) {
    const { performance, PerformanceObserver } = await import('perf-hooks');
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        console.log(`${entry.name}: ${entry.duration}ms`);
      });
    });
    observer.observe({ entryTypes: ['measure'] });
    performance.mark('app-init-start');
  }

  // Register service worker for offline capabilities
  if ('serviceWorker' in navigator && !isDevelopment) {
    try {
      await registerServiceWorker();
      console.log('Service Worker registered successfully');
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  // Initialize error tracking if enabled
  if (ERROR_TRACKING_ENABLED) {
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
    });
  }
};

/**
 * Main function that renders the React application to the DOM
 */
const renderApp = async (): Promise<void> => {
  await initializeApp();

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  // Create root with type safety
  const root = ReactDOM.createRoot(rootElement);

  // Start performance measurement
  if (PERFORMANCE_MONITOR_ENABLED) {
    performance.mark('render-start');
  }

  root.render(
    <React.StrictMode>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onError={(error) => {
          console.error('Error caught by boundary:', error);
        }}
      >
        <Provider store={store}>
          <ThemeProvider theme={store.getState().theme}>
            <App />
          </ThemeProvider>
        </Provider>
      </ErrorBoundary>
    </React.StrictMode>
  );

  // End performance measurement
  if (PERFORMANCE_MONITOR_ENABLED) {
    performance.mark('render-end');
    performance.measure('app-render', 'render-start', 'render-end');
  }
};

// Initialize and render the application
renderApp().catch((error) => {
  console.error('Failed to render application:', error);
  document.getElementById('root')?.innerHTML = `
    <div style="padding: 20px; text-align: center;">
      <h1>Application Failed to Load</h1>
      <p>Please try refreshing the page. If the problem persists, contact support.</p>
    </div>
  `;
});

// Enable hot module replacement in development
if (isDevelopment && module.hot) {
  module.hot.accept('./App', () => {
    console.log('Hot reloading App component');
    renderApp();
  });
}