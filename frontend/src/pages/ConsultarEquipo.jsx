import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import {
  FiCheckSquare,
  FiDownload,
  FiFileText,
  FiList,
  FiPlus,
  FiSearch,
  FiSliders,
  FiSquare,
  FiX,
} from 'react-icons/fi'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import DestructiveConfirmModal from '../components/DestructiveConfirmModal'
import CustomSelect from '../components/CustomSelect'
import Paginacion from '../components/Paginacion'
import FiltroMultiple from '../components/inventario/FiltroMultiple'
import { CabeceraAcciones, CeldasAcciones } from '../components/inventario/AccionesEquipo'
import MisEquiposTabla from '../components/inventario/MisEquiposTabla'
import RegistrarNovedadModal from '../components/inventario/RegistrarNovedadModal'
import MoverEquipoModal from '../components/inventario/MoverEquipoModal'
import { parseApiResponse, buildErrorMessage } from '../utils/api'
import { sanitizeExcelRow } from '../utils/excelSecurity'
import { buildEquiposExportAoa, EQUIPOS_PLANTILLA_COLUMNS, fetchAllEquiposForExport } from '../utils/equiposImportExport'
import { gruposDeAccionVisibles } from '../utils/equipoAcciones'
import {
  FILTROS,
  LIMITES_PAGINA,
  VISTAS,
  estadoInventarioAUrl,
  hayFiltrosActivos,
  leerEstadoInventario,
  parametrosApiInventario,
  vistasDisponibles,
} from '../utils/inventarioFiltros'
import { invalidarEstadoNavegacion } from '../hooks/useEstadoNavegacion'
import '../styles/pages/equipos.css'
import '../styles/consultarEquipo.css'
import '../styles/consultarEquipoBadges.css'
import '../styles/misEquipos.css'
import '../styles/inventario.css'
import { LoadingScreen } from './LoadingDemo'

const ESTADOS_FISICOS = ['Nuevo', 'Bueno', 'Regular', 'Malo', 'Dañado']
const ESTADOS_OPERATIVOS = ['Disponible', 'En Uso', 'En Mantenimiento', 'Dañado', 'Dado de Baja']
const ESTADOS_VERIFICACION = ['Verificado', 'Con Novedad', 'No Verificado']
const ROLES_DATOS_SENSIBLES = ['Administrador', 'Cuentadante']
const COLUMNAS_STORAGE = 'equipos_visible_columns_v2'
const FILTROS_TEXTO = ['placa', 'tipo_texto', 'modelo']

/**
 * Columnas de la tabla. `filtro.param` es el parámetro del API (y de la URL):
 * cada columna trae su filtro, y ocultar la columna oculta y limpia su filtro.
 */
function definirColumnas({ rol, ambientes, cuentadantes }) {
  const sensibles = ROLES_DATOS_SENSIBLES.includes(rol)
  return [
    { key: 'codigo_inventario', label: 'Código Inventario', filtro: { param: 'placa', placeholder: 'Placa' } },
    { key: 'tipo', label: 'Tipo', filtro: { param: 'tipo_texto', placeholder: 'Tipo' } },
    { key: 'modelo', label: 'Modelo', filtro: { param: 'modelo', placeholder: 'Modelo' } },
    { key: 'consecutivo', label: 'Consecutivo' },
    { key: 'estado_fisico', label: 'Estado Físico', filtro: { param: 'estado_fisico', opciones: ESTADOS_FISICOS.map(v => ({ value: v, label: v })) } },
    { key: 'estado_operativo', label: 'Estado operativo', filtro: { param: 'estado_operativo', opciones: ESTADOS_OPERATIVOS.map(v => ({ value: v, label: v })) } },
    { key: 'fecha_adquisicion', label: 'Fecha Adquisición' },
    sensibles && { key: 'valor_ingreso', label: 'Valor Ingreso' },
    {
      key: 'nombre_ambiente',
      label: 'Ambiente',
      filtro: { param: 'ambiente', opciones: ambientes.map(a => ({ value: String(a.id_ambiente), label: `${a.codigo_ambiente} · ${a.nombre_ambiente}` })) },
    },
    { key: 'status_verificacion', label: 'Estado verificación', filtro: { param: 'status_verificacion', opciones: ESTADOS_VERIFICACION.map(v => ({ value: v, label: v })) } },
    { key: 'en_prestamo', label: 'Préstamo', filtro: { param: 'en_prestamo', opciones: [{ value: 'si', label: 'En préstamo' }, { value: 'no', label: 'Sin préstamo' }] } },
    sensibles && {
      key: 'cuentadante_principal',
      label: 'Cuentadante',
      filtro: rol === 'Administrador'
        ? { param: 'id_cuentadante', opciones: cuentadantes.map(c => ({ value: String(c.id_usuario), label: c.nombre_usuario })) }
        : null,
    },
    { key: 'descripcion', label: 'Descripción' },
    { key: 'specs_completas', label: 'Atributos' },
  ].filter(Boolean)
}

const COLUMNAS_POR_DEFECTO = [
  'codigo_inventario', 'tipo', 'modelo', 'consecutivo', 'estado_fisico', 'estado_operativo',
  'fecha_adquisicion', 'valor_ingreso', 'nombre_ambiente', 'status_verificacion', 'en_prestamo',
  'cuentadante_principal', 'descripcion', 'specs_completas',
]

