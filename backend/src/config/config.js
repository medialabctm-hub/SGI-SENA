import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Obtener la ruta del directorio actual
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno desde .env si existe (solo para desarrollo local)
// En producción (Docker/Railway), las variables vienen de process.env directamente
// Usar override: false para que las variables de Railway (process.env) tengan prioridad
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
  
const requiredEnvVars = [
  "DB_PASSWORD",
  "DB_HOST",
  "DB_USER",
  "DB_NAME",
  "BREVO_API_KEY",
  "BREVO_SENDER_EMAIL",
  "JWT_SECRET",
  "COOKIE_SECRET",
  "CORS_ORIGIN",
  "FRONTEND_URL",
];

// Verificar variables de entorno con logging detallado
const missingEnvVars = requiredEnvVars.filter((envVar) => {
  // Leer directamente de process.env (más confiable en Railway)
  const value = process.env[envVar];
  const exists = !!value && typeof value === 'string' && value.trim() !== '';
  
  // Log para debugging en Railway
  if (!exists) {
    console.warn(`[CONFIG] Variable de entorno faltante o vacía: ${envVar}`);
    // Mostrar todas las variables relacionadas para debugging
    const relatedVars = Object.keys(process.env).filter(k => 
      k.toUpperCase().includes(envVar.split('_')[0]) || 
      k.toUpperCase() === envVar.toUpperCase()
    );
    if (relatedVars.length > 0) {
      console.warn(`[CONFIG] Variables relacionadas encontradas: ${relatedVars.join(', ')}`);
    }
  } else {
    // Confirmar que la variable existe (sin mostrar el valor completo por seguridad)
    const preview = value.length > 20 ? value.substring(0, 20) + '...' : value.substring(0, value.length);
    console.log(`[CONFIG] ✓ ${envVar} configurada (${value.length} caracteres)`);
  }
  
  return !exists;
});

if (missingEnvVars.length > 0) {
  const brevoVars = Object.keys(process.env).filter(k => k.toUpperCase().includes('BREVO'));
  const emailVars = Object.keys(process.env).filter(k => k.toUpperCase().includes('EMAIL'));
  
  let errorMsg = `❌ ERROR: Faltan las siguientes variables de entorno requeridas: ${missingEnvVars.join(", ")}\n\n`;
  
  if (missingEnvVars.includes('BREVO_API_KEY')) {
    errorMsg += `📧 CONFIGURACIÓN DE BREVO:\n`;
    errorMsg += `   1. Ve a https://app.brevo.com/settings/keys/api\n`;
    errorMsg += `   2. Genera o copia tu API Key de Brevo\n`;
    errorMsg += `   3. En Railway, ve a Variables de Entorno y agrega:\n`;
    errorMsg += `      - BREVO_API_KEY=tu_api_key_aqui\n`;
    errorMsg += `      - BREVO_SENDER_EMAIL=tu_email_verificado@dominio.com\n\n`;
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
  errorMsg += `   En Railway, ve a tu proyecto > Variables y agrega todas las variables requeridas.\n`;
  errorMsg += `   Después de agregarlas, Railway reiniciará automáticamente el servicio.\n`;
  
  console.error('[CONFIG ERROR]', errorMsg);
  throw new Error(errorMsg);
}

export const config = {
  // Configuración del servidor
  server: {
    // En producción con Docker, el backend siempre usa 3000 (interno)
    // Railway asigna PORT para nginx, no para el backend
    PORT: process.env.BACKEND_PORT || process.env.PORT || 3000,
    mode: process.env.NODE_ENV,
  },

  // Configuración de la base de datos
  db: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
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

  // Configuración de correo electrónico (Brevo)
  email: {
    user: process.env.EMAIL_USER || process.env.BREVO_SENDER_EMAIL,
    password: process.env.EMAIL_PASSWORD, // Mantener para compatibilidad
    brevoApiKey: process.env.BREVO_API_KEY,
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
