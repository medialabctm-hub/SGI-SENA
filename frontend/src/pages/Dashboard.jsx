import React, { useState } from 'react'
import Header from '../components/Header'
import Card from '../components/Card'
import NotificationsModal from '../components/NotificationsModal'
import { FiPlus, FiSearch, FiUsers, FiSettings } from 'react-icons/fi'

const stats = [
  { label: 'Equipos', value: 125, color: '#e6f2ff' },
  { label: 'Usuarios', value: 48, color: '#e9f7ec' },
  { label: 'Alertas', value: 3, color: 'var(--warning-200)' },
]

export default function Dashboard() {
  const [showNotifications, setShowNotifications] = useState(false)

  return (
    <div className="page dashboard-page">
      <Header onOpenNotifications={() => setShowNotifications(true)} />

      <main className="container">
        <div className="welcome-card">
          <h2>¡Bienvenido!</h2>
          <p>Sistema de Gestión de Equipos SENA</p>
        </div>

        <div className="cards-grid">
          <Card title="Registrar Equipo" subtitle="Agregar nuevo equipo" icon={<FiPlus />} to="/equipos" />
          <Card title="Consultar Equipo" subtitle="Buscar equipos" icon={<FiSearch />} to="/equipos/consultar" />
          <Card title="Personal Registrado" subtitle="Ver usuarios" icon={<FiUsers />} to="/usuarios" />
          <Card title="Configuración" subtitle="Ajustes del sistema" icon={<FiSettings />} to="/config" />
        </div>

        <div className="stats-card">
          <h3>Estadísticas Rápidas</h3>
          <div className="stats-row">
            {stats.map((s) => (
              <div key={s.label} className="stat-box" style={{ background: s.color }}>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {showNotifications && <NotificationsModal onClose={() => setShowNotifications(false)} />}
    </div>
  )
}
