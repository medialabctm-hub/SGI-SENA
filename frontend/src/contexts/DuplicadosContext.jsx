import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { parseApiResponse } from '../utils/api'

const DuplicadosContext = createContext()

export function DuplicadosProvider({ children }) {
  const [tieneDuplicadosPendientes, setTieneDuplicadosPendientes] = useState(false)
  const [idImportacion, setIdImportacion] = useState(null)
  const [verificando, setVerificando] = useState(false)

  // Verificar si hay duplicados pendientes consultando la API
  const verificarDuplicadosPendientes = useCallback(async () => {
    if (!idImportacion) {
      setTieneDuplicadosPendientes(false)
      return
    }

    try {
      setVerificando(true)
      const token = localStorage.getItem('token')
      if (!token) {
        setTieneDuplicadosPendientes(false)
        return
      }

      const res = await fetch(`/api/import/duplicados?id_importacion=${encodeURIComponent(idImportacion)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (res.ok) {
        const data = await parseApiResponse(res, 'Error al verificar duplicados')
        const duplicadosPendientes = (data.duplicados || []).filter(d => d.estado === 'Pendiente')
        setTieneDuplicadosPendientes(duplicadosPendientes.length > 0)
      } else {
        setTieneDuplicadosPendientes(false)
      }
    } catch (error) {
      console.error('Error al verificar duplicados pendientes:', error)
      // En caso de error, no bloquear (mejor permitir que continúe)
      setTieneDuplicadosPendientes(false)
    } finally {
      setVerificando(false)
    }
  }, [idImportacion])

  // Verificar periódicamente si hay duplicados pendientes
  useEffect(() => {
    if (!idImportacion) {
      setTieneDuplicadosPendientes(false)
      return
    }

    // Verificar inmediatamente
    verificarDuplicadosPendientes()

    // Verificar cada 5 segundos mientras haya idImportacion
    const interval = setInterval(() => {
      verificarDuplicadosPendientes()
    }, 5000)

    return () => clearInterval(interval)
  }, [idImportacion, verificarDuplicadosPendientes])

  const establecerIdImportacion = (id) => {
    setIdImportacion(id)
  }

  const limpiarDuplicados = () => {
    setIdImportacion(null)
    setTieneDuplicadosPendientes(false)
  }

  return (
    <DuplicadosContext.Provider
      value={{
        tieneDuplicadosPendientes,
        idImportacion,
        establecerIdImportacion,
        limpiarDuplicados,
        verificarDuplicadosPendientes,
        verificando
      }}
    >
      {children}
    </DuplicadosContext.Provider>
  )
}

export function useDuplicados() {
  const context = useContext(DuplicadosContext)
  if (!context) {
    throw new Error('useDuplicados debe usarse dentro de DuplicadosProvider')
  }
  return context
}

