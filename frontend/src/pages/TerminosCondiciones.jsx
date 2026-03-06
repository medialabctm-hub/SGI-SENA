import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import InteractiveBackground from '../components/InteractiveBackground';
import '../styles/auth.css';

export default function TerminosCondiciones() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Términos y Condiciones | SGISENA';
  }, []);

  return (
    <div className="page login-page animated-bg">
      <InteractiveBackground />
      <div className="login-card" aria-labelledby="terminos-titulo" style={{ width: '800px' }}>
        <div className="logo-box">
          <div className="logo">
            <img src="/images/logoSena.png" alt="Logo SENA" />
          </div>
        </div>

        <h1 id="terminos-titulo" className="title">
          Términos y Condiciones
        </h1>
        <p className="subtitle">Sistema de Gestión de Inventarios SGISENA</p>

        <div className="form terms-content">
          <section aria-label="Finalidad del tratamiento de datos">
            <h2 className="subtitle" style={{ marginTop: 0 }}>
              1. Finalidad del tratamiento de datos personales
            </h2>
            <p>
              El sistema SGISENA recolecta y trata tus datos personales con el fin de gestionar el
              uso, asignación, préstamo, devolución y trazabilidad de equipos, ambientes y recursos
              tecnológicos del SENA. La información registrada será utilizada exclusivamente para
              fines institucionales y para dar cumplimiento a las normas internas y a la
              normatividad vigente aplicable al tratamiento de datos personales.
            </p>
          </section>

          <section aria-label="Datos personales tratados">
            <h2 className="subtitle">2. Datos personales que se recopilan</h2>
            <p>En el registro y uso del sistema se pueden recopilar, entre otros, los siguientes datos:</p>
            <ul style={{ paddingLeft: '1.4rem' }}>
              <li>Cedula del Usuario.</li>
              <li>Nombre completo del usuario.</li>
              <li>Tipo y número de documento de identificación.</li>
              <li>Correo electrónico institucional o personal.</li>
              <li>Número de teléfono de contacto.</li>
              <li>Rol dentro del sistema (por ejemplo, Aprendiz, Instructor, Coordinador, etc.).</li>
              <li>
                Información asociada al uso de equipos y ambientes (registros de préstamos,
                devoluciones, novedades, mantenimientos y verificaciones).
              </li>
            </ul>
          </section>

          <section aria-label="Uso y conservación de los datos">
            <h2 className="subtitle">3. Uso, conservación y acceso a la información</h2>
            <p>
              Tus datos serán almacenados de forma segura y solo serán accesibles por el personal
              autorizado del SENA y por los usuarios con permisos adecuados dentro del sistema,
              según su rol. La información podrá ser utilizada para:
            </p>
            <ul style={{ paddingLeft: '1.4rem' }}>
              <li>Gestionar tu cuenta y tu acceso al sistema SGISENA.</li>
              <li>Registrar el historial de uso, préstamo y custodia de equipos y ambientes.</li>
              <li>
                Generar reportes, estadísticas y trazabilidad para la toma de decisiones y el
                cumplimiento de obligaciones institucionales.
              </li>
              <li>Atender solicitudes de control interno, auditoría o requerimientos legales.</li>
            </ul>
          </section>

          <section aria-label="Tratamiento de datos personales">
            <h2 className="subtitle">4. Política de Tratamiento de Datos Personales</h2>
            <p>
              El tratamiento de tus datos personales se realiza de conformidad con la normatividad
              colombiana sobre protección de datos personales y con las políticas internas del SENA.
              Tus datos no serán vendidos, arrendados ni cedidos a terceros sin tu autorización
              expresa, salvo obligación legal o requerimiento de autoridad competente.
            </p>
            <p>
              Como titular de la información, tienes derecho a conocer, actualizar y rectificar tus
              datos personales, solicitar la supresión de los mismos cuando sea procedente y
              revocar la autorización otorgada para su tratamiento, de acuerdo con los canales y
              procedimientos definidos por el SENA.
            </p>
          </section>

          <section aria-label="Responsabilidades del usuario">
            <h2 className="subtitle">5. Responsabilidades del usuario</h2>
            <p>Al registrarte y utilizar el sistema SGISENA, te comprometes a:</p>
            <ul style={{ paddingLeft: '1.4rem' }}>
              <li>Proporcionar información veraz, actual y completa.</li>
              <li>No compartir tu usuario y contraseña con terceros.</li>
              <li>Usar el sistema únicamente para los fines autorizados institucionalmente.</li>
              <li>
                Cumplir con las normas internas del SENA relacionadas con el uso y cuidado de los
                equipos y ambientes.
              </li>
            </ul>
          </section>

          <section aria-label="Contacto y soporte">
            <h2 className="subtitle">6. Contacto para ejercer tus derechos</h2>
            <p>
              Para ejercer tus derechos como titular de los datos personales, o para resolver dudas
              sobre el tratamiento de tu información en el sistema SGISENA, puedes comunicarte con
              la coordinación del ambiente o centro de formación correspondiente, o con los canales
              oficiales del SENA destinados para la atención de solicitudes de datos personales.
            </p>
          </section>
        </div>

        <button
          type="button"
          className="btn-TerminosCondiciones"
          style={{ marginTop: '16px' }}
          onClick={() => navigate('/register')}
        >
          Volver
        </button>
      </div>
    </div>
  );
}

