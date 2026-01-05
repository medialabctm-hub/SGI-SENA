import React, { useEffect, useState } from 'react';
import { FiX, FiChevronLeft, FiChevronRight, FiStar } from 'react-icons/fi';
import '../styles/imageViewer.css';

/**
 * Componente ImageViewer - Lightbox para ver imágenes en tamaño original
 * 
 * @param {Object} props
 * @param {Array} props.images - Array de objetos con { url, titulo, descripcion?, es_principal? }
 * @param {number} props.currentIndex - Índice de la imagen actual a mostrar
 * @param {Function} props.onClose - Función que se ejecuta al cerrar el viewer
 * @param {Function} props.onImageChange - Función opcional que se ejecuta al cambiar de imagen (recibe el nuevo índice)
 */




export default function ImageViewer({ images = [], currentIndex = 0, onClose, onImageChange }) {
  const [currentImgIndex, setCurrentImgIndex] = useState(currentIndex);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const handleImageClick = () => {
    setZoomed(!zoomed);
  };

  useEffect(() => {
    setCurrentImgIndex(currentIndex);
    setImageLoaded(false);
  }, [currentIndex]);

  useEffect(() => {
    // Ocultar header y sidebar cuando el viewer está abierto
    document.body.classList.add('image-viewer-open');
    const header = document.querySelector('.app-header-wrapper');
    const sidebar = document.querySelector('.app-sidebar');
    if (header) header.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';

    // Manejar teclado
    const handleKeyPress = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowLeft' && images.length > 1) {
        handlePrev();
      } else if (e.key === 'ArrowRight' && images.length > 1) {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      document.body.classList.remove('image-viewer-open');
      if (header) header.style.display = '';
      if (sidebar) sidebar.style.display = '';
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [images.length]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };

  const handlePrev = () => {
    if (images.length === 0) return;
    const newIndex = (currentImgIndex - 1 + images.length) % images.length;
    setCurrentImgIndex(newIndex);
    setImageLoaded(false);
    if (onImageChange) {
      onImageChange(newIndex);
    }
  };

  const handleNext = () => {
    if (images.length === 0) return;
    const newIndex = (currentImgIndex + 1) % images.length;
    setCurrentImgIndex(newIndex);
    setImageLoaded(false);
    if (onImageChange) {
      onImageChange(newIndex);
    }
  };

  if (!images || images.length === 0 || currentImgIndex < 0 || currentImgIndex >= images.length) {
    return null;
  }

  const currentImage = images[currentImgIndex];

  return (
    <div 
      className="image-viewer-overlay"
      onClick={handleClose}
    >
      <div 
        className="image-viewer-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón cerrar */}
        <button
          className="image-viewer-close"
          onClick={handleClose}
          aria-label="Cerrar"
        >
          <FiX size={24} />
        </button>

        {/* Navegación (solo si hay más de una imagen) */}
        {images.length > 1 && (
          <>
            <button
              className="image-viewer-nav image-viewer-nav-prev"
              onClick={handlePrev}
              aria-label="Imagen anterior"
            >
              <FiChevronLeft size={32} />
            </button>
            <button
              className="image-viewer-nav image-viewer-nav-next"
              onClick={handleNext}
              aria-label="Imagen siguiente"
            >
              <FiChevronRight size={32} />
            </button>
          </>
        )}

        {/* Contenedor de imagen */}
        <div className="image-viewer-image-container">
          {!imageLoaded && (
            <div className="image-viewer-loading">
              <div className="image-viewer-spinner"></div>
            </div>
          )}
          <img
            src={currentImage.url}
            alt={currentImage.titulo || currentImage.descripcion || 'Imagen'}
            onClick={handleImageClick} 
            onLoad={() => setImageLoaded(true)}
            onError={(e) => {
              console.error('Error al cargar imagen:', currentImage.url);
              e.target.style.display = 'none';
              setImageLoaded(true);
            }}
            className={`image-viewer-image ${zoomed ? 'zoomed' : ''} ${imageLoaded ? 'image-viewer-img-visible' : 'image-viewer-img-hidden'}`}
          />
        </div>

        {/* Información de la imagen */}
        <div className="image-viewer-info">
          <div className="image-viewer-info-header">
            <h4>{currentImage.titulo || 'Imagen'}</h4>
            {currentImage.es_principal && (
              <span className="image-viewer-badge">
                <FiStar size={14} />
                Principal
              </span>
            )}
          </div>
          {currentImage.descripcion && (
            <p className="image-viewer-description">{currentImage.descripcion}</p>
          )}
          {images.length > 1 && (
            <div className="image-viewer-counter">
              {currentImgIndex + 1} / {images.length}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

