import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import './styles/tokens.css';
import './styles/globals.css';
import { ErrorBoundary } from './components/system/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(<ErrorBoundary><React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode></ErrorBoundary>);
