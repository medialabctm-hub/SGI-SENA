import express from "express";
import { config } from "../config/config.js";
import { default as db } from "../config/dbconfig.js";


const router = express.Router();

/**
 * Health Check Endpoint - Versión rápida para Railway
 * Verifica el estado básico de la aplicación
 */
router.get("/health", async (req, res) => {
  const healthCheck = {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.server.mode,
    version: process.env.npm_package_version || "1.0.0",
    checks: {
      server: "OK",
      memory: "OK",
    },
  };

  try {
    // Verificar memoria
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

    if (memoryUsageMB > 1000) {
      // Más de 1GB
      healthCheck.checks.memory = "WARNING";
      healthCheck.warnings = healthCheck.warnings || [];
      healthCheck.warnings.push(`High memory usage: ${memoryUsageMB}MB`);
    }

    // Respuesta rápida para Railway
    res.status(200).json(healthCheck);
  } catch (error) {
    res.status(503).json({
      status: "ERROR",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * Health Check Endpoint Completo
 * Verifica el estado de la aplicación y sus dependencias (incluyendo DB)
 */
router.get("/health/full", async (req, res) => {
  const healthCheck = {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.server.mode,
    version: process.env.npm_package_version || "1.0.0",
    checks: {
      server: "OK",
      database: "CHECKING",
      memory: "OK",
      disk: "OK",
    },
  };

  try {
    // Verificar memoria
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

    if (memoryUsageMB > 500) {
      // Más de 500MB
      healthCheck.checks.memory = "WARNING";
      healthCheck.warnings = healthCheck.warnings || [];
      healthCheck.warnings.push(`High memory usage: ${memoryUsageMB}MB`);
    }

    // Verificar base de datos
    try {
      await db.execute("SELECT 1");
      healthCheck.checks.database = "OK";
    } catch (dbError) {
      healthCheck.checks.database = "ERROR";
      healthCheck.status = "ERROR";
      healthCheck.errors = healthCheck.errors || [];
      healthCheck.errors.push(`Database connection failed: ${dbError.message}`);
    }

    // Determinar código de respuesta HTTP
    const httpStatus = healthCheck.status === "OK" ? 200 : 503;

    res.status(httpStatus).json(healthCheck);
  } catch (error) {
    res.status(503).json({
      status: "ERROR",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * Readiness Check
 * Verifica si la aplicación está lista para recibir tráfico
 */
router.get("/ready", async (req, res) => {
  try {
    // Verificar dependencias críticas
    await db.execute("SELECT 1");

    res.status(200).json({
      status: "READY",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "NOT_READY",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * Liveness Check
 * Verifica si la aplicación está viva (para Kubernetes)
 */
router.get("/live", (req, res) => {
  res.status(200).json({
    status: "ALIVE",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Metrics endpoint básico
 */
router.get("/metrics", (req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    platform: process.platform,
    nodeVersion: process.version,
    pid: process.pid,
  };

  res.json(metrics);
});

export default router;
