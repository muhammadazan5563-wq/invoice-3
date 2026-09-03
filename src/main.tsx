import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import InvoiceLookup from './components/InvoiceLookup.tsx';
import InvoicePublicView from './components/InvoicePublicView.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/track" element={<InvoiceLookup />} />
        <Route path="/invoice/:invoiceId" element={<InvoicePublicView />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
