// SIDE QUEST Online Store — entry point.
// Order matters: config → data layer → view helpers → backend selector → UI.
import './config/runtime-config.js';
import './data/seed-products.js';
import './services/store-service.js';
import './services/supabase-store-service.js';
import './lib/view-helpers.js';
import './services/index.js';
import './styles/modernist.css';
import './styles/app.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import StoreApp from './components/StoreApp.jsx';

// No <React.StrictMode>: it double-runs mount effects in development, which would
// double-subscribe the store (the Phase 1 crash). Production behavior is identical.
createRoot(document.getElementById('root')).render(<StoreApp />);
