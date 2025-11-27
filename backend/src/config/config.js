import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Obtener la ruta del directorio actual
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno desde .env si existe (solo para desarrollo local)
// En producción (Docker/Railway), las variables vienen de process.env directamente
dotenv.config({ path: join(__dirname, "../../.env") });

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

// Validar variables de entorno requeridas (solo las críticas)
const requiredEnvVars = [
  "DB_PASSWORD",
  "DB_HOST",
  "DB_USER",
  "DB_NAME",
  "JWT_SECRET",
  "COOKIE_SECRET",
  "EMAIL_USER",
  "EMAIL_PASSWORD",
  "CORS_ORIGIN",
  "FRONTEND_URL",
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Faltan las siguientes variables de entorno requeridas: ${missingEnvVars.join(", ")}`,
  );
}

export const config = {
  // Configuración del servidor
  server: {
    PORT: process.env.PORT,
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

  // Configuración de correo electrónico
  email: {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
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