function leerColumnasGuardadas() {
  try {
    const v2 = JSON.parse(localStorage.getItem(COLUMNAS_STORAGE) || 'null')
    if (Array.isArray(v2)) return v2
    // Migración: la lista anterior no conocía las columnas nuevas (préstamo, cuentadante).
    const v1 = JSON.parse(localStorage.getItem('equipos_visible_columns') || 'null')
    if (Array.isArray(v1)) {
      return [...new Set([...v1.map(k => (k === 'costo' ? 'valor_ingreso' : k)), 'en_prestamo', 'cuentadante_principal'])]
    }
  } catch {
    // Preferencia corrupta: se usan las columnas por defecto.
  }
  return COLUMNAS_POR_DEFECTO
}

function leerUsuario() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    return null
  }
}

const formatearMoneda = valor => {
  if (!valor && valor !== 0) return '-'
  const numero = typeof valor === 'string' ? parseFloat(valor) : valor
  if (Number.isNaN(numero)) return '-'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(numero)
}

const formatearFecha = valor => {
  if (!valor) return '-'
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return String(valor)
  return fecha.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'America/Bogota' })
}

const claseEstadoFisico = estado => ({
  Nuevo: 'consultar-equipo-estado-badge-nuevo',
  Bueno: 'consultar-equipo-estado-badge-bueno',
  Regular: 'consultar-equipo-estado-badge-regular',
  Malo: 'consultar-equipo-estado-badge-malo',
  Dañado: 'consultar-equipo-estado-badge-danado',
  'En Reparación': 'consultar-equipo-estado-badge-en-reparacion',
})[estado] || 'consultar-equipo-estado-badge-default'

const claseEstadoOperativo = estado => ({
  Disponible: 'consultar-equipo-estado-badge-bueno',
  'En Uso': 'consultar-equipo-estado-badge-regular',
  'En Mantenimiento': 'consultar-equipo-estado-badge-en-reparacion',
  Dañado: 'consultar-equipo-estado-badge-danado',
  'Dado de Baja': 'consultar-equipo-estado-badge-danado',
})[estado] || 'consultar-equipo-estado-badge-default'

