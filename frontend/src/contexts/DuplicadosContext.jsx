import { createContext, useContext, useState } from 'react'
import BloqueoModal from '../components/BloqueoModal'

const DuplicadosContext = createContext()

export function DuplicadosProvider({ children }) {
  const [tieneDuplicadosPendientes, setTieneDuplicadosPendientes] = useState(false)
  const [modalBloqueoAbierto, setModalBloqueoAbierto] = useState(false)
  const [importacionEnCurso, setImportacionEnCurso] = useState(false)

  const establecerDuplicadosPendientes = (hayDuplicados) => {
    setTieneDuplicadosPendientes(hayDuplicados)
  }

  const limpiarDuplicados = () => {
    setTieneDuplicadosPendientes(false)
  }

  const mostrarModalBloqueo = () => {
    setModalBloqueoAbierto(true)
  }

  const cerrarModalBloqueo = () => {
    setModalBloqueoAbierto(false)
  }

  return (
    <DuplicadosContext.Provider
      value={{
        tieneDuplicadosPendientes,
        establecerDuplicadosPendientes,
        limpiarDuplicados,
        mostrarModalBloqueo,
        importacionEnCurso,
        setImportacionEnCurso
      }}
    >
      {children}
      <BloqueoModal isOpen={modalBloqueoAbierto} onClose={cerrarModalBloqueo} />
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

