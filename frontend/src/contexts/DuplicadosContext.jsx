import { createContext, useContext, useState } from 'react'

const DuplicadosContext = createContext()

export function DuplicadosProvider({ children }) {
  const [tieneDuplicadosPendientes, setTieneDuplicadosPendientes] = useState(false)

  const establecerDuplicadosPendientes = (hayDuplicados) => {
    console.log('🔴 Estableciendo duplicados pendientes:', hayDuplicados)
    setTieneDuplicadosPendientes(hayDuplicados)
  }

  const limpiarDuplicados = () => {
    console.log('✅ Limpiando duplicados pendientes')
    setTieneDuplicadosPendientes(false)
  }

  return (
    <DuplicadosContext.Provider
      value={{
        tieneDuplicadosPendientes,
        establecerDuplicadosPendientes,
        limpiarDuplicados
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

