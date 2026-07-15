import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'tego-sheet/styles.css';
import { ScenarioHost } from './scenario-host';

const root = document.querySelector('#root');
if (root === null) throw new Error('Browser harness root is missing');

createRoot(root).render(
  <StrictMode>
    <ScenarioHost />
  </StrictMode>,
);
