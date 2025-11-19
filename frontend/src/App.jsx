import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import CambiarContrasena from './pages/CambiarContrasena';
import OlvidarContrasena from './pages/OlvidarContrasena';
import RestablecerContrasena from './pages/RestablecerContrasena';
import Dashboard from './pages/Dashboard';
import Equipos from './pages/Equipos';
import ConsultarEquipo from './pages/ConsultarEquipo';
import Usuarios from './pages/Usuarios';
import Config from './pages/Config';
import CrearNovedad from './pages/CrearNovedad';
import CrearReporte from './pages/CrearReporte';
import AsignarEquipo from './pages/AsignarEquipo';
import MisEquipos from './pages/MisEquipos';
import Novedades from './pages/Novedades';
import Reportes from './pages/Reportes';
import Mantenimientos from './pages/Mantenimientos';
import CrearMantenimiento from './pages/CrearMantenimiento';
import Asignaciones from './pages/Asignaciones';
import Ambientes from './pages/Ambientes';
import ProtectedRoute from './components/ProtectedRoute';
import RedirectIfAuth from './components/RedirectIfAuth';

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuth>
            <Login />
          </RedirectIfAuth>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuth>
            <Register />
          </RedirectIfAuth>
        }
      />
      <Route
        path="/olvidar-contrasena"
        element={
          <RedirectIfAuth>
            <OlvidarContrasena />
          </RedirectIfAuth>
        }
      />
      <Route
        path="/restablecer-contrasena"
        element={<RestablecerContrasena />}
      />
      <Route
        path="/cambiar-contrasena"
        element={<CambiarContrasena />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/equipos"
        element={
          <ProtectedRoute>
            <Equipos />
          </ProtectedRoute>
        }
      />
      <Route
        path="/equipos/consultar"
        element={
          <ProtectedRoute>
            <ConsultarEquipo />
          </ProtectedRoute>
        }
      />
      <Route
        path="/usuarios"
        element={
          <ProtectedRoute>
            <Usuarios />
          </ProtectedRoute>
        }
      />
      <Route
        path="/config"
        element={
          <ProtectedRoute>
            <Config />
          </ProtectedRoute>
        }
      />
      <Route
        path="/novedades"
        element={
          <ProtectedRoute>
            <Novedades />
          </ProtectedRoute>
        }
      />
      <Route
        path="/novedades/crear"
        element={
          <ProtectedRoute>
            <CrearNovedad />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reportes"
        element={
          <ProtectedRoute>
            <Reportes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reportes/crear"
        element={
          <ProtectedRoute>
            <CrearReporte />
          </ProtectedRoute>
        }
      />
      <Route
        path="/equipos/asignar"
        element={
          <ProtectedRoute>
            <AsignarEquipo />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mis-equipos"
        element={
          <ProtectedRoute>
            <MisEquipos />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mantenimientos"
        element={
          <ProtectedRoute>
            <Mantenimientos />
          </ProtectedRoute>
        }
      />
      <Route
        path="/mantenimientos/crear"
        element={
          <ProtectedRoute>
            <CrearMantenimiento />
          </ProtectedRoute>
        }
      />
      <Route
        path="/asignaciones"
        element={
          <ProtectedRoute>
            <Asignaciones />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ambientes"
        element={
          <ProtectedRoute>
            <Ambientes />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
