
import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Equipos from './pages/Equipos'
import Usuarios from './pages/Usuarios'
import Config from './pages/Config'
import ProtectedRoute from './components/ProtectedRoute'
import RedirectIfAuth from './components/RedirectIfAuth'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={
        <RedirectIfAuth>
          <Login />
        </RedirectIfAuth>
      } />
      <Route path="/register" element={
        <RedirectIfAuth>
          <Register />
        </RedirectIfAuth>
      } />
      <Route path="/" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/equipos" element={
        <ProtectedRoute>
          <Equipos />
        </ProtectedRoute>
      } />
      <Route path="/usuarios" element={
        <ProtectedRoute>
          <Usuarios />
        </ProtectedRoute>
      } />
      <Route path="/config" element={
        <ProtectedRoute>
          <Config />
        </ProtectedRoute>
      } />
    </Routes>
  )
}
