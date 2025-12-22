import { useEffect, useState } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import ImportarAprendices from '../components/ImportarAprendices'
import '../styles/usuarios.css'

export default function Aprendices() {
  const [currentUser, setCurrentUser] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user')
      if (stored) {
        setCurrentUser(JSON.parse(stored))
      }
    } catch (err) {
      console.warn('No se pudo leer el usuario de la sesión', err)
    }
  }, [])

  const isAdmin = currentUser?.nombre_rol === 'Administrador'

  return (
    <div className="page simple-page">
      <Header />
      <div className="dashboard-layout">
        <Sidebar user={currentUser} />
        <main className="dashboard-main">
          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          )}

          <div className="users-panel">
            <div className="users-toolbar">
              <div>
                <h2>Importar Aprendices</h2>
                <p style={{ margin: '0.25rem 0 0', color: '#4b5563' }}>
                  Registra las fichas y jornadas de los aprendices para vincularlos al seguimiento académico.
                </p>
              </div>
            </div>

            <div className="users-content">
              {isAdmin ? (
                <div
                  style={{
                    background: '#fff',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.07)',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <section style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 0.5rem', color: '#0f172a' }}>Requisitos del archivo</h3>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#475569', lineHeight: 1.5 }}>
                      <li>Formato Excel (.xlsx / .xls) con las columnas: Ficha, Nombre, Documento y Jornada.</li>
                      <li>La columna Jornada acepta los valores Mañana, Tarde o Noche.</li>
                      <li>El documento debe ser único; los registros duplicados se rechazan automáticamente.</li>
                    </ul>
                  </section>

                  <ImportarAprendices
                    onImportComplete={(resultados) => {
                      const type = resultados.fallidos === 0 ? 'success' : 'warning'
                      setToast({
                        message: `Importación completada: ${resultados.exitosos} exitosos, ${resultados.fallidos} fallidos`,
                        type
                      })
                    }}
                  />
                </div>
              ) : (
                <div className="users-empty">
                  <div>
                    <strong>No tienes permisos para importar aprendices</strong>
                    <div className="users-empty-message">
                      Solo los administradores pueden acceder a esta herramienta.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
