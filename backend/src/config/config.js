import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Obtener la ruta del directorio actual
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno desde .env si existe (solo para desarrollo local)
// En producción (Docker), las variables vienen de process.env directamente
// Usar override: false para que las variables de process.env tengan prioridad
const envPath = join(__dirname, "../../.env");
dotenv.config({ path: envPath, override: false });

// Establecer valores por defecto para variables opcionales
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}
if (!process.env.LOG_LEVEL) {
  process.env.LOG_LEVEL = 'info';
}
if (!process.env.DB_PORT) {
  process.env.DB_PORT = '3306';
}
if (!process.env.PORT) {
  process.env.PORT = '3000';
}
if (!process.env.JWT_EXPIRES_IN) {
  process.env.JWT_EXPIRES_IN = '24h';
}
if (!process.env.JWT_REFRESH_EXPIRES_IN) {
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
}
if (!process.env.JWT_ISSUER) {
  process.env.JWT_ISSUER = 'gse-app';
}
if (!process.env.JWT_AUDIENCE) {
  process.env.JWT_AUDIENCE = 'gse-users';
}
  
// Variables de base de datos: acepta tanto formato estándar (DB_*) como alternativo (MYSQL*)
const getDbConfig = () => {
  return {
    host: process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST,
    user: process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER,
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD,
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE,
    port: process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306,
  };
};

const dbConfig = getDbConfig();

// Verificar configuración de BD primero (puede venir de DB_* o MYSQL*)
// Verificar que los valores no estén vacíos ni sean solo espacios
const dbConfigValid = {
  host: !!dbConfig.host && typeof dbConfig.host === 'string' && dbConfig.host.trim() !== '',
  user: !!dbConfig.user && typeof dbConfig.user === 'string' && dbConfig.user.trim() !== '',
  password: !!dbConfig.password && typeof dbConfig.password === 'string' && dbConfig.password.trim() !== '',
  database: !!dbConfig.database && typeof dbConfig.database === 'string' && dbConfig.database.trim() !== '',
  port: !!dbConfig.port && (typeof dbConfig.port === 'string' || typeof dbConfig.port === 'number'),
};

// Si falta alguna variable de BD, agregar a errores
const dbErrors = [];
if (!dbConfigValid.host) dbErrors.push('DB_HOST o MYSQLHOST');
if (!dbConfigValid.user) dbErrors.push('DB_USER o MYSQLUSER');
if (!dbConfigValid.password) dbErrors.push('DB_PASSWORD o MYSQLPASSWORD');
if (!dbConfigValid.database) dbErrors.push('DB_NAME o MYSQLDATABASE');
if (!dbConfigValid.port) dbErrors.push('DB_PORT o MYSQLPORT');

// Variables requeridas (excluyendo BD que se valida por separado)
const requiredEnvVars = [
  "BREVO_API_KEY",
  "BREVO_SENDER_EMAIL",
  "JWT_SECRET",
  "COOKIE_SECRET",
  "CORS_ORIGIN",
  "FRONTEND_URL",
];

