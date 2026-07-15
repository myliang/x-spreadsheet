import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'tego-sheet/styles.css';
import { App } from './app';
import './demo.css';

const root = document.getElementById('root');
if (root === null) throw new Error('Demo root is missing');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
