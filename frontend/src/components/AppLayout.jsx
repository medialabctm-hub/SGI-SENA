import React from 'react'
import Header from './Header'
import Sidebar from './Sidebar'

/**
 * Layout estándar de las pantallas autenticadas.
 *
 * La estructura del DOM es obligatoria y no debe alterarse: el CSS de
 * `styles/layout/sidebar.css` reserva la altura del header
 * (`height: calc(100vh - 140px)`) asumiendo que este queda POR ENCIMA de
 * `.dashboard-layout`. Si el header se coloca dentro de `<main>`, el sidebar
 * sube al borde superior de la página y el header hace scroll con el contenido
 * (ver BUG-02 en Documentation/BUGS_Y_ERRORES.md).
 *
 * @param {Object}          props
 * @param {Object}          [props.user]      Usuario para el Sidebar (define el menú por rol)
 * @param {string}          [props.className] Clases extra para el contenedor `.page`
 * @param {React.ReactNode} props.children    Contenido del área principal
 */
export default function AppLayout({ user, className = '', children }) {
  const pageClassName = ['page', 'simple-page', className].filter(Boolean).join(' ')

  return (
    <div className={pageClassName}>
      <Header />
      <div className="dashboard-layout">
        <Sidebar user={user} />
        <main className="dashboard-main">
          {children}
        </main>
      </div>
    </div>
  )
}
