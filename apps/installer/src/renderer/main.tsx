import React from 'react';
import ReactDOM from 'react-dom/client';
import { InstallerApp } from './InstallerApp';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <InstallerApp />
  </React.StrictMode>
);
