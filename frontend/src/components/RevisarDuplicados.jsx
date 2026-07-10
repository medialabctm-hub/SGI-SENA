import { useState, useEffect } from 'react'
import { FiCheck, FiX, FiAlertCircle, FiCheckCircle, FiClock, FiSave } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage, handleError } from '../utils/api'
import { useDuplicados } from '../contexts/DuplicadosContext'
import InfoModal from './InfoModal'
import '../styles/pages/verificaciones.css'

export default function RevisarDuplicados({ idImportacion, onProcesarCompleto }) {
  const { limpiarDuplicados } = useDuplicados()
  const [duplicados, setDuplicados] = useState([])
  const [loading, setLoading] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState(null)
  const [decisiones, setDecisiones] = useState({}) // { id_duplicado: 'aprobar' | 'rechazar' }
  const [procesandoId, setProcesandoId] = useState(null)
  const [infoModal, setInfoModal] = useState({ open: false, message: '', title: '' })

  useEffect(() => {
    if (idImportacion) {
      cargarDuplicados()
    }
  }, [idImportacion])

  const cargarDuplicados = async () => {
    try {
      setLoading(true)
      setError(null)
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/import/duplicados?id_importacion=${encodeURIComponent(idImportacion)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'Error al cargar duplicados')
      const duplicadosPendientes = (data.duplicados || []).filter(d => d.estado === 'Pendiente')
      setDuplicados(duplicadosPendientes)
    } catch (err) {
      handleError(err, (errObj) => setError(typeof errObj === 'string' ? errObj : errObj?.message ?? 'Error al cargar duplicados'), 'Error al cargar duplicados')
    } finally {
      setLoading(false)
    }
  }

  const tomarDecision = (idDuplicado, accion) => {
    setDecisiones(prev => ({
      ...prev,
      [idDuplicado]: accion
    }))
  }

  const procesarIndividual = async (idDuplicado, accion) => {
    if (!accion) return

    try {
      setProcesandoId(idDuplicado)
      setError(null)
      const token = localStorage.getItem('token')
      const res = await fetch('/api/import/duplicados/procesar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          id_duplicado: idDuplicado,
          accion
        })
      })
      const data = await parseApiResponse(res, 'Error al procesar duplicado')
      
      // Remover el duplicado procesado de la lista
      setDuplicados(prev => {
        const nuevos = prev.filter(d => d.id_duplicado !== idDuplicado)
        // Si ya no quedan duplicados pendientes, notificar al componente padre
        if (nuevos.length === 0 && onProcesarCompleto) {
          // Pequeño delay para que el usuario vea el mensaje de éxito
          setTimeout(() => {
            onProcesarCompleto()
          }, 500)
        }
        return nuevos
      })
      setDecisiones(prev => {
        const nuevas = { ...prev }
        delete nuevas[idDuplicado]
        return nuevas
      })
    } catch (err) {
      handleError(err, (errObj) => setError(typeof errObj === 'string' ? errObj : errObj?.message ?? 'Error al procesar duplicado'), 'Error al procesar duplicado')
    } finally {
      setProcesandoId(null)
    }
  }

  const procesarMasivo = async () => {
    const decisionesArray = Object.entries(decisiones)
      .filter(([_, accion]) => accion)
      .map(([id_duplicado, accion]) => ({ id_duplicado: parseInt(id_duplicado), accion }))

    if (decisionesArray.length === 0) {
      setError('Debes tomar al menos una decisión antes de procesar')
      return
    }

    try {
      setProcesando(true)
      setError(null)
      const token = localStorage.getItem('token')
      const res = await fetch('/api/import/duplicados/procesar-masivo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ decisiones: decisionesArray })
      })
      const data = await parseApiResponse(res, 'Error al procesar duplicados')
      
      // Remover duplicados procesados
      const idsProcesados = decisionesArray.map(d => d.id_duplicado)
      setDuplicados(prev => {
        const nuevos = prev.filter(d => !idsProcesados.includes(d.id_duplicado))
        // Si ya no quedan duplicados pendientes, notificar al componente padre
        if (nuevos.length === 0 && onProcesarCompleto) {
          // Pequeño delay para que el usuario vea el mensaje de éxito
          setTimeout(() => {
            onProcesarCompleto()
          }, 500)
        }
        return nuevos
      })
      setDecisiones({})
      
      setInfoModal({
        open: true,
        message: `Procesados: ${data.resultados.aprobados} aprobados, ${data.resultados.rechazados} rechazados`,
        title: 'Procesamiento completado'
      })
    } catch (err) {
      handleError(err, (errObj) => setError(typeof errObj === 'string' ? errObj : errObj?.message ?? 'Error al procesar duplicados'), 'Error al procesar duplicados')
    } finally {
      setProcesando(false)
    }
  }

  const formatearValor = (valor) => {
    if (valor === null || valor === undefined || valor === '') return 'N/A'
    if (typeof valor === 'boolean') return valor ? 'Sí' : 'No'
    if (typeof valor === 'number') {
      // Si es un valor monetario
      if (valor > 1000) {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(valor)
      }
      return valor.toString()
    }
    return String(valor)
  }

  const compararValores = (valorBD, valorExcel) => {
    const bd = formatearValor(valorBD)
    const excel = formatearValor(valorExcel)
    return bd === excel
  }

  if (loading) {
    return (
      <div className="revisar-duplicados-loading">
        <div className="loading-spinner revisar-duplicados-loading-spinner"></div>
        <p className="revisar-duplicados-loading-text">Cargando duplicados...</p>
      </div>
    )
  }

  if (duplicados.length === 0) {
    return (
      <div className="revisar-duplicados-empty">
        <FiCheckCircle size={32} className="revisar-duplicados-empty-icon" />
        <p className="revisar-duplicados-empty-text">No hay duplicados pendientes de revisión</p>
      </div>
    )
  }

  return (
    <div className="revisar-duplicados-container">
      <div className="revisar-duplicados-warning">
        <FiAlertCircle size={20} className="revisar-duplicados-warning-icon" />
        <div className="revisar-duplicados-warning-content">
          <strong>Duplicados pendientes de revisión</strong>
          <p className="revisar-duplicados-warning-text">
            Se encontraron {duplicados.length} registro(s) con placas duplicadas. 
            Compara la información y decide si aprobar o rechazar cada uno.
          </p>
        </div>
      </div>

      {error && (
        <div className="revisar-duplicados-error">
          <FiAlertCircle size={20} />
          {error}
        </div>
      )}

      {duplicados.map((duplicado) => {
        const datosBD = duplicado.datos_bd
        const datosExcel = duplicado.datos_excel
        const decision = decisiones[duplicado.id_duplicado]

        // Campos a comparar
        const campos = [
          { key: 'placa', label: 'Placa' },
          { key: 'tipo', label: 'Tipo' },
          { key: 'marca', label: 'Marca' },
          { key: 'modelo', label: 'Modelo' },
          { key: 'consecutivo', label: 'Consecutivo' },
          { key: 'descripcion', label: 'Descripción' },
          { key: 'fecha_adquisicion', label: 'Fecha Adquisición' },
          { key: 'valor_ingreso', label: 'Valor Ingreso' },
          { key: 'vida_util_meses', label: 'Vida Útil (meses)' },
          { key: 'estado_fisico', label: 'Estado Físico' },
          { key: 'r_centro', label: 'Centro' },
          { key: 'categoria', label: 'Categoría' },
          { key: 'ambiente', label: 'Ambiente' }
        ]

        return (
          <div
            key={duplicado.id_duplicado}
            className={`revisar-duplicados-duplicado-card ${
              decision === 'aprobar' ? 'aprobado' : 
              decision === 'rechazar' ? 'rechazado' : ''
            }`}
          >
            <div className={`revisar-duplicados-duplicado-header ${
              decision === 'aprobar' ? 'aprobado' : 
              decision === 'rechazar' ? 'rechazado' : ''
            }`}>
              <div>
                <strong>Fila {duplicado.fila_excel} - Placa: {duplicado.placa}</strong>
                <p className="revisar-duplicados-duplicado-info">
                  Equipo existente: Código #{datosBD.codigo_equipo}
                </p>
              </div>
              {decision && (
                <div className={`revisar-duplicados-decision-badge ${
                  decision === 'rechazar' ? 'rechazado' : ''
                }`}>
                  {decision === 'aprobar' ? <FiCheckCircle size={16} /> : <FiX size={16} />}
                  {decision === 'aprobar' ? 'Aprobado' : 'Rechazado'}
                </div>
              )}
            </div>

            <div className="revisar-duplicados-table-wrapper">
              <table className="revisar-duplicados-table">
                <thead>
                  <tr>
                    <th className="revisar-duplicados-table th">Campo</th>
                    <th className="revisar-duplicados-table th bd">Registro Existente (BD)</th>
                    <th className="revisar-duplicados-table th excel">Registro del Excel</th>
                    <th className="revisar-duplicados-table th coincide">Coincide</th>
                  </tr>
                </thead>
                <tbody>
                  {campos.map((campo) => {
                    const valorBD = datosBD[campo.key]
                    const valorExcel = datosExcel[campo.key]
                    const coincide = compararValores(valorBD, valorExcel)

                    return (
                      <tr key={campo.key}>
                        <td className="revisar-duplicados-table td campo">{campo.label}</td>
                        <td className={`revisar-duplicados-table td ${coincide ? 'coincide-si' : 'coincide-no'}`}>
                          {formatearValor(valorBD)}
                        </td>
                        <td className={`revisar-duplicados-table td ${coincide ? 'coincide-si' : 'coincide-no'}`}>
                          {formatearValor(valorExcel)}
                        </td>
                        <td className="revisar-duplicados-table td coincide">
                          {coincide ? (
                            <FiCheckCircle size={18} className="revisar-duplicados-icon-check" />
                          ) : (
                            <FiX size={18} className="revisar-duplicados-icon-x" />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="revisar-duplicados-actions">
              <button
                onClick={() => tomarDecision(duplicado.id_duplicado, 'rechazar')}
                disabled={procesandoId === duplicado.id_duplicado}
                className={`duplicado-btn-rechazar ${decision === 'rechazar' ? 'selected' : ''}`}
              >
                <FiX size={16} />
                Rechazar
              </button>
              <button
                onClick={() => tomarDecision(duplicado.id_duplicado, 'aprobar')}
                disabled={procesandoId === duplicado.id_duplicado}
                className={`duplicado-btn-aprobar ${decision === 'aprobar' ? 'selected' : ''}`}
              >
                <FiCheckCircle size={16} />
                Aprobar
              </button>
              {decision && (
                <button
                  onClick={() => procesarIndividual(duplicado.id_duplicado, decision)}
                  disabled={procesandoId === duplicado.id_duplicado}
                  className="duplicado-btn-confirmar"
                >
                  {procesandoId === duplicado.id_duplicado ? (
                    <>
                      <div className="loading-spinner revisar-duplicados-spinner-small"></div>
                      Procesando...
                    </>
                  ) : (
                    <>
                      <FiSave size={16} />
                      Confirmar
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )
      })}

      {Object.keys(decisiones).length > 0 && (
        <div className="revisar-duplicados-masivo">
          <div>
            <strong>Decisiones tomadas: {Object.keys(decisiones).length}</strong>
            <p className="revisar-duplicados-masivo-info">
              Aprobados: {Object.values(decisiones).filter(d => d === 'aprobar').length} | 
              Rechazados: {Object.values(decisiones).filter(d => d === 'rechazar').length}
            </p>
          </div>
          <button
            onClick={procesarMasivo}
            disabled={procesando}
            className="revisar-duplicados-masivo-btn"
          >
            {procesando ? (
              <>
                <div className="loading-spinner revisar-duplicados-masivo-spinner"></div>
                Procesando...
              </>
            ) : (
              <>
                <FiSave size={18} />
                Procesar Todas las Decisiones
              </>
            )}
          </button>
        </div>
      )}

      {/* Modal de información */}
      <InfoModal
        open={infoModal.open}
        message={infoModal.message}
        title={infoModal.title}
        type="success"
        onClose={() => setInfoModal({ open: false, message: '', title: '' })}
      />
    </div>
  )
}