// Verificar variables de entorno requeridas (excluyendo BD)
const missingEnvVars = requiredEnvVars.filter((envVar) => {
  const value = process.env[envVar];
  const exists = !!value && typeof value === 'string' && value.trim() !== '';
  return !exists;
});

  // Combinar errores de BD con errores de otras variables
  const allErrors = [...dbErrors, ...missingEnvVars];
  
  if (allErrors.length > 0) {
    const brevoVars = Object.keys(process.env).filter(k => k.toUpperCase().includes('BREVO'));
    const emailVars = Object.keys(process.env).filter(k => k.toUpperCase().includes('EMAIL'));
    
    let errorMsg = `❌ ERROR: Faltan las siguientes variables de entorno requeridas: ${allErrors.join(", ")}\n\n`;
    
    if (missingEnvVars.includes('BREVO_API_KEY')) {
      const hasSmtpKey = !!process.env.BREVO_SMTP_KEY;
      
      errorMsg += `📧 CONFIGURACIÓN DE BREVO API:\n`;
      
      if (hasSmtpKey) {
        errorMsg += `   ⚠️  Tienes BREVO_SMTP_KEY configurada, pero ahora necesitas BREVO_API_KEY\n`;
        errorMsg += `   📝 REEMPLAZA la variable BREVO_SMTP_KEY por BREVO_API_KEY:\n\n`;
        errorMsg += `   1. Ve a https://app.brevo.com/settings/keys/api (pestaña API Keys)\n`;
        errorMsg += `   2. Genera o copia tu API Key de Brevo\n`;
        errorMsg += `   3. En tu archivo .env o variables de entorno:\n`;
        errorMsg += `      ❌ ELIMINA: BREVO_SMTP_KEY\n`;
        errorMsg += `      ✅ AGREGA: BREVO_API_KEY=tu_api_key_aqui\n`;
        errorMsg += `      ✅ MANTÉN: BREVO_SENDER_EMAIL=tu_email_verificado@dominio.com\n\n`;
      } else {
        errorMsg += `   1. Ve a https://app.brevo.com/settings/keys/api (pestaña API Keys)\n`;
        errorMsg += `   2. Genera o copia tu API Key de Brevo\n`;
        errorMsg += `   3. En tu archivo .env o variables de entorno, agrega:\n`;
        errorMsg += `      - BREVO_API_KEY=tu_api_key_aqui\n`;
        errorMsg += `      - BREVO_SENDER_EMAIL=tu_email_verificado@dominio.com\n\n`;
      }
    }
  
  errorMsg += `🔍 DIAGNÓSTICO:\n`;
  errorMsg += `   - Variables detectadas en process.env: ${Object.keys(process.env).length} totales\n`;
  if (brevoVars.length > 0) {
    errorMsg += `   - Variables relacionadas con BREVO encontradas: ${brevoVars.join(', ')}\n`;
  } else {
    errorMsg += `   - ⚠️  No se encontraron variables relacionadas con BREVO\n`;
  }
  if (emailVars.length > 0) {
    errorMsg += `   - Variables relacionadas con EMAIL encontradas: ${emailVars.join(', ')}\n`;
  }
  
  errorMsg += `\n💡 SOLUCIÓN:\n`;
  errorMsg += `   Agrega todas las variables requeridas en tu archivo .env o variables de entorno.\n`;
  errorMsg += `   Después de agregarlas, reinicia el servicio.\n`;
  
  console.error('[CONFIG ERROR]', errorMsg);
  throw new Error(errorMsg);
}

export const config = {
  // Configuración del servidor
  server: {
    // En producción con Docker, el backend siempre usa 3000 (interno)
    PORT: process.env.BACKEND_PORT || process.env.PORT || 3000,
    mode: process.env.NODE_ENV,
  },

  // Configuración de la base de datos
  // Soporta tanto variables estándar (DB_*) como variables alternativas (MYSQL*)
  db: {
    host: process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST,
    user: process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER,
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD,
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE,
    port: process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306,
  },

  // Configuración de JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    issuer: process.env.JWT_ISSUER || "gse-app",
    audience: process.env.JWT_AUDIENCE || "gse-users",
  },

  // Configuración de CORS
  cors: {
    origin: process.env.CORS_ORIGIN,
  },

  // Configuración de cookies
  cookie: {
    secret: process.env.COOKIE_SECRET,
  },

  // Configuración de correo electrónico (Brevo API)
  email: {
    user: process.env.EMAIL_USER || process.env.BREVO_SENDER_EMAIL,
    brevoApiKey: process.env.BREVO_API_KEY,
    brevoSenderEmail: process.env.BREVO_SENDER_EMAIL,
  },

  // URL del frontend
  frontendUrl: process.env.FRONTEND_URL,

  // Configuración de logging
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },

  // Configuración de webhook
  webhook: {
    secret: process.env.WEBHOOK_SECRET,
  },
};

// Función para validar configuración según el entorno
export const validateConfig = () => {
  const errors = [];

  // Validaciones específicas para producción
  if (process.env.NODE_ENV === "production") {
    if (
      !process.env.JWT_SECRET ||
      process.env.JWT_SECRET ===
        "your-super-secret-jwt-key-change-in-production"
    ) {
      errors.push(
        "JWT_SECRET debe ser configurado con un valor seguro en producción",
      );
    }

    if (!process.env.COOKIE_SECRET) {
      errors.push("COOKIE_SECRET es requerido en producción");
    }

    if (!process.env.CORS_ORIGIN) {
      errors.push("CORS_ORIGIN debe ser configurado en producción");
    }
  }

  return errors;
};

// Función para obtener configuración según el entorno
export const getConfig = (env = process.env.NODE_ENV) => {
  const currentConfig = { ...config };

  if (env === "production") {
    // Configuraciones específicas para producción
    currentConfig.server.port = process.env.PORT || 3000;
    currentConfig.cors.origin = process.env.CORS_ORIGIN;
    currentConfig.jwt.secret = process.env.JWT_SECRET;
  } else if (env === "development") {
    // Configuraciones específicas para desarrollo
    currentConfig.server.port = process.env.PORT || 3000;
    currentConfig.cors.origin =
      process.env.CORS_ORIGIN || "http://localhost:5173";
    currentConfig.logging.level = "debug";
  }

  return currentConfig;
};
