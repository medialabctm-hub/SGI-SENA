// Conexion a base de datos mySQL
import mysql from "mysql2/promise";
import { config } from "./config.js";

// Configuración de conexión optimizada para producción
// Ajusta connectionLimit según el entorno para mejor rendimiento
const getConnectionLimit = () => {
  if (process.env.DB_CONNECTION_LIMIT) {
    return parseInt(process.env.DB_CONNECTION_LIMIT, 10);
  }
  // Límite por defecto optimizado según entorno
  return process.env.NODE_ENV === 'production' ? 20 : 10;
};

export const dbConfig = {
  host: config.db.host,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  port: config.db.port,
  waitForConnections: true,
  connectionLimit: getConnectionLimit(),
  queueLimit: 0,
  // Configuraciones específicas para Railway/Producción
  // Habilitar SSL cuando se conecta a Railway (host remoto) incluso desde localhost
  ssl:
    (process.env.NODE_ENV === "production" || 
     config.db.host?.includes('railway') || 
     config.db.host?.includes('rlwy.net') ||
     config.db.host?.includes('shuttle.proxy'))
      ? { rejectUnauthorized: false }
      : false,
  // Configuración de timeout para conexiones lentas
  connectTimeout: 30000,
  // Configuración de charset
  charset: "utf8mb4",
  // Optimizaciones adicionales
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

// Función para crear conexiones individuales usando variables de entorno
// Reutiliza la configuración de dbConfig para evitar duplicación
export const createConnection = async () => {
  const connection = await mysql.createConnection({
    ...dbConfig,
    // Para conexiones individuales, no necesitamos connectionLimit
    connectionLimit: undefined,
    waitForConnections: undefined,
    queueLimit: undefined,
  });
  return connection;
};

// Pool de conexiones reutilizable (mantiene la funcionalidad existente)
export const pool = mysql.createPool(dbConfig);

// Wrapper de base de datos reutilizable (usado por DI container y defaultDb)
export const dbWrapper = {
  execute: async (query, params) => {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(query, params);
      return [rows];
    } finally {
      connection.release();
    }
  },
  pool, // Exponer el pool para transacciones
};

// Exportar como default para compatibilidad con healthcheck y controladores legacy
export default dbWrapper;