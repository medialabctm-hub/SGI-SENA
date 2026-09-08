import React, { createContext, useContext, useState, useEffect } from 'react'
import { parseApiResponse } from '../utils/api'

const LanguageContext = createContext()

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage debe usarse dentro de LanguageProvider')
  }
  return context
}

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('es')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLanguage()
  }, [])

  const loadLanguage = async () => {
    try {
      const user = localStorage.getItem('user');
      if (!user) {
        setLanguage('es')
        setLoading(false)
        return
      }

      const res = await fetch('/api/preferences', {
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })

      if (res.ok) {
        const data = await parseApiResponse(res, 'Error al cargar idioma')
        if (data.app?.idioma) {
          setLanguage(data.app.idioma)
        }
      }
    } catch (error) {
      console.error('Error al cargar idioma:', error)
      setLanguage('es') // Idioma por defecto
    } finally {
      setLoading(false)
    }
  }

  const updateLanguage = (newLanguage) => {
    setLanguage(newLanguage)
  }

  return (
    <LanguageContext.Provider value={{ language, updateLanguage, loading }}>
      {children}
    </LanguageContext.Provider>
  )
}

