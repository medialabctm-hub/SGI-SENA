import { useState, useEffect } from 'react'
import { FiCheck, FiX, FiAlertCircle, FiCheckCircle, FiClock, FiSave } from 'react-icons/fi'
import { parseApiResponse, buildErrorMessage, handleError } from '../utils/api'

export default function RevisarDuplicados({ idImportacion, onProcesarCompleto }) {
  const [duplicados, setDuplicados] = useState([])
  const [loading, setLoading] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState(null)
  const [decisiones, setDecisiones] = useState({}) // { id_duplicado: 'aprobar' | 'rechazar' }
  const [procesandoId, setProcesandoId] = useState(null)

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
      setDuplicados(data.duplicados || [])
    } catch (err) {
      handleError(err, (msg) => setError(msg), 'Error al cargar duplicados')
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
      setDuplicados(prev => prev.filter(d => d.id_duplicado !== idDuplicado))
      setDecisiones(prev => {
        const nuevas = { ...prev }
        delete nuevas[idDuplicado]
        return nuevas
      })
      
      if (onProcesarCompleto) {
        onProcesarCompleto()
      }
    } catch (err) {
      handleError(err, (msg) => setError(msg), 'Error al procesar duplicado')
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
      setDuplicados(prev => prev.filter(d => !idsProcesados.includes(d.id_duplicado)))
      setDecisiones({})
      
      if (onProcesarCompleto) {
        onProcesarCompleto()
      }
      
      alert(`Procesados: ${data.resultados.aprobados} aprobados, ${data.resultados.rechazados} rechazados`)
    } catch (err) {
      handleError(err, (msg) => setError(msg), 'Error al procesar duplicados')
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
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ marginTop: '1rem', color: '#666' }}>Cargando duplicados...</p>
      </div>
    )
  }

  if (duplicados.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        background: '#d1fae5',
        borderRadius: '8px',
        border: '1px solid #10b981'
      }}>
        <FiCheckCircle size={32} color="#10b981" style={{ marginBottom: '0.5rem' }} />
        <p style={{ color: '#059669', fontWeight: 600 }}>No hay duplicados pendientes de revisión</p>
      </div>
    )
  }

  return (
    <div style={{ marginTop: '2rem' }}>
      <div style={{
        padding: '1rem',
        background: '#fff3cd',
        borderRadius: '8px',
        border: '1px solid #ffc107',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <FiAlertCircle size={20} color="#ffc107" />
        <div style={{ flex: 1 }}>
          <strong>Duplicados pendientes de revisión</strong>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: '#666' }}>
            Se encontraron {duplicados.length} registro(s) con placas duplicadas. 
            Compara la información y decide si aprobar o rechazar cada uno.
          </p>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          background: '#fee2e2',
          color: '#dc2626',
          borderRadius: '8px',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
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
          { key: 'r_centro', label: 'R Centro' },
          { key: 'categoria', label: 'Categoría' },
          { key: 'ambiente', label: 'Ambiente' }
        ]

        return (
          <div
            key={duplicado.id_duplicado}
            style={{
              marginBottom: '1.5rem',
              border: decision 
                ? (decision === 'aprobar' ? '2px solid #10b981' : '2px solid #ef4444')
                : '1px solid #e5e7eb',
              borderRadius: '8px',
              overflow: 'hidden',
              background: '#fff'
            }}
          >
            <div style={{
              padding: '1rem',
              background: decision 
                ? (decision === 'aprobar' ? '#d1fae5' : '#fee2e2')
                : '#f9fafb',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <strong>Fila {duplicado.fila_excel} - Placa: {duplicado.placa}</strong>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                  Equipo existente: Código #{datosBD.codigo_equipo}
                </p>
              </div>
              {decision && (
                <div style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  background: decision === 'aprobar' ? '#10b981' : '#ef4444',
                  color: '#fff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  {decision === 'aprobar' ? <FiCheckCircle size={16} /> : <FiX size={16} />}
                  {decision === 'aprobar' ? 'Aprobado' : 'Rechazado'}
                </div>
              )}
            </div>

            <div style={{ padding: '1rem', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb' }}>
                      Campo
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#fee2e2' }}>
                      Registro Existente (BD)
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #e5e7eb', background: '#dbeafe' }}>
                      Registro del Excel
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #e5e7eb', width: '100px' }}>
                      Coincide
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {campos.map((campo) => {
                    const valorBD = datosBD[campo.key]
                    const valorExcel = datosExcel[campo.key]
                    const coincide = compararValores(valorBD, valorExcel)

                    return (
                      <tr key={campo.key}>
                        <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', fontWeight: 600 }}>
                          {campo.label}
                        </td>
                        <td style={{ 
                          padding: '0.75rem', 
                          border: '1px solid #e5e7eb',
                          background: coincide ? '#f0fdf4' : '#fef2f2'
                        }}>
                          {formatearValor(valorBD)}
                        </td>
                        <td style={{ 
                          padding: '0.75rem', 
                          border: '1px solid #e5e7eb',
                          background: coincide ? '#f0fdf4' : '#fef2f2'
                        }}>
                          {formatearValor(valorExcel)}
                        </td>
                        <td style={{ padding: '0.75rem', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                          {coincide ? (
                            <FiCheckCircle size={18} color="#10b981" />
                          ) : (
                            <FiX size={18} color="#ef4444" />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{
              padding: '1rem',
              background: '#f9fafb',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              gap: '0.5rem',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => tomarDecision(duplicado.id_duplicado, 'rechazar')}
                disabled={procesandoId === duplicado.id_duplicado}
                style={{
                  padding: '0.5rem 1rem',
                  background: decision === 'rechazar' ? '#ef4444' : '#fff',
                  color: decision === 'rechazar' ? '#fff' : '#ef4444',
                  border: '1px solid #ef4444',
                  borderRadius: '6px',
                  cursor: procesandoId === duplicado.id_duplicado ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  opacity: procesandoId === duplicado.id_duplicado ? 0.6 : 1
                }}
              >
                <FiX size={16} />
                Rechazar
              </button>
              <button
                onClick={() => tomarDecision(duplicado.id_duplicado, 'aprobar')}
                disabled={procesandoId === duplicado.id_duplicado}
                style={{
                  padding: '0.5rem 1rem',
                  background: decision === 'aprobar' ? '#10b981' : '#fff',
                  color: decision === 'aprobar' ? '#fff' : '#10b981',
                  border: '1px solid #10b981',
                  borderRadius: '6px',
                  cursor: procesandoId === duplicado.id_duplicado ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  opacity: procesandoId === duplicado.id_duplicado ? 0.6 : 1
                }}
              >
                <FiCheckCircle size={16} />
                Aprobar
              </button>
              {decision && (
                <button
                  onClick={() => procesarIndividual(duplicado.id_duplicado, decision)}
                  disabled={procesandoId === duplicado.id_duplicado}
                  style={{
                    padding: '0.5rem 1rem',
                    background: procesandoId === duplicado.id_duplicado ? '#ccc' : '#1976d2',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: procesandoId === duplicado.id_duplicado ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {procesandoId === duplicado.id_duplicado ? (
                    <>
                      <div className="loading-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></div>
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
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: '#e0f2fe',
          borderRadius: '8px',
          border: '1px solid #0284c7',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong>Decisiones tomadas: {Object.keys(decisiones).length}</strong>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>
              Aprobados: {Object.values(decisiones).filter(d => d === 'aprobar').length} | 
              Rechazados: {Object.values(decisiones).filter(d => d === 'rechazar').length}
            </p>
          </div>
          <button
            onClick={procesarMasivo}
            disabled={procesando}
            style={{
              padding: '0.75rem 1.5rem',
              background: procesando ? '#ccc' : '#0284c7',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: procesando ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {procesando ? (
              <>
                <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
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
    </div>
  )
}

