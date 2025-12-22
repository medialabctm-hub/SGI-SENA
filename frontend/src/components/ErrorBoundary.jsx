import React from 'react';
import '../styles/errorBoundary.css';

/**
 * Error Boundary para capturar errores de React
 * Mejora el manejo de errores en el frontend
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Actualiza el estado para que la próxima renderización muestre la UI de error
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log del error para debugging
    console.error('Error capturado por ErrorBoundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // Aquí podrías enviar el error a un servicio de logging
    // Ejemplo: logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // UI personalizada de error
      return (
        <div className="error-boundary-container">
          <h2 className="error-boundary-title">
            ⚠️ Algo salió mal
          </h2>
          <p className="error-boundary-message">
            Ha ocurrido un error inesperado. Por favor, intenta recargar la página.
          </p>
          <div className="error-boundary-actions">
            <button
              onClick={this.handleReset}
              className="error-boundary-btn error-boundary-btn-primary"
            >
              Intentar de nuevo
            </button>
            <button
              onClick={() => window.location.reload()}
              className="error-boundary-btn error-boundary-btn-secondary"
            >
              Recargar página
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="error-boundary-details">
              <summary>
                Detalles del error (solo en desarrollo)
              </summary>
              <pre>
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;



