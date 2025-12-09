import React from 'react'
import { Navigate } from 'react-router-dom'
import { hashRouteSync } from '../utils/routeHash'

export default function RedirectIfAuth({ children }) {
  const token = localStorage.getItem('token')
  if (token) {
    const hashedRoute = hashRouteSync('/dashboard')
    return <Navigate to={hashedRoute} replace />
  }
  return children
}
