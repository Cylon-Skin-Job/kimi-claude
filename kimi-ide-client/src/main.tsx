import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './components/App';

// Import highlight.js for code blocks
import hljs from 'highlight.js';

// Make hljs available globally for the app
(window as any).hljs = hljs;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
