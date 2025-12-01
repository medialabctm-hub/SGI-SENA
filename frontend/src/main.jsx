import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SidebarProvider } from './contexts/SidebarContext'
import { LanguageProvider } from './contexts/LanguageContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <SidebarProvider>
          <App />
        </SidebarProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
)
