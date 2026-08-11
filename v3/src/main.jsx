import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import '@fontsource/lexend-deca/300.css'
import '@fontsource/lexend-deca/400.css'
import '@fontsource/lexend-deca/500.css'
import '@fontsource/lexend-deca/600.css'
import '@fontsource/lexend-deca/700.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
