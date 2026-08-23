import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../../src/ui/icons/codicon.css';
import '../../src/ui/theme/darkModern.css';
import { Popup } from './popup';
import { browserPopupClient } from './popupClient';
import './style.css';

const rootElement = document.querySelector<HTMLElement>('#root');

if (!rootElement) {
  throw new Error('DOCode popup root is missing.');
}

createRoot(rootElement).render(
  <StrictMode>
    <Popup client={browserPopupClient} />
  </StrictMode>,
);
