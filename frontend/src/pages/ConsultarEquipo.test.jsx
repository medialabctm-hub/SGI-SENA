import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ConsultarEquipo from './ConsultarEquipo'
import { reiniciarEstadoNavegacion } from '../hooks/useEstadoNavegacion'

vi.mock('../components/Header', () => ({ default: () => null }))
vi.mock('../components/Sidebar', () => ({ default: () => null }))
const writeFile = vi.fn()
vi.mock('xlsx', async importOriginal => {
  const real = await importOriginal()
  return { ...real, writeFile: (...args) => writeFile(...args) }
})

const AMBIENTES = [
  { id_ambiente: 12, codigo_ambiente: 'AMB-303', nombre_ambiente: 'Aula 303' },
  { id_ambiente: 14, codigo_ambiente: 'AMB-304', nombre_ambiente: 'Aula 304' },
]

const equipo = (id, extra = {}) => ({
  codigo_equipo: id,
  codigo_inventario: `92110${id}`,
  placa: `92110${id}`,
  tipo: 'Portátil',
  modelo: 'Latitude',
  estado_fisico: 'Bueno',
  estado_operativo: 'Disponible',
  status_verificacion: 'No Verificado',
  nombre_ambiente: 'Aula 303',
  id_ambiente: 12,
  en_prestamo: 0,
  ...extra,
})

let llamadas
let respuestaEquipos

const json = (cuerpo, status = 200) => Promise.resolve(new Response(JSON.stringify(cuerpo), {
  status,
  headers: { 'Content-Type': 'application/json' },
}))

function instalarFetch({ misEquipos = [], total = 2, lista } = {}) {
  llamadas = []
  respuestaEquipos = params => {
    const page = Number(params.get('page') || 1)
    const equipos = lista || [equipo(1), equipo(2, { status_verificacion: 'Verificado', en_prestamo: 1 })]
    return { equipos, pagination: { page, limit: Number(params.get('limit')), total, totalPages: Math.ceil(total / Number(params.get('limit') || 25)) } }
  }
  vi.stubGlobal('fetch', vi.fn((url, opciones = {}) => {
    llamadas.push({ url, opciones })
    const [ruta, qs = ''] = url.split('?')
    const params = new URLSearchParams(qs)
    if (ruta === '/api/equipos') return json(respuestaEquipos(params))
    if (ruta === '/api/ambientes/activos') return json(AMBIENTES)
    if (ruta === '/api/auth/users') return json([{ id_usuario: 7, nombre_usuario: 'Carlos M.' }])
    if (ruta === '/api/equipos/mis-equipos/asignados') return json(misEquipos)
    if (ruta === '/api/equipos/verificacion/ambientes') return json({ ambientes: [{ id_ambiente: 12 }] })
    if (ruta === '/api/novedades/tipos') return json(['Daño', 'Robo', 'Mal Funcionamiento'])
    if (ruta === '/api/novedades' && opciones.method === 'POST') return json({ id: 88 }, 201)
    return json({})
  }))
}

const llamadasEquipos = () => llamadas.filter(l => l.url.startsWith('/api/equipos?'))
const ultimaListaEquipos = () => new URLSearchParams(llamadasEquipos().at(-1).url.split('?')[1])

function Ubicacion() {
  const location = useLocation()
  return <output data-testid="ubicacion">{location.pathname + location.search}</output>
}

