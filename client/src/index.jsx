import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
// Loaded last: the design tokens and surface overrides must win over the
// per-component stylesheets that the app pulls in through App.
import './styles/theme.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
