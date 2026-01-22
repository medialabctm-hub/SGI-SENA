import { useState, useEffect } from 'react'
import { FiUpload, FiFile, FiDownload, FiUser, FiSave, FiAlertCircle, FiSearch, FiCheckCircle } from 'react-icons/fi'
import * as XLSX from 'xlsx'
import { parseApiResponse, buildErrorMessage, handleError } from '../utils/api'
import RevisarDuplicados from './RevisarDuplicados'
import { useDuplicados } from '../contexts/DuplicadosContext'
import InfoModal from './InfoModal'
import '../styles/pages/importaciones.css'

export default function ImportarEquipos({ onImportComplete, onEstadoDuplicadosChange }) {
  const [archivo, setArchivo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const [cuentadantePrincipal, setCuentadantePrincipal] = useState('')
  const [cuentadanteActual, setCuentadanteActual] = useState(null)
  const [cuentadanteEncontrado, setCuentadanteEncontrado] = useState(null)
  const [buscandoCuentadante, setBuscandoCuentadante] = useState(false)
  const [loadingCuentadante, setLoadingCuentadante] = useState(false)
  const [savingCuentadante, setSavingCuentadante] = useState(false)
  const [user, setUser] = useState(null)
  const [idImportacion, setIdImportacion] = useState(null)
  const [equiposImportadosIds, setEquiposImportadosIds] = useState([]) // IDs de equipos importados en esta sesión
  const [mostrarDuplicados, setMostrarDuplicados] = useState(false)
  const { establecerDuplicadosPendientes, limpiarDuplicados } = useDuplicados()
  const [infoModal, setInfoModal] = useState({ open: false, message: '', title: '' })

  useEffect(() => {
    try {
      const userData = localStorage.getItem('user')
      if (userData) {
        setUser(JSON.parse(userData))
      }
    } catch (error) {
      console.error('Error al obtener datos del usuario:', error)
    }
  }, [])

  // Sincronizar estado de duplicados con el contexto
  useEffect(() => {
    establecerDuplicadosPendientes(mostrarDuplicados)
  }, [mostrarDuplicados, establecerDuplicadosPendientes])

  // Notificar al componente padre cuando haya o no duplicados pendientes
  useEffect(() => {
    if (typeof onEstadoDuplicadosChange === 'function') {
      onEstadoDuplicadosChange(mostrarDuplicados)
    }
  }, [mostrarDuplicados, onEstadoDuplicadosChange])

  // Evitar que el usuario cierre o recargue la página mientras tiene duplicados sin resolver
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (mostrarDuplicados) {
        event.preventDefault()
        // Algunos navegadores requieren asignar un valor a returnValue
        event.returnValue = 'Hay registros con placas duplicadas pendientes de revisión. ¿Estás seguro de que deseas salir?'
      }
    }

    if (mostrarDuplicados) {
      window.addEventListener('beforeunload', handleBeforeUnload)
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [mostrarDuplicados])

  useEffect(() => {
    if (user?.nombre_rol === 'Administrador') {
      fetchCuentadantePrincipal()
    }
  }, [user])

  const fetchCuentadantePrincipal = async () => {
    try {
      setLoadingCuentadante(true)
      const token = localStorage.getItem('token')
      const res = await fetch('/api/equipos/cuentadante-principal', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await parseApiResponse(res, 'Error al obtener cuentadante principal')
      setCuentadanteActual(data.cuentadante_principal || '')
      // Mostrar la Documento si está disponible, sino el nombre
      setCuentadantePrincipal(data.cuentadante_cedula || data.cuentadante_principal || '')
    } catch (err) {
      console.error('Error al obtener cuentadante principal:', err)
    } finally {
      setLoadingCuentadante(false)
    }
  }

  const buscarCuentadante = async () => {
    if (!cuentadantePrincipal.trim()) {
      setError('Ingresa la Documento del cuentadante')
      return
    }

    try {
      setBuscandoCuentadante(true)
      setError(null)
      setCuentadanteEncontrado(null)
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/auth/user/cedula/${encodeURIComponent(cuentadantePrincipal.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (res.ok) {
        const data = await parseApiResponse(res, 'Error al buscar cuentadante')
        
        // Verificar que sea un Cuentadante
        if (data.nombre_rol !== 'Cuentadante') {
          setError('El usuario encontrado no tiene el rol de Cuentadante')
          setCuentadanteEncontrado(null)
          return
        }
        
        setCuentadanteEncontrado(data)
        setError(null)
      } else {
        const errorData = await res.json().catch(() => ({}))
        setError(errorData.error || 'No se encontró un usuario con esa Documento')
        setCuentadanteEncontrado(null)
      }
    } catch (err) {
      handleError(err, (msg) => setError(msg), 'Error al buscar el cuentadante')
      setCuentadanteEncontrado(null)
    } finally {
      setBuscandoCuentadante(false)
    }
  }

  const handleSaveCuentadante = async () => {
    if (!cuentadantePrincipal.trim()) {
      setError('La Documento del cuentadante es obligatoria')
      return
    }

    // Si no se ha buscado el cuentadante, buscarlo primero
    if (!cuentadanteEncontrado) {
      await buscarCuentadante()
      if (!cuentadanteEncontrado) {
        return // No continuar si no se encontró
      }
    }

    // Validar que hay equipos importados para asignar el cuentadante
    if (!equiposImportadosIds || equiposImportadosIds.length === 0) {
      setError('No hay equipos importados en esta sesión. Debe importar equipos primero antes de asignar el cuentadante.')
      return
    }

    try {
      setSavingCuentadante(true)
      setError(null)
      const token = localStorage.getItem('token')
      
      // Enviar los IDs de equipos importados para asignar cuentadante solo a esos
      const res = await fetch('/api/equipos/cuentadante-principal', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          cedula: cuentadantePrincipal.trim(),
          equipos_ids: equiposImportadosIds // Solo actualizar equipos importados en esta sesión
        })
      })
      const data = await parseApiResponse(res, 'Error al actualizar cuentadante principal')
      setCuentadanteActual(data.cuentadante_principal || '')
      setCuentadantePrincipal(data.cuentadante_cedula || cuentadantePrincipal.trim())
      setError(null)
      // Mostrar mensaje de éxito
      setInfoModal({
        open: true,
        message: `Cuentadante principal "${data.cuentadante_principal}" asignado correctamente a ${data.equipos_actualizados} equipo(s) importado(s) en esta sesión`,
        title: 'Éxito'
      })
      // Limpiar IDs después de asignar (opcional, para evitar reasignaciones accidentales)
      // setEquiposImportadosIds([])
    } catch (err) {
      handleError(err, (msg) => setError(msg), 'Error al guardar el cuentadante principal')
    } finally {
      setSavingCuentadante(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validar que sea un archivo Excel
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ]
      if (!validTypes.includes(file.type)) {
        setError('Por favor selecciona un archivo Excel (.xlsx o .xls)')
        setArchivo(null)
        setEquiposImportadosIds([]) // Limpiar IDs al cambiar archivo
        return
      }
      setArchivo(file)
      setError(null)
      setResultado(null)
      setEquiposImportadosIds([]) // Limpiar IDs al cambiar archivo
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!archivo) {
      setError('Por favor selecciona un archivo')
      return
    }

    // Validar que si es Administrador, debe haber buscado y encontrado un cuentadante
    if (user?.nombre_rol === 'Administrador') {
      if (!cuentadanteEncontrado || !cuentadanteEncontrado.id_usuario) {
        setError('Debe buscar y seleccionar un cuentadante antes de importar los equipos. Use el botón "Buscar" en la sección "Cuentadante Principal del Inventario".')
        return
      }
    }

    setLoading(true)
    setError(null)
    setResultado(null)

    try {
      const formData = new FormData()
      formData.append('archivo', archivo)
      
      // Incluir id_cuentadante si existe (obligatorio para Administradores, opcional para Cuentadantes)
      if (cuentadanteEncontrado?.id_usuario) {
        formData.append('id_cuentadante', cuentadanteEncontrado.id_usuario.toString())
      }

      const token = localStorage.getItem('token')
      const res = await fetch('/api/import/equipos', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      })

      // Manejar códigos HTTP: 200 (éxito), 207 (parcial), 400 (error)
      let data
      if (res.status === 207) {
        // Multi-Status: algunos registros exitosos, algunos fallidos
        data = await res.json().catch(() => ({}))
      } else if (res.ok) {
        // 200: éxito completo
        data = await parseApiResponse(res, 'Error al importar equipos')
      } else {
        // 400 u otro error
        throw await parseApiResponse(res, 'Error al importar equipos').catch(() => {
          throw new Error('Error al procesar la respuesta del servidor')
        })
      }
      
      // Adaptarse a la nueva estructura del backend: success, message, porcentaje_exito, resultados
      const resultados = data.resultados || data
      setResultado(resultados)
      
      // Guardar IDs de equipos importados para asignar cuentadante después
      if (data.equipos_importados_ids && Array.isArray(data.equipos_importados_ids)) {
        setEquiposImportadosIds(data.equipos_importados_ids)
      } else {
        setEquiposImportadosIds([])
      }
      
      // Si hay duplicados, guardar el ID de importación y mostrar sección de revisión
      if (data.tiene_duplicados && data.id_importacion) {
        setIdImportacion(data.id_importacion)
        setMostrarDuplicados(true)
      } else {
        setMostrarDuplicados(false)
        setIdImportacion(null)
        // Mostrar modal de éxito si la importación fue exitosa (success: true o status 200/207) y no hay duplicados
        const esExitoso = data.success === true || res.status === 200 || res.status === 207
        if (esExitoso && resultados && resultados.exitosos > 0 && (!resultados.duplicados || resultados.duplicados === 0)) {
          const mensaje = data.message || `Se importaron correctamente ${resultados.exitosos} equipo(s)`
          const porcentaje = data.porcentaje_exito ? ` (${data.porcentaje_exito}% de éxito)` : ''
          const mensajeCompleto = resultados.fallidos > 0 
            ? `${mensaje}${porcentaje}. Se encontraron ${resultados.fallidos} error(es) que se muestran a continuación.`
            : `${mensaje}${porcentaje}.`
          setInfoModal({
            open: true,
            title: 'Importación Exitosa',
            message: mensajeCompleto
          })
        }
      }
      
      if (onImportComplete) {
        onImportComplete(resultados)
      }
    } catch (err) {
      setError(buildErrorMessage(err, 'Error al importar el archivo'))
    } finally {
      setLoading(false)
    }
  }

  const descargarPlantilla = () => {
    // Crear plantilla Excel con nombres exactos (iguales a BD)
    // Los nombres de las columnas deben ser EXACTAMENTE iguales a los campos de la BD
    const headers = [
      'placa',           // OBLIGATORIO
      'tipo',            // OBLIGATORIO (campo libre, no es categoría)
      'categoria',       // OBLIGATORIO (nombre o ID de categoría)
      'modelo',          // OBLIGATORIO
      'consecutivo',     // OBLIGATORIO
      'descripcion',     // Opcional
      'fecha_adquisicion', // Opcional (formato: YYYY-MM-DD)
      'valor_ingreso',   // Opcional
      'r_centro',        // Opcional
      'atributos',       // Opcional
      'ambiente'         // Opcional (si no se especifica, se usa "Neutral" por defecto)
    ]

    // Datos de ejemplo
    const ejemplo = [
      '92041025706',     // placa
      '4',               // tipo (campo libre)
      'ACCES POINT',     // categoria (nombre de categoría)
      'TL-WA801N',       // modelo
      '232938',          // consecutivo
      'ACCES POINT',     // descripcion
      '2021-12-22',      // fecha_adquisicion
      '126050',          // valor_ingreso
      '920510',          // r_centro
      'MARCA:TP-LINK',   // atributos
      'Neutral'          // ambiente (o dejar vacío para usar Neutral por defecto)
    ]

    // Crear workbook y worksheet
    const wb = XLSX.utils.book_new()
    const data = [headers, ejemplo] // Primera fila: encabezados, segunda fila: ejemplo
    
    // Crear worksheet
    const ws = XLSX.utils.aoa_to_sheet(data)
    
    // Establecer ancho de columnas
    const colWidths = headers.map(() => ({ wch: 20 }))
    ws['!cols'] = colWidths
    
    // Agregar worksheet al workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Equipos')
    
    // Generar archivo Excel
    XLSX.writeFile(wb, 'plantilla_equipos.xlsx')
  }

  return (
    <div className="importar-equipos-container">
      <div className="importar-equipos-header">
        <h3 className="importar-equipos-title">
          <FiUpload size={24} />
          Importación Masiva de Equipos
        </h3>
        <p className="importar-equipos-subtitle">
          Sube un archivo Excel con los equipos a importar. El archivo debe contener las columnas requeridas.
        </p>
      </div>

      <button
        onClick={descargarPlantilla}
        className="btn btn-verde importar-equipos-download-button"
      >
        <FiDownload size={16} />
        Descargar Plantilla (Excel)
      </button>

      <form onSubmit={handleSubmit}>
        <div className="importar-equipos-form-section">
          <label className="importar-equipos-label">
            Seleccionar archivo Excel
          </label>
          <div className={`importar-equipos-file-wrapper importar-equipos-file-container ${archivo ? 'has-file' : ''}`}>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="importar-equipos-file-input"
              id="file-input-equipos"
            />
            <label
              htmlFor="file-input-equipos"
              className="importar-equipos-file-label-inner"
            >
              <FiFile size={32} className="importar-equipos-file-icon" />
              {archivo ? (
                <span className="importar-equipos-file-name">{archivo.name}</span>
              ) : (
                <span className="importar-equipos-file-placeholder">Haz clic para seleccionar un archivo</span>
              )}
            </label>
          </div>
        </div>

        {error && (
          <div className="importar-equipos-error">
            <FiAlertCircle size={20} />
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-verde importar-equipos-submit-button"
          disabled={!archivo || loading}
        >
          {loading && <div className="loading-spinner importar-equipos-loading-spinner-small"></div>}
          {loading ? 'Importando...' : 'Importar Equipos'}
        </button>
      </form>

      {/* Sección de Cuentadante Principal - Solo para Administradores */}
      {user?.nombre_rol === 'Administrador' && (
        <div className="importar-equipos-cuentadante-section-warning">
          <h4 className="importar-equipos-cuentadante-title">
            <FiUser size={20} />
            Cuentadante Principal del Inventario
          </h4>
          <p className="importar-equipos-cuentadante-description">
            El cuentadante principal es la persona responsable permanente del inventario. 
            <strong> Debe buscar y seleccionar el cuentadante ANTES de importar los equipos.</strong> 
            Ingrese el <strong>Documento</strong> del cuentadante y haga clic en "Buscar".
          </p>
          <div className="importar-equipos-cuentadante-form">
            <div className="importar-equipos-cuentadante-search-row">
              <input
                type="text"
                className={`importar-equipos-cuentadante-input form-input ${cuentadanteEncontrado ? 'form-input-success' : ''}`}
                value={cuentadantePrincipal}
                onChange={(e) => {
                  setCuentadantePrincipal(e.target.value)
                  setCuentadanteEncontrado(null)
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    buscarCuentadante()
                  }
                }}
                placeholder="Documento del cuentadante principal"
                disabled={loadingCuentadante || savingCuentadante}
              />
              <button
                type="button"
                className="importar-equipos-cuentadante-search-button"
                onClick={buscarCuentadante}
                disabled={!cuentadantePrincipal.trim() || buscandoCuentadante || savingCuentadante}
              >
                {buscandoCuentadante && <div className="loading-spinner importar-equipos-loading-spinner-tiny"></div>}
                <FiSearch size={16} />
                {buscandoCuentadante ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
            
            {cuentadanteEncontrado && (
              <div className="importar-equipos-cuentadante-found">
                <FiCheckCircle size={18} className="importar-equipos-cuentadante-info-icon" />
                <div className="importar-equipos-cuentadante-found-info">
                  <strong>{cuentadanteEncontrado.nombre_usuario}</strong> - Documento: {cuentadanteEncontrado.cedula}
                </div>
              </div>
            )}
            
            <button
              type="button"
              className="importar-equipos-cuentadante-save-button"
              onClick={handleSaveCuentadante}
              disabled={!cuentadanteEncontrado || savingCuentadante || loadingCuentadante}
              title="Asignar cuentadante a equipos importados previamente (solo si no se asignó durante la importación)"
            >
              {savingCuentadante && <div className="loading-spinner importar-equipos-loading-spinner-tiny"></div>}
              <FiSave size={16} />
              {savingCuentadante ? 'Guardando...' : 'Asignar a Equipos Importados'}
            </button>
          </div>
          {cuentadanteActual && (
            <p className="importar-equipos-cuentadante-current">
              Cuentadante actual: <strong>{cuentadanteActual}</strong>
            </p>
          )}
        </div>
      )}

      {resultado && (
        <div className="importar-equipos-resultado">
          <h4 className="importar-equipos-resultado-title">Resultados de la Importación</h4>
          
          <div className="importar-equipos-resultado-stats">
            <div className="importar-equipos-resultado-stat importar-equipos-resultado-stat-total">
              <div className="importar-equipos-resultado-stat-total-number">{resultado.total || 0}</div>
              <div className="importar-equipos-resultado-stat-total-label">Total</div>
            </div>
            <div className="importar-equipos-resultado-stat exitosos">
              <div className="importar-equipos-resultado-stat-number">{resultado.exitosos || 0}</div>
              <div className="importar-equipos-resultado-stat-label">Exitosos</div>
            </div>
            {(resultado.fallidos > 0 || resultado.fallidos === 0) && (
              <div className="importar-equipos-resultado-stat fallidos importar-equipos-resultado-stat-fallidos">
                <div className="importar-equipos-resultado-stat-fallidos-number">{resultado.fallidos || 0}</div>
                <div className="importar-equipos-resultado-stat-fallidos-label">Fallidos</div>
              </div>
            )}
            {resultado.duplicados > 0 && (
              <div className="importar-equipos-resultado-stat duplicados importar-equipos-resultado-stat-duplicados">
                <div className="importar-equipos-resultado-stat-duplicados-number">{resultado.duplicados}</div>
                <div className="importar-equipos-resultado-stat-duplicados-label">Duplicados</div>
              </div>
            )}
          </div>

          {resultado.errores && resultado.errores.length > 0 && (
            <div className="importar-equipos-errores-section">
              <h5 className="importar-equipos-errores-title">Errores:</h5>
              <div className="importar-equipos-errores-list">
                {resultado.errores.map((error, idx) => (
                  <div key={idx} className="importar-equipos-error-item">
                    <strong>Fila {error.fila}</strong> ({error.codigo || error.cedula || 'N/A'}): {error.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sección de revisión de duplicados */}
      {mostrarDuplicados && idImportacion && (
        <RevisarDuplicados 
          idImportacion={idImportacion}
          onProcesarCompleto={() => {
            // Recargar duplicados o actualizar resultados
            setMostrarDuplicados(false)
            setIdImportacion(null)
            limpiarDuplicados()
            // Opcional: recargar la lista de equipos si hay callback
            if (onImportComplete) {
              onImportComplete(resultado)
            }
          }}
        />
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

