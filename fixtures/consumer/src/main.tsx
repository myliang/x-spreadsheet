import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'tego-sheet/styles.css';
import { App } from './app';

const root = document.getElementById('root');
if (root === null) throw new Error('Missing consumer root');
createRoot(root).render(<StrictMode><App /></StrictMode>);
