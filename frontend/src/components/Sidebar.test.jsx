import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Sidebar from './Sidebar'
import { SidebarProvider } from '../contexts/SidebarContext'
import { DuplicadosProvider } from '../contexts/DuplicadosContext'
import { reiniciarEstadoNavegacion } from '../hooks/useEstadoNavegacion'

if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  })
}

const ESTADO = {
  inventario: { total: 312 },
  prestados: { en_uso: 12, por_revisar: 1 },
  autorizaciones: { por_aprobar: 3, mis_pendientes: 0 },
  novedades: { pendientes: 5 },
  horarios: { hoy: 6, en_curso: 2 },
  mantenimientos: { en_proceso: 2, proximos: 4 },
  ambientes: { activos: 3, en_mantenimiento: 1 },
}

function Ubicacion() {
  const location = useLocation()
  return <output data-testid="ubicacion">{location.pathname + location.search}</output>
}

const renderSidebar = (user, ruta = '/equipos/consultar') => {
  localStorage.setItem('user', JSON.stringify(user))
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <SidebarProvider>
        <DuplicadosProvider>
          <Routes>
            <Route path="*" element={<><Sidebar user={user} /><Ubicacion /></>} />
          </Routes>
        </DuplicadosProvider>
      </SidebarProvider>
    </MemoryRouter>
  )
}

describe('Sidebar de consulta', () => {
  beforeEach(() => {
    reiniciarEstadoNavegacion()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(ESTADO), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('muestra cada entrada con su estado y resalta la pantalla actual', async () => {
    renderSidebar({ id_usuario: 1, nombre_rol: 'Administrador' })

    const menu = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(await within(menu).findByText('3 por aprobar')).toBeInTheDocument()
    expect(within(menu).getByText('12 en uso ahora · 1 por revisar')).toBeInTheDocument()
    expect(within(menu).getByText('5 pendientes')).toBeInTheDocument()

    const actual = within(menu).getByRole('button', { name: /Consultar inventario/ })
    expect(actual).toHaveAttribute('aria-current', 'page')
    expect(fetch).toHaveBeenCalledWith('/api/navegacion/estado', { credentials: 'include' })
  })

  it('ya no ofrece acciones como entradas del menú', () => {
    renderSidebar({ id_usuario: 1, nombre_rol: 'Administrador' })
    const menu = screen.getByRole('navigation', { name: 'Navegación principal' })
    for (const accion of ['Registrar Inventario', 'Mis Equipos', 'Asignar Equipo', 'Verificar Inventario', 'Asignar Ambientes']) {
      expect(within(menu).queryByRole('button', { name: new RegExp(accion, 'i') })).toBeNull()
    }
  })

  it('el Aprendiz solo ve Inicio, Consultar inventario y Configuración', () => {
    renderSidebar({ id_usuario: 9, nombre_rol: 'Aprendiz' })
    const menu = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(within(menu).queryByText('Equipos prestados')).toBeNull()
    expect(within(menu).queryByText('Ambientes y horarios')).toBeNull()
    expect(within(menu).getByRole('button', { name: /Consultar inventario/ })).toBeInTheDocument()
  })

  it('navega al pulsar una entrada', async () => {
    renderSidebar({ id_usuario: 5, nombre_rol: 'Instructor' })
    fireEvent.click(screen.getByRole('button', { name: /Equipos prestados/ }))
    await waitFor(() => expect(screen.getByTestId('ubicacion')).toHaveTextContent('/equipos/prestados'))
  })

  it('pliega y despliega grupos de forma accesible', () => {
    renderSidebar({ id_usuario: 1, nombre_rol: 'Administrador' })
    const grupo = screen.getByRole('button', { name: /Configuración/ })
    expect(grupo).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(grupo)
    expect(grupo).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Seguridad' })).toBeInTheDocument()
  })

  it('abre automáticamente el grupo de la pantalla actual aunque esté plegado por defecto', () => {
    renderSidebar({ id_usuario: 1, nombre_rol: 'Administrador' }, '/config?section=roles')
    expect(screen.getByRole('button', { name: /Configuración/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Roles y Áreas' })).toHaveAttribute('aria-current', 'page')
  })

  it('si el estado falla, el menú sigue funcionando sin contadores', async () => {
    fetch.mockImplementation(async () => new Response('{}', { status: 500 }))
    renderSidebar({ id_usuario: 1, nombre_rol: 'Cuentadante' })
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: /Equipos prestados/ })).toBeInTheDocument()
    expect(screen.queryByText(/por aprobar/)).toBeNull()
  })
})
