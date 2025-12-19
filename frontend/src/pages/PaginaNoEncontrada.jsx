import React from 'react';
import { Link } from 'react-router-dom';
import "../index.css";

function PaginaNoEncontrada() {
  React.useEffect(() => {
    document.title = 'Página no encontrada | SGI SENA';
    const meta = document.querySelector('meta[name="robots"]');
    if (meta) {
      meta.setAttribute('content', 'noindex, follow');
    } else {
      const metaTag = document.createElement('meta');
      metaTag.name = 'robots';
      metaTag.content = 'noindex, follow';
      document.head.appendChild(metaTag);
    }
  }, []);

  return (
    <main aria-label="Página no encontrada" className="pagina-no-encontrada" role="main">
      <img className="cat_404" src="/images/404_image.png" alt="cat 404" />

      <h1 className="pagina-no-encontrada__titulo">¡Oops! Página no encontrada</h1>
      <p className="pagina-no-encontrada__descripcion">
        Lo sentimos, la página que buscas no existe o ha sido movida.
        <br />
        Por favor, verifica la URL o vuelve al inicio.
      </p>
      <Link aria-label="Volver al inicio" className="pagina-no-encontrada__boton" to="/">
        Volver al inicio
      </Link>
    </main>
  );
}

export default PaginaNoEncontrada;