export default function ConsultarEquipo() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [user] = useState(leerUsuario)
  const rol = user?.nombre_rol || ''

  // Cuentadante: las vistas «Mis ambientes / A cargo / Todos» solo aplican si tiene ambientes.
  const [cuentadanteConAmbientes, setCuentadanteConAmbientes] = useState(rol === 'Cuentadante' ? null : false)
  const vistas = useMemo(() => vistasDisponibles(rol, Boolean(cuentadanteConAmbientes)), [rol, cuentadanteConAmbientes])
  const estado = useMemo(() => leerEstadoInventario(searchParams, vistas), [searchParams, vistas])
  const vistaPorDefecto = vistas[0]?.key
  const esMiResponsabilidad = estado.vista === VISTAS.MI_RESPONSABILIDAD

  const [equipos, setEquipos] = useState([])
  const [paginacion, setPaginacion] = useState({ total: 0, totalPages: 0 })
  const [misEquipos, setMisEquipos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)
  const [recarga, setRecarga] = useState(0)
  const [exportando, setExportando] = useState(false)
  const [toast, setToast] = useState(null)

  const [ambientes, setAmbientes] = useState([])
  const [cuentadantes, setCuentadantes] = useState([])
  const [busqueda, setBusqueda] = useState(estado.q)
  const [textoFiltros, setTextoFiltros] = useState(() => Object.fromEntries(FILTROS_TEXTO.map(k => [k, estado.filtros[k] || ''])))
  const [columnasVisibles, setColumnasVisibles] = useState(leerColumnasGuardadas)
  const [panelColumnas, setPanelColumnas] = useState(false)

  const [modal, setModal] = useState(null) // { tipo: 'novedad' | 'mover', equipo }
  const [editingCodigo, setEditingCodigo] = useState(null)
  const [draft, setDraft] = useState({})
  const [autorizacionesDisponibles, setAutorizacionesDisponibles] = useState([])
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, codigo: null, equipo: null })

  const columnas = useMemo(() => definirColumnas({ rol, ambientes, cuentadantes }), [rol, ambientes, cuentadantes])
  const columnasMostradas = columnas.filter(c => columnasVisibles.includes(c.key))
  const grupos = useMemo(() => gruposDeAccionVisibles(user), [user])
  const puedeRegistrar = rol === 'Administrador' || rol === 'Cuentadante'
  const puedeExportar = Boolean(rol)

  useEffect(() => {
    localStorage.setItem(COLUMNAS_STORAGE, JSON.stringify(columnasVisibles))
  }, [columnasVisibles])

  // Sincroniza los campos de texto cuando la URL cambia (volver atrás, «Mostrar todos»…).
  useEffect(() => {
    setBusqueda(estado.q)
    setTextoFiltros(Object.fromEntries(FILTROS_TEXTO.map(k => [k, estado.filtros[k] || ''])))
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (rol !== 'Cuentadante') return undefined
    let activo = true
    fetch('/api/equipos/verificacion/ambientes', { credentials: 'include' })
      .then(res => parseApiResponse(res, ''))
      .then(data => { if (activo) setCuentadanteConAmbientes((data?.ambientes?.length || 0) > 0) })
      .catch(() => { if (activo) setCuentadanteConAmbientes(false) })
    return () => { activo = false }
  }, [rol])

  useEffect(() => {
    if (!rol || rol === 'Aprendiz') return undefined
    let activo = true
    fetch('/api/ambientes/activos', { credentials: 'include' })
      .then(res => parseApiResponse(res, 'No se pudieron cargar los ambientes'))
      .then(data => { if (activo) setAmbientes(Array.isArray(data) ? data : []) })
      .catch(() => { if (activo) setAmbientes([]) })
    return () => { activo = false }
  }, [rol])

  useEffect(() => {
    if (rol !== 'Administrador') return undefined
    let activo = true
    fetch('/api/auth/users?rol=Cuentadante', { credentials: 'include' })
      .then(res => parseApiResponse(res, ''))
      .then(data => { if (activo) setCuentadantes(Array.isArray(data) ? data : []) })
      .catch(() => { if (activo) setCuentadantes([]) })
    return () => { activo = false }
  }, [rol])

  const cambiarEstado = useCallback((cambios, { resetPagina = true } = {}) => {
    const siguiente = { ...estado, ...cambios }
    if (resetPagina && !('pagina' in cambios)) siguiente.pagina = 1
    setSearchParams(estadoInventarioAUrl(siguiente, vistaPorDefecto), { replace: true })
  }, [estado, setSearchParams, vistaPorDefecto])

  const cambiarFiltro = (param, valor) => {
    const filtros = { ...estado.filtros }
    const vacio = Array.isArray(valor) ? valor.length === 0 : !valor
    if (vacio) delete filtros[param]
    else filtros[param] = valor
    cambiarEstado({ filtros })
  }

  // Carga de la tabla: siempre con los parámetros de la URL y el alcance del servidor.
  useEffect(() => {
    if (!rol) return undefined
    if (rol === 'Cuentadante' && cuentadanteConAmbientes === null) return undefined
    let activo = true
    setCargando(true)
    setErrorCarga(null)

    const cargar = async () => {
      try {
        if (esMiResponsabilidad) {
          const res = await fetch('/api/equipos/mis-equipos/asignados', { credentials: 'include' })
          const data = await parseApiResponse(res, 'No se pudieron cargar tus equipos')
          if (activo) setMisEquipos(Array.isArray(data) ? data : [])
          return
        }
        const params = parametrosApiInventario(estado, { rol, cuentadanteConAmbientes })
        const res = await fetch(`/api/equipos?${params}`, { credentials: 'include' })
        const data = await parseApiResponse(res, 'No se pudo cargar el inventario')
        if (!activo) return
        const lista = data?.equipos || (Array.isArray(data) ? data : [])
        const pag = data?.pagination || { total: lista.length, totalPages: 1 }
        // Si los filtros dejaron la página actual vacía, vuelve a la última con datos.
        if (lista.length === 0 && pag.total > 0 && estado.pagina > 1) {
          cambiarEstado({ pagina: Math.max(1, pag.totalPages) }, { resetPagina: false })
          return
        }
        setEquipos(lista)
        setPaginacion({ total: Number(pag.total) || 0, totalPages: Number(pag.totalPages) || 0 })
      } catch (err) {
        if (activo) setErrorCarga(buildErrorMessage(err, 'No se pudo cargar el inventario'))
      } finally {
        if (activo) setCargando(false)
      }
    }
    cargar()
    return () => { activo = false }
  }, [searchParams.toString(), rol, cuentadanteConAmbientes, esMiResponsabilidad, recarga]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Búsqueda y filtros ----------
  function buscar(evento) {
    evento.preventDefault()
    const filtros = { ...estado.filtros }
    for (const clave of FILTROS_TEXTO) {
      const valor = (textoFiltros[clave] || '').trim()
      if (valor) filtros[clave] = valor
      else delete filtros[clave]
    }
    cambiarEstado({ q: busqueda.trim(), filtros })
  }

  function mostrarTodos() {
    setBusqueda('')
    cambiarEstado({ q: '', filtros: {} })
  }

  const aplicarFiltroTexto = param => {
    const valor = (textoFiltros[param] || '').trim()
    if (valor === (estado.filtros[param] || '')) return
    cambiarFiltro(param, valor)
  }

  function alternarColumna(columna, visible) {
    if (!visible && columnasVisibles.length <= 1) {
      setToast({ message: 'Debe haber al menos una columna visible', type: 'warning' })
      return
    }
    setColumnasVisibles(prev => (visible ? [...prev, columna.key] : prev.filter(k => k !== columna.key)))
    // Ocultar una columna también limpia su filtro, para no filtrar por algo que no se ve.
    if (!visible && columna.filtro && estado.filtros[columna.filtro.param]) {
      cambiarFiltro(columna.filtro.param, null)
    }
  }

  const filtrosActivos = columnas
    .filter(c => c.filtro && estado.filtros[c.filtro.param])
    .map(c => {
      const valor = estado.filtros[c.filtro.param]
      const valores = Array.isArray(valor) ? valor : [valor]
      const etiquetas = valores.map(v => c.filtro.opciones?.find(o => o.value === v)?.label || v)
      return { param: c.filtro.param, columna: c.label, texto: etiquetas.join(', ') }
    })

  // ---------- Acciones por equipo ----------
  const volver = `/equipos/consultar${searchParams.toString() ? `?${searchParams}` : ''}`

  function manejarAccion(accion, equipo) {
    const id = equipo.codigo_equipo
    const conVolver = ruta => `${ruta}${ruta.includes('?') ? '&' : '?'}volver=${encodeURIComponent(volver)}`
    switch (accion) {
      case 'ver-detalle':
        navigate(`/equipos/detalle/${id}?por=id`)
        break
      case 'historial':
        navigate(`/equipos/detalle/${id}?por=id&tab=historial`)
        break
      case 'verificar':
        navigate(conVolver(`/equipos/verificar?equipo=${id}`))
        break
      case 'asignar':
        navigate(conVolver(`/equipos/asignar?equipo=${id}`))
        break
      case 'registrar-uso':
        navigate(`/equipos/detalle/${id}?por=id&tab=responsables&accion=registrar-uso`)
        break
      case 'mantenimiento':
        navigate(conVolver(`/mantenimientos?tab=crear&equipo=${id}`))
        break
      case 'novedad':
      case 'mover':
        setModal({ tipo: accion, equipo })
        break
      case 'editar':
        startEdit(equipo)
        break
      case 'eliminar':
        setDeleteConfirm({ open: true, codigo: id, equipo })
        break
      default:
        break
    }
  }

  // ---------- Edición en línea (Administrador), sin cambios de comportamiento ----------
  useEffect(() => {
    if (!editingCodigo) { setAutorizacionesDisponibles([]); return undefined }
    const eq = equipos.find(e => e.codigo_equipo === editingCodigo)
    const idDestino = draft.id_ambiente || eq?.id_ambiente
    if (!eq || eq.status_verificacion !== 'Verificado' || !idDestino || Number(idDestino) === Number(eq.id_ambiente)) {
      setAutorizacionesDisponibles([])
      return undefined
    }
    let activo = true
    fetch(`/api/equipos/autorizacion-movimiento/disponibles?codigo_equipo=${editingCodigo}&id_ambiente_destino=${idDestino}`, { credentials: 'include' })
      .then(res => parseApiResponse(res, ''))
      .then(data => { if (activo) setAutorizacionesDisponibles(data.autorizaciones || []) })
      .catch(() => { if (activo) setAutorizacionesDisponibles([]) })
    return () => { activo = false }
  }, [editingCodigo, draft.id_ambiente, equipos])

  function startEdit(eq) {
    setEditingCodigo(eq.codigo_equipo)
    setDraft({
      ...eq,
      fecha_adquisicion: eq.fecha_adquisicion ? String(eq.fecha_adquisicion).slice(0, 10) : '',
      id_ambiente: eq.id_ambiente || null,
      valor_ingreso: eq.valor_ingreso ?? eq.costo ?? null,
      estado_operativo: eq.estado_operativo || 'Disponible',
    })
  }

  function cancelEdit() {
    setEditingCodigo(null)
    setDraft({})
  }

  const onDraft = (campo, valor) => setDraft(prev => ({ ...prev, [campo]: valor }))

  async function saveEdit() {
    if (!editingCodigo) return
    setGuardandoEdicion(true)
    setToast(null)
    try {
      const numero = valor => {
        if (valor === undefined || valor === '' || valor === null) return null
        const n = typeof valor === 'string' ? parseFloat(valor) : Number(valor)
        return Number.isNaN(n) ? null : n
      }
      const texto = valor => (valor !== undefined && valor !== null && valor !== '' ? String(valor).trim() || null : undefined)
      const payload = {}
      for (const campo of ['tipo', 'modelo', 'consecutivo', 'descripcion', 'specs_completas', 'marca', 'numero_serie', 'placa', 'r_centro', 'fecha_adquisicion', 'estado_fisico', 'estado_operativo']) {
        const valor = texto(draft[campo])
        if (valor !== undefined) payload[campo] = valor
      }
      if (draft.valor_ingreso !== undefined) payload.valor_ingreso = numero(draft.valor_ingreso)
      if (draft.vida_util_meses !== undefined) payload.vida_util_meses = numero(draft.vida_util_meses)
      if (draft.id_ambiente !== undefined && draft.id_ambiente !== null && draft.id_ambiente !== '') {
        const idAmb = typeof draft.id_ambiente === 'string' ? parseInt(draft.id_ambiente, 10) : draft.id_ambiente
        payload.id_ambiente = !Number.isNaN(idAmb) && idAmb > 0 ? idAmb : null
      }
      const equipoEditado = equipos.find(eq => eq.codigo_equipo === editingCodigo)
      if (payload.id_ambiente != null && equipoEditado?.status_verificacion === 'Verificado') {
        const idAmbActual = equipoEditado.id_ambiente != null ? Number(equipoEditado.id_ambiente) : null
        if (idAmbActual !== payload.id_ambiente && draft.id_solicitud_autorizacion) {
          payload.id_solicitud_autorizacion = parseInt(draft.id_solicitud_autorizacion, 10)
        }
      }
      const res = await fetch(`/api/equipos/${encodeURIComponent(editingCodigo)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const data = await parseApiResponse(res, 'No se pudo actualizar el equipo')
      setToast({ message: data?.message || 'Equipo actualizado correctamente', type: 'success' })
      cancelEdit()
      setRecarga(n => n + 1)
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo actualizar el equipo'), type: 'error' })
    } finally {
      setGuardandoEdicion(false)
    }
  }

  async function handleDelete() {
    const codigoEq = deleteConfirm.codigo
    if (!codigoEq) return
    setGuardandoEdicion(true)
    try {
      const res = await fetch(`/api/equipos/${encodeURIComponent(codigoEq)}`, { method: 'DELETE', credentials: 'include' })
      await parseApiResponse(res, 'No se pudo eliminar el equipo')
      if (editingCodigo === codigoEq) cancelEdit()
      const info = deleteConfirm.equipo
      const descripcion = [info?.modelo, info?.codigo_inventario && `(Placa: ${info.codigo_inventario})`].filter(Boolean).join(' ') || codigoEq
      setToast({ message: `Equipo ${descripcion} eliminado correctamente`, type: 'success' })
      setRecarga(n => n + 1)
      invalidarEstadoNavegacion()
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo eliminar el equipo'), type: 'error' })
    } finally {
      setDeleteConfirm({ open: false, codigo: null, equipo: null })
      setGuardandoEdicion(false)
    }
  }

  // ---------- Exportación: mismos filtros y alcance, todas las páginas ----------
  async function descargarExcel() {
    setToast(null)
    setExportando(true)
    try {
      const base = parametrosApiInventario(estado, { rol, cuentadanteConAmbientes, conPaginacion: false })
      const lista = await fetchAllEquiposForExport(async ({ page, limit }) => {
        const qs = new URLSearchParams(base)
        qs.set('page', String(page))
        qs.set('limit', String(limit))
        const res = await fetch(`/api/equipos?${qs}`, { credentials: 'include' })
        return parseApiResponse(res, 'No se pudo obtener los equipos para la exportación')
      })
      if (lista.length === 0) {
        setToast({ message: 'No hay equipos para descargar con estos filtros', type: 'error' })
        return
      }
      const hoja = XLSX.utils.aoa_to_sheet(buildEquiposExportAoa(lista, sanitizeExcelRow))
      hoja['!cols'] = EQUIPOS_PLANTILLA_COLUMNS.map(col => ({ wch: ['atributos', 'descripcion', 'url_imagen'].includes(col) ? 40 : 18 }))
      if (hoja['!ref']) {
        const rango = XLSX.utils.decode_range(hoja['!ref'])
        rango.s.r = 0
        hoja['!autofilter'] = { ref: XLSX.utils.encode_range(rango) }
      }
      const libro = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(libro, hoja, 'Elementos')
      const nombre = `equipos_sena_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(libro, nombre)
      const aviso = paginacion.total && lista.length !== paginacion.total
        ? ` El total cambió mientras se descargaba (antes ${paginacion.total}).`
        : ''
      setToast({ message: `Excel descargado: ${nombre} (${lista.length} equipos).${aviso}`, type: aviso ? 'warning' : 'success' })
    } catch (err) {
      setToast({ message: buildErrorMessage(err, 'No se pudo generar el Excel. Intenta de nuevo.'), type: 'error' })
    } finally {
      setExportando(false)
    }
  }

  // ---------- Celdas ----------
  function celda(columna, eq) {
    const editando = editingCodigo === eq.codigo_equipo
    switch (columna.key) {
      case 'codigo_inventario':
        return <strong>{eq.codigo_inventario || '-'}</strong>
      case 'tipo':
      case 'modelo':
      case 'consecutivo':
        return editando
          ? <input value={draft[columna.key] || ''} onChange={e => onDraft(columna.key, e.target.value)} className="cell-input" aria-label={columna.label} />
          : eq[columna.key] || '-'
      case 'estado_fisico':
        return editando
          ? <CustomSelect name="estado_fisico" value={draft.estado_fisico || ''} onChange={e => onDraft('estado_fisico', e.target.value)} options={['', ...ESTADOS_FISICOS]} placeholder="Seleccionar estado" className="cell-input" />
          : <span className={`consultar-equipo-estado-badge ${claseEstadoFisico(eq.estado_fisico)}`}>{eq.estado_fisico || '-'}</span>
      case 'estado_operativo':
        return editando
          ? <CustomSelect name="estado_operativo" value={draft.estado_operativo || ''} onChange={e => onDraft('estado_operativo', e.target.value)} options={['', ...ESTADOS_OPERATIVOS]} placeholder="Seleccionar estado" className="cell-input" />
          : <span className={`consultar-equipo-estado-badge ${claseEstadoOperativo(eq.estado_operativo || 'Disponible')}`}>{eq.estado_operativo || 'Disponible'}</span>
      case 'fecha_adquisicion':
        return editando
          ? <input type="date" value={draft.fecha_adquisicion || ''} onChange={e => onDraft('fecha_adquisicion', e.target.value)} className="cell-input" aria-label={columna.label} />
          : formatearFecha(eq.fecha_adquisicion)
      case 'valor_ingreso':
        return editando
          ? <input type="number" value={draft.valor_ingreso ?? ''} onChange={e => onDraft('valor_ingreso', e.target.value === '' ? null : Number(e.target.value))} className="cell-input" aria-label={columna.label} />
          : formatearMoneda(eq.valor_ingreso ?? eq.costo)
      case 'nombre_ambiente':
        if (!editando) return eq.nombre_ambiente || '-'
        return (
          <div className="consultar-equipo-ambiente-edit">
            <CustomSelect
              name="id_ambiente"
              value={draft.id_ambiente || eq.id_ambiente || ''}
              onChange={e => { onDraft('id_ambiente', e.target.value); onDraft('id_solicitud_autorizacion', '') }}
              options={[{ value: '', label: 'Seleccionar ambiente' }, ...ambientes.map(a => ({ value: String(a.id_ambiente), label: `${a.codigo_ambiente} - ${a.nombre_ambiente}` }))]}
              placeholder="Seleccionar ambiente"
              className="cell-input"
            />
            {eq.status_verificacion === 'Verificado' && String(draft.id_ambiente || eq.id_ambiente || '') !== String(eq.id_ambiente || '') && (
              <div className="consultar-equipo-autorizacion">
                <span className="consultar-equipo-autorizacion-label">Use una autorización aprobada (un solo uso por autorización):</span>
                {autorizacionesDisponibles.length === 0 ? (
                  <p className="consultar-equipo-autorizacion-sin-disponibles">
                    No hay autorizaciones aprobadas para este movimiento.{' '}
                    <a href="/equipos/autorizaciones#solicitar" onClick={e => { e.preventDefault(); navigate(`/equipos/autorizaciones?equipo=${eq.codigo_equipo}#solicitar`) }}>Solicite una</a>{' '}
                    y espere a que el autorizador la apruebe.
                  </p>
                ) : (
                  <CustomSelect
                    name="id_solicitud_autorizacion"
                    value={draft.id_solicitud_autorizacion ?? ''}
                    onChange={e => onDraft('id_solicitud_autorizacion', e.target.value)}
                    options={[{ value: '', label: 'Seleccionar autorización' }, ...autorizacionesDisponibles.map(a => ({
                      value: String(a.id_solicitud),
                      label: `#${a.id_solicitud} - ${a.autorizador_nombre} (${a.fecha_resolucion ? new Date(a.fecha_resolucion).toLocaleDateString('es-CO') : ''})`,
                    }))]}
                    placeholder="Seleccionar autorización"
                    className="cell-input"
                  />
                )}
              </div>
            )}
          </div>
        )
      case 'status_verificacion':
        return (
          <span className={eq.status_verificacion === 'Verificado' ? 'consultar-equipo-badge-verificado' : 'consultar-equipo-badge-no-verificado'}>
            {eq.status_verificacion || 'No Verificado'}
          </span>
        )
      case 'en_prestamo':
        return Number(eq.en_prestamo) === 1 || eq.en_prestamo === true
          ? <span className="consultar-equipo-estado-badge consultar-equipo-estado-badge-regular">En préstamo</span>
          : <span className="inventario-sin-dato">—</span>
      case 'cuentadante_principal':
        return eq.cuentadante_principal || '-'
      case 'descripcion':
      case 'specs_completas':
        return editando
          ? <textarea value={draft[columna.key] || ''} onChange={e => onDraft(columna.key, e.target.value)} className="cell-textarea" aria-label={columna.label} />
          : eq[columna.key] || '-'
      default:
        return eq[columna.key] ?? '-'
    }
  }

  function filtroDeColumna(columna) {
    if (!columna.filtro) return null
    const { param, placeholder, opciones } = columna.filtro
    const { tipo } = FILTROS[param]
    if (tipo === 'texto') {
      return (
        <input
          type="search"
          className={`filtro-columna-control${estado.filtros[param] ? ' activo' : ''}`}
          value={textoFiltros[param] || ''}
          placeholder={placeholder}
          aria-label={`Filtrar por ${columna.label}`}
          onChange={e => setTextoFiltros(prev => ({ ...prev, [param]: e.target.value }))}
          onBlur={() => aplicarFiltroTexto(param)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); aplicarFiltroTexto(param) } }}
        />
      )
    }
    if (tipo === 'multiple') {
      return (
        <FiltroMultiple
          etiqueta={columna.label}
          opciones={opciones}
          valores={estado.filtros[param] || []}
          onCambiar={valores => cambiarFiltro(param, valores)}
        />
      )
    }
    return (
      <select
        className={`filtro-columna-control${estado.filtros[param] ? ' activo' : ''}`}
        value={estado.filtros[param] || ''}
        aria-label={`Filtrar por ${columna.label}`}
        onChange={e => cambiarFiltro(param, e.target.value)}
      >
        <option value="">Todos</option>
        {opciones.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }

  const ocupado = cargando || guardandoEdicion

  return (
    <div className="page simple-page">
      <Header />
      <div className="dashboard-layout">
        <Sidebar user={user} />
        <main className="dashboard-main">
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
          <DestructiveConfirmModal
            open={deleteConfirm.open}
            title="Eliminar Equipo"
            message={`¿Estás seguro de que quieres eliminar el equipo ${[deleteConfirm.equipo?.modelo, deleteConfirm.equipo?.codigo_inventario && `(${deleteConfirm.equipo.codigo_inventario})`].filter(Boolean).join(' ') || deleteConfirm.codigo}? Esta acción es destructiva e irreversible.`}
            confirmText="Eliminar Equipo"
            cancelText="Cancelar"
            confirmationPhrase="confirmar accion"
            loading={guardandoEdicion}
            onConfirm={handleDelete}
            onCancel={() => setDeleteConfirm({ open: false, codigo: null, equipo: null })}
          />
          {modal?.tipo === 'novedad' && (
            <RegistrarNovedadModal
              equipo={modal.equipo}
              onCerrar={() => setModal(null)}
              onRegistrada={({ aviso }) => {
                setModal(null)
                invalidarEstadoNavegacion()
                setToast({ message: aviso || `Novedad registrada para el equipo ${modal.equipo.codigo_inventario || modal.equipo.codigo_equipo}`, type: aviso ? 'warning' : 'success' })
              }}
            />
          )}
          {modal?.tipo === 'mover' && (
            <MoverEquipoModal
              equipo={modal.equipo}
              usuario={user}
              onCerrar={() => setModal(null)}
              onMovido={destino => {
                setModal(null)
                setRecarga(n => n + 1)
                setToast({ message: `Equipo movido${destino ? ` a ${destino.nombre_ambiente}` : ''}`, type: 'success' })
              }}
              onSolicitarAutorizacion={destino => navigate(`/equipos/autorizaciones?equipo=${modal.equipo.codigo_equipo}&destino=${destino}&volver=${encodeURIComponent(volver)}#solicitar`)}
            />
          )}

          <div className="users-panel inventario-panel">
            <div className="inventario-cabecera">
              <h2 className="consultar-equipo-header">Consultar Inventario</h2>
              {puedeRegistrar && (
                <div className="inventario-cabecera-acciones">
                  <button type="button" className="consultar-equipo-btn consultar-equipo-btn-verde" onClick={() => navigate('/equipos')}>
                    <FiPlus size={16} aria-hidden="true" />
                    Registrar equipo
                  </button>
                  <button type="button" className="consultar-equipo-btn consultar-equipo-btn-gris" onClick={() => navigate('/equipos/documento')}>
                    <FiFileText size={16} aria-hidden="true" />
                    Generar documento PDF
                  </button>
                </div>
              )}
            </div>

            {vistas.length > 1 && (
              <div className="consultar-equipo-vista-inventario" role="group" aria-label="Vista del inventario">
                <span className="consultar-equipo-vista-label">Vista:</span>
                <div className="consultar-equipo-vista-tabs inventario-vistas">
                  {vistas.map(v => (
                    <button
                      key={v.key}
                      type="button"
                      className={`consultar-equipo-vista-tab ${estado.vista === v.key ? 'active' : ''}`}
                      aria-pressed={estado.vista === v.key}
                      onClick={() => cambiarEstado({ vista: v.key })}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!esMiResponsabilidad && (
              <div className="users-toolbar">
                <div className="consultar-equipo-header-row">
                  <form onSubmit={buscar} className="consultar-equipo-search-form" role="search">
                    <input
                      type="search"
                      placeholder="Buscar por código, nombre, modelo o categoría..."
                      value={busqueda}
                      onChange={e => setBusqueda(e.target.value)}
                      className="search-input"
                      aria-label="Buscar en el inventario"
                    />
                    <button className="consultar-equipo-btn consultar-equipo-btn-verde" type="submit" disabled={ocupado}>
                      <FiSearch size={16} aria-hidden="true" />
                      Buscar
                    </button>
                    <button type="button" className="consultar-equipo-btn consultar-equipo-btn-gris" onClick={mostrarTodos} disabled={ocupado}>
                      <FiList size={16} aria-hidden="true" />
                      Mostrar todos
                    </button>
                  </form>
                  <div className="consultar-equipo-actions-row">
                    <button type="button" className="consultar-equipo-btn consultar-equipo-btn-gris" onClick={() => setPanelColumnas(true)} aria-haspopup="dialog">
                      <FiSliders size={16} aria-hidden="true" />
                      Columnas y filtros
                    </button>
                    {puedeExportar && (
                      <button type="button" className="consultar-equipo-btn consultar-equipo-btn-verde" onClick={descargarExcel} disabled={exportando || cargando}>
                        <FiDownload size={16} aria-hidden="true" />
                        {exportando ? 'Exportando...' : 'Descargar Excel'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {panelColumnas && (
              <div className="consultar-equipo-column-filter-modal" onClick={() => setPanelColumnas(false)}>
                <div className="consultar-equipo-column-filter-content" role="dialog" aria-modal="true" aria-labelledby="titulo-columnas" onClick={e => e.stopPropagation()}>
                  <div className="consultar-equipo-column-filter-header">
                    <h3 id="titulo-columnas">Columnas y filtros</h3>
                    <button type="button" onClick={() => setPanelColumnas(false)} className="consultar-equipo-column-filter-close" aria-label="Cerrar">×</button>
                  </div>
                  <p className="consultar-equipo-help-text inventario-columnas-ayuda">
                    Cada columna con filtro lo muestra bajo su título. Si ocultas una columna, su filtro también se oculta y se limpia.
                  </p>
                  <div className="consultar-equipo-column-filter-actions">
                    <button type="button" className="btn consultar-equipo-column-filter-btn" onClick={() => setColumnasVisibles(columnas.map(c => c.key))}>Seleccionar todas</button>
                    <button type="button" className="btn consultar-equipo-column-filter-btn" onClick={() => setColumnasVisibles(COLUMNAS_POR_DEFECTO)}>Restaurar predeterminadas</button>
                  </div>
                  <div className="consultar-equipo-column-list">
                    {columnas.map(columna => {
                      const visible = columnasVisibles.includes(columna.key)
                      return (
                        <label key={columna.key} className={`consultar-equipo-column-item ${visible ? 'checked' : ''}`}>
                          <input type="checkbox" checked={visible} onChange={e => alternarColumna(columna, e.target.checked)} className="consultar-equipo-column-checkbox" />
                          <span className="consultar-equipo-column-label">
                            {columna.label}
                            {columna.filtro && <span className="inventario-columna-con-filtro"> · con filtro</span>}
                          </span>
                          {visible
                            ? <FiCheckSquare size={20} color="var(--success-800)" className="consultar-equipo-column-icon" aria-hidden="true" />
                            : <FiSquare size={20} color="var(--neutral-500)" className="consultar-equipo-column-icon" aria-hidden="true" />}
                        </label>
                      )
                    })}
                  </div>
                  <div className="consultar-equipo-column-filter-footer">
                    <button type="button" className="btn" onClick={() => setPanelColumnas(false)}>Listo</button>
                  </div>
                </div>
              </div>
            )}

            <div className="consultar-equipo-content">
              {!esMiResponsabilidad && (
                <div className="inventario-resumen-filtros" aria-live="polite">
                  {filtrosActivos.map(f => (
                    <span key={f.param} className="inventario-chip-filtro">
                      {f.columna}: <strong>{f.texto}</strong>
                      <button type="button" onClick={() => cambiarFiltro(f.param, null)} aria-label={`Quitar filtro ${f.columna}`}>
                        <FiX aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  {estado.q && (
                    <span className="inventario-chip-filtro">
                      Búsqueda: <strong>{estado.q}</strong>
                      <button type="button" onClick={() => cambiarEstado({ q: '' })} aria-label="Quitar búsqueda">
                        <FiX aria-hidden="true" />
                      </button>
                    </span>
                  )}
                  {hayFiltrosActivos(estado)
                    ? <button type="button" className="inventario-limpiar" onClick={mostrarTodos}>Limpiar filtros</button>
                    : <span className="consultar-equipo-help-text">Filtra desde la fila gris bajo los títulos de la tabla.</span>}
                </div>
              )}

              {cargando ? (
                <LoadingScreen message="Cargando equipos" />
              ) : errorCarga ? (
                <div className="users-empty" role="alert">
                  <strong>{errorCarga}</strong>
                  <div className="consultar-equipo-help-text">
                    <button type="button" className="consultar-equipo-btn consultar-equipo-btn-gris" onClick={() => setRecarga(n => n + 1)}>Reintentar</button>
                  </div>
                </div>
              ) : esMiResponsabilidad ? (
                <MisEquiposTabla equipos={misEquipos} usuario={user} grupos={grupos} onAccion={manejarAccion} />
              ) : (
                <>
                  <div className="consultar-equipo-table-wrapper">
                    <table className="users-table consultar-equipo-table inventario-tabla">
                      <caption className="sr-only">Inventario de equipos</caption>
                      <thead>
                        <tr>
                          {columnasMostradas.map(c => <th key={c.key} scope="col">{c.label}</th>)}
                          <CabeceraAcciones grupos={grupos} />
                        </tr>
                        <tr className="inventario-fila-filtros">
                          {columnasMostradas.map(c => <th key={c.key} scope="col">{filtroDeColumna(c)}</th>)}
                          <th colSpan={grupos.length} aria-hidden="true" />
                        </tr>
                      </thead>
                      <tbody>
                        {equipos.length === 0 && (
                          <tr>
                            <td colSpan={columnasMostradas.length + grupos.length} className="inventario-sin-resultados">
                              <strong>No hay equipos para mostrar</strong>
                              <div className="consultar-equipo-help-text">
                                {hayFiltrosActivos(estado)
                                  ? <>Ningún equipo coincide con la búsqueda y los filtros. <button type="button" className="inventario-limpiar" onClick={mostrarTodos}>Limpiar filtros</button></>
                                  : 'No hay equipos en tu alcance.'}
                              </div>
                            </td>
                          </tr>
                        )}
                        {equipos.map(eq => (
                          <tr key={eq.codigo_equipo}>
                            {columnasMostradas.map(c => <td key={c.key} data-label={c.label}>{celda(c, eq)}</td>)}
                            {editingCodigo === eq.codigo_equipo ? (
                              <td colSpan={grupos.length} className="inventario-td-acciones">
                                <div className="inventario-acciones-grupo">
                                  <button className="btn btn-verde" type="button" onClick={saveEdit} disabled={guardandoEdicion}>Guardar</button>
                                  <button className="btn" type="button" onClick={cancelEdit} disabled={guardandoEdicion}>Cancelar</button>
                                </div>
                              </td>
                            ) : (
                              <CeldasAcciones equipo={eq} usuario={user} grupos={grupos} onAccion={manejarAccion} disabled={Boolean(editingCodigo)} />
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Paginacion
                    pagina={estado.pagina}
                    totalPaginas={paginacion.totalPages}
                    total={paginacion.total}
                    limite={estado.limite}
                    limites={LIMITES_PAGINA}
                    onPagina={pagina => cambiarEstado({ pagina }, { resetPagina: false })}
                    onLimite={limite => cambiarEstado({ limite })}
                    deshabilitado={ocupado}
                    nombre="equipos"
                  />
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
