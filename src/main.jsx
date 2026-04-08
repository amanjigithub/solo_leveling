import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/main.css'
import { GoogleOAuthProvider } from '@react-oauth/google';

// Polyfill for window.storage relying on localStorage
window.storage = {
    get: async (key) => {
        const val = localStorage.getItem(key);
        return val ? { value: val } : null;
    },
    set: async (key, value) => {
        localStorage.setItem(key, value);
    },
    delete: async (key) => {
        localStorage.removeItem(key);
    }
};

const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID_HERE";

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <App />
        </GoogleOAuthProvider>
    </React.StrictMode>,
)
