import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { PrivateModeProvider } from './context/PrivateModeContext';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <PrivateModeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </PrivateModeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
