/**
 * Loader reutilizable (barras equalizer verde SENA) y página de demo.
 * - LoadingScreen: componente para usar en cualquier pantalla de carga.
 * - LoadingDemo (default): página /loading-demo para previsualizar.
 */
import '../styles/pages/loading-demo.css';

const BARS = 9;

/**
 * Loader reutilizable. fullPage=true para pantalla completa; fullPage=false para incrustar en un bloque.
 * @param {boolean} fullPage - Si true, envuelve en contenedor a pantalla completa con marca SGI-SENA.
 * @param {string} message - Texto bajo las barras (por defecto "Cargando" con puntos animados).
 */
export function LoadingScreen({ fullPage = false, message }) {
  const content = (
    <div className="loading-demo-container">
      <div className="loading-demo-loader" aria-hidden="true">
        {Array.from({ length: BARS }, (_, i) => (
          <div
            key={i}
            className="loading-demo-bar"
            style={{ '--i': i }}
          />
        ))}
      </div>
      <p className="loading-demo-text">
        <span className="loading-demo-dots">{message ?? 'Cargando'}</span>
      </p>
    </div>
  );

  if (fullPage) {
    return (
      <div className="loading-demo-page">
        <p className="loading-demo-brand">SGI-SENA</p>
        {content}
      </div>
    );
  }

  return content;
}

/** Página aislada para previsualizar la animación. Ruta: /loading-demo */
export default function LoadingDemo() {
  return <LoadingScreen fullPage />;
}