function renderPagina(rol, ruta = '/equipos/consultar') {
  localStorage.setItem('user', JSON.stringify({ id_usuario: 3, nombre_usuario: 'Prueba', nombre_rol: rol }))
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/equipos/consultar" element={<><ConsultarEquipo /><Ubicacion /></>} />
        <Route path="*" element={<Ubicacion />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Consultar inventario', () => {
  beforeEach(() => {
    reiniciarEstadoNavegacion()
    localStorage.clear()
    writeFile.mockClear()
    instalarFetch()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('pide la primera página con límite y muestra el total del servidor', async () => {
    instalarFetch({ total: 60 })
    renderPagina('Administrador')

    expect(await screen.findByText(/de/, { selector: '.paginacion-resumen' })).toHaveTextContent('Mostrando 1–25 de 60 equipos')
    expect(ultimaListaEquipos().get('page')).toBe('1')
    expect(ultimaListaEquipos().get('limit')).toBe('25')

    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
    await waitFor(() => expect(ultimaListaEquipos().get('page')).toBe('2'))
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('pagina=2')
  })

  it('muestra la cabecera con acciones de creación y las columnas de acciones por tipo', async () => {
    renderPagina('Administrador')
    await screen.findAllByText('921101')

    expect(screen.getByRole('button', { name: /Registrar equipo/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Generar documento PDF/ })).toBeInTheDocument()
    for (const titulo of ['Consultar', 'Gestionar', 'Registrar', 'Administrar']) {
      expect(screen.getByRole('columnheader', { name: titulo })).toBeInTheDocument()
    }
    // Historial único: ya no hay botón «Movimientos».
    expect(screen.queryByRole('button', { name: /Movimientos/ })).toBeNull()
    expect(screen.getAllByRole('button', { name: /^Historial ·/ })).toHaveLength(2)
  })

  it('filtra por dos ambientes desde la fila de filtros y lo refleja en la URL y en la etiqueta', async () => {
    renderPagina('Administrador')
    await screen.findAllByText('921101')

    fireEvent.click(screen.getByRole('button', { name: /Filtrar por Ambiente/ }))
    fireEvent.click(await screen.findByRole('checkbox', { name: 'AMB-303 · Aula 303' }))
    await waitFor(() => expect(ultimaListaEquipos().getAll('ambiente')).toEqual(['12']))
    fireEvent.click(screen.getByRole('button', { name: /Filtrar por Ambiente/ }))
    fireEvent.click(await screen.findByRole('checkbox', { name: 'AMB-304 · Aula 304' }))

    await waitFor(() => expect(ultimaListaEquipos().getAll('ambiente')).toEqual(['12', '14']))
    expect(ultimaListaEquipos().get('page')).toBe('1')
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('ambiente=12&ambiente=14')
    expect(screen.getByText('AMB-303 · Aula 303, AMB-304 · Aula 304')).toBeInTheDocument()
  })

  it('filtra por verificación y préstamo; «Mostrar todos» limpia todo', async () => {
    renderPagina('Administrador')
    await screen.findAllByText('921101')

    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por Estado verificación' }), { target: { value: 'Verificado' } })
    await waitFor(() => expect(ultimaListaEquipos().get('status_verificacion')).toBe('Verificado'))
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por Préstamo' }), { target: { value: 'si' } })
    await waitFor(() => expect(ultimaListaEquipos().get('en_prestamo')).toBe('si'))

    fireEvent.click(screen.getByRole('button', { name: /Mostrar todos/ }))
    await waitFor(() => {
      const params = ultimaListaEquipos()
      expect(params.get('status_verificacion')).toBeNull()
      expect(params.get('en_prestamo')).toBeNull()
    })
  })

  it('aplica el filtro de texto de una columna al pulsar Enter', async () => {
    renderPagina('Instructor')
    await screen.findAllByText('921101')

    const placa = screen.getByRole('searchbox', { name: 'Filtrar por Código Inventario' })
    fireEvent.change(placa, { target: { value: '9211' } })
    fireEvent.keyDown(placa, { key: 'Enter' })
    await waitFor(() => expect(ultimaListaEquipos().get('placa')).toBe('9211'))
  })

  it('ocultar una columna también quita su filtro', async () => {
    renderPagina('Administrador', '/equipos/consultar?status_verificacion=Verificado')
    await screen.findAllByText('921101')
    expect(ultimaListaEquipos().get('status_verificacion')).toBe('Verificado')

    fireEvent.click(screen.getByRole('button', { name: /Columnas y filtros/ }))
    const dialogo = screen.getByRole('dialog', { name: 'Columnas y filtros' })
    fireEvent.click(within(dialogo).getByRole('checkbox', { name: /Estado verificación/ }))

    await waitFor(() => expect(ultimaListaEquipos().get('status_verificacion')).toBeNull())
    expect(screen.queryByRole('columnheader', { name: 'Estado verificación' })).toBeNull()
  })

  it('el Instructor ve Verificar y Asignar pero no acciones de administración; Verificar lleva con el equipo y el regreso', async () => {
    renderPagina('Instructor', '/equipos/consultar?estado_operativo=Disponible')
    await screen.findAllByText('921101')

    expect(screen.queryByRole('columnheader', { name: 'Administrar' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Registrar equipo/ })).toBeNull()
    // Mover solo en el equipo verificado (el 2).
    expect(screen.getAllByRole('button', { name: /^Mover ·/ })).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Verificar · 921101' }))
    await waitFor(() => expect(screen.getByTestId('ubicacion')).toHaveTextContent('/equipos/verificar?equipo=1&volver='))
    expect(decodeURIComponent(screen.getByTestId('ubicacion').textContent)).toContain('volver=/equipos/consultar?estado_operativo=Disponible')
  })

  it('el Aprendiz solo consulta y no ve filtros de cuentadante', async () => {
    renderPagina('Aprendiz')
    await screen.findAllByText('921101')
    expect(screen.getByRole('columnheader', { name: 'Consultar' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Gestionar' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Cuentadante' })).toBeNull()
    expect(llamadas.some(l => l.url.startsWith('/api/ambientes/activos'))).toBe(false)
  })

  it('«Bajo mi responsabilidad» usa la consulta personal y conserva sus columnas', async () => {
    instalarFetch({
      misEquipos: [
        { codigo_equipo: 5, codigo_inventario: 'P-5', tipo: 'Torre', tipo_responsabilidad: 'Principal', dias_asignado: 3, asignado_por_nombre: 'Ana', status_verificacion: 'No Verificado' },
        { codigo_equipo: 6, codigo_inventario: 'P-6', tipo: 'Monitor', tipo_responsabilidad: 'Secundario', dias_asignado: 1, asignado_por_nombre: 'Ana' },
      ],
    })
    renderPagina('Instructor', '/equipos/consultar?vista=mi_responsabilidad')

    expect(await screen.findByText('Principal')).toBeInTheDocument()
    expect(screen.getByText('Secundario')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Días habilitado' })).toBeInTheDocument()
    expect(llamadas.some(l => l.url === '/api/equipos/mis-equipos/asignados')).toBe(true)
    expect(llamadasEquipos()).toHaveLength(0)
  })

  it('«Bajo mi responsabilidad» vacío muestra un estado claro', async () => {
    instalarFetch({ misEquipos: [] })
    renderPagina('Aprendiz', '/equipos/consultar?vista=mi_responsabilidad')
    expect(await screen.findByText('No tienes equipos bajo tu responsabilidad')).toBeInTheDocument()
  })

  it('registra una novedad desde la fila sin salir del inventario', async () => {
    renderPagina('Cuentadante')
    await screen.findAllByText('921101')

    fireEvent.click(screen.getByRole('button', { name: 'Novedad · 921101' }))
    const dialogo = await screen.findByRole('dialog', { name: /Registrar novedad/ })
    fireEvent.change(within(dialogo).getByLabelText('Descripción'), { target: { value: 'corto' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar novedad' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('al menos 10 caracteres')

    fireEvent.change(within(dialogo).getByLabelText('Descripción'), { target: { value: 'La pantalla parpadea al encender' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Registrar novedad' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Registrar novedad/ })).toBeNull())
    const post = llamadas.find(l => l.url === '/api/novedades' && l.opciones.method === 'POST')
    expect(JSON.parse(post.opciones.body)).toEqual({ codigo_equipo: 1, tipo_novedad: 'Mal Funcionamiento', descripcion: 'La pantalla parpadea al encender' })
    expect(screen.getByTestId('ubicacion')).toHaveTextContent('/equipos/consultar')
  })

  it('el Cuentadante con ambientes envía la vista al servidor', async () => {
    renderPagina('Cuentadante', '/equipos/consultar?vista=mis_ambientes')
    await screen.findAllByText('921101')
    expect(ultimaListaEquipos().get('vista_inventario')).toBe('ambientes')
  })

  it('exporta a Excel exactamente los filtros de la tabla, recorriendo todas las páginas', async () => {
    instalarFetch({ total: 2 })
    renderPagina('Administrador', '/equipos/consultar?q=dell&ambiente=12&ambiente=14&pagina=1')
    await screen.findAllByText('921101')
    const antes = llamadasEquipos().length

    fireEvent.click(screen.getByRole('button', { name: /Descargar Excel/ }))
    await waitFor(() => expect(writeFile).toHaveBeenCalled())

    const exportacion = llamadasEquipos().slice(antes).map(l => new URLSearchParams(l.url.split('?')[1]))
    expect(exportacion.length).toBeGreaterThan(0)
    for (const params of exportacion) {
      expect(params.get('search')).toBe('dell')
      expect(params.getAll('ambiente')).toEqual(['12', '14'])
      expect(params.get('limit')).toBe('100')
    }
  })
})
