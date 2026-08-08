import ReactDOM from 'react-dom/client';

import { PopupApp } from '@/src/ui/popup/popup-app';
import './style.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Lyra popup root container is missing.');
}

ReactDOM.createRoot(container).render(<PopupApp />);
