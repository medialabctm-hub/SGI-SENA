import defaultDb from '../config/dbconfig.js';
import XLSX from 'xlsx';
import bcrypt from 'bcrypt';
import emailService from '../services/emailService.js';
import { logger } from '../utils/logger.js';

/**
 * Importar equipos desde archivo Excel
 */
export async function importarEquipos(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      return res.status(400).json({ error: 'El archivo Excel está vacío' });
    }

    const resultados = {
      total: data.length,
      exitosos: 0,
      fallidos: 0,
      errores: []
    };

    const userId = req.user?.id || null;

    // Procesar cada fila
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const numeroFila = i + 2; // +2 porque la fila 1 es el encabezado y empezamos desde 0

      try {
        // Mapear columnas del Excel a campos de la BD (nuevos campos y compatibilidad con antiguos)
        const placa = String(row['Placa'] || row['placa'] || row['PLACA'] || '').trim();
        const codigoInventario = String(row['R Centro'] || row['r_centro'] || row['codigo_inventario'] || row['Código Inventario'] || row['CODIGO_INVENTARIO'] || '').trim();
        const tipo = String(row['Tipo'] || row['tipo'] || row['TIPO'] || '').trim();
        const marca = String(row['Marca'] || row['marca'] || row['MARCA'] || '').trim();
        const modelo = String(row['Modelo'] || row['modelo'] || row['MODELO'] || '').trim();
        const numeroSerie = String(row['Consecutivo'] || row['consecutivo'] || row['numero_serie'] || row['Número Serie'] || row['NUMERO_SERIE'] || '').trim();
        const descripcion = row['Descripcion'] || row['descripcion'] || row['Descripción'] || row['DESCRIPCION'] || null;
        const fechaAdquisicion = row['Fecha Adquisición'] || row['fecha_adquisicion'] || row['Fecha Adquisicion'] || row['FECHA_ADQUISICION'] || null;
        
        // Ajuste para leer Valor Ingreso correctamente, manejando posibles formatos de moneda
        let costo = row['Valor Ingreso'] || row['valor_ingreso'] || row['costo'] || row['Costo'] || row['COSTO'] || null;
        if (costo && typeof costo === 'string') {
          // Eliminar símbolos de moneda, puntos de miles y espacios
          // Asumiendo formato: $ 126.050,00 o 126.050
          // Si usa coma para decimales y punto para miles
          costo = costo.replace(/[^\d.,-]/g, ''); 
          if (costo.includes('.') && costo.includes(',')) {
             // Formato complejo (ej: 1.234,56), eliminar puntos y reemplazar coma por punto
             costo = costo.replace(/\./g, '').replace(',', '.');
          } else if (costo.includes(',')) {
             // Solo coma (ej: 1234,56), reemplazar por punto
             costo = costo.replace(',', '.');
          }
          // Si solo tiene puntos y son separadores de miles (ej: 126.050), eliminarlos
          // Riesgo: 126.050 podría ser 126 con 050 decimales en formato US. 
          // Asumiremos formato local (punto = mil) si el valor parece alto o entero
        }

        const vidaUtilMeses = row['vida_util_meses'] || row['Vida Útil (meses)'] || row['VIDA_UTIL_MESES'] || null;
        const estadoFisico = String(row['Estado Físico'] || row['estado_fisico'] || row['Estado Fisico'] || row['ESTADO_FISICO'] || 'Bueno').trim();
        const ambiente = String(row['Ambiente'] || row['ambiente'] || row['AMBIENTE'] || row['codigo_ambiente'] || row['Código Ambiente'] || '').trim();
        const specsCompletas = row['Atributos'] || row['atributos'] || row['specs_completas'] || row['Especificaciones'] || row['SPECS_COMPLETAS'] || null;
        // Campos nuevos
        const rCentro = String(row['R Centro'] || row['r_centro'] || codigoInventario || '').trim() || null;
        const atributos = row['Atributos'] || row['atributos'] || specsCompletas || null;
        const valorIngreso = costo; // Usar el costo procesado
        const comentarios = row['Comentarios'] || row['comentarios'] || row['COMENTARIOS'] || null;

        // Validaciones básicas
        // AHORA: Validamos 'placa' en lugar de 'codigoInventario'
        if (!placa) {
          resultados.errores.push({
            fila: numeroFila,
            codigo: placa || 'N/A',
            error: 'La placa es obligatoria'
          });
          resultados.fallidos++;
          continue;
        }

        if (!tipo || !modelo || !numeroSerie) {
          resultados.errores.push({
            fila: numeroFila,
            codigo: placa,
            error: 'Faltan campos obligatorios: tipo, modelo o consecutivo'
          });
          resultados.fallidos++;
          continue;
        }

        // Validar placa única
        if (placa) {
           const [[placaExistente]] = await defaultDb.execute(
            'SELECT codigo_equipo FROM Elementos WHERE placa = ? LIMIT 1',
            [placa]
          );
          if (placaExistente) {
             resultados.errores.push({
              fila: numeroFila,
              codigo: placa,
              error: 'La placa ya está registrada'
            });
            resultados.fallidos++;
            continue;
          }
        }

        // Validar consecutivo único (si se proporciona)
        // NOTA: Se permite consecutivo duplicado bajo solicitud del usuario ("el consecutivo esta dando problemas")
        /*
        if (numeroSerie) {
          const [[serieExistente]] = await defaultDb.execute(
            'SELECT codigo_equipo FROM Elementos WHERE consecutivo = ? LIMIT 1',
            [numeroSerie]
          );
          if (serieExistente) {
            resultados.errores.push({
              fila: numeroFila,
              codigo: placa || numeroSerie,
              error: 'El consecutivo ya está registrado'
            });
            resultados.fallidos++;
            continue;
          }
        }
        */

        // Resolver categoría
        // Buscar por nombre o por ID (si el dato es numérico)
        let categoriaInfo = null;
        
        // Intentar buscar
        const [[cat]] = await defaultDb.execute(
          'SELECT id_categoria FROM Categorias_Equipo WHERE nombre_categoria = ? OR id_categoria = ? LIMIT 1',
          [tipo, tipo]
        );
        
        if (!cat?.id_categoria) {
          resultados.errores.push({
            fila: numeroFila,
            codigo: placa,
            error: `Categoría "${tipo}" no encontrada. Debe existir en Categorias_Equipo (por nombre o ID)`
          });
          resultados.fallidos++;
          continue;
        }
        const categoriaId = cat.id_categoria;

        // Resolver ambiente
        let ambienteId = null;
        if (ambiente) {
          const [[amb]] = await defaultDb.execute(
            'SELECT id_ambiente FROM Ambientes WHERE id_ambiente = ? OR codigo_ambiente = ? OR nombre_ambiente = ? LIMIT 1',
            [ambiente, ambiente, ambiente]
          );
          ambienteId = amb?.id_ambiente || null;
        }
        if (!ambienteId) {
          resultados.errores.push({
            fila: numeroFila,
            codigo: placa,
            error: `Ambiente "${ambiente}" no encontrado`
          });
          resultados.fallidos++;
          continue;
        }

        // Validar estado físico
        const estadosValidos = ['Nuevo', 'Bueno', 'Regular', 'Malo', 'Dañado'];
        const estadoFisicoValido = estadosValidos.includes(estadoFisico) ? estadoFisico : 'Bueno';

        // Convertir fecha
        let fechaAdq = null;
        if (fechaAdquisicion) {
          if (typeof fechaAdquisicion === 'number') {
            // Excel almacena fechas como números (días desde 1900-01-01)
            const excelEpoch = new Date(1899, 11, 30); // 30 de diciembre de 1899
            const date = new Date(excelEpoch.getTime() + fechaAdquisicion * 24 * 60 * 60 * 1000);
            fechaAdq = date.toISOString().split('T')[0];
          } else {
            // Si es string, intentar parsearlo
            const dateStr = String(fechaAdquisicion);
            if (dateStr.includes('T')) {
              fechaAdq = dateStr.split('T')[0];
            } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              fechaAdq = dateStr;
            } else {
              // Intentar parsear otros formatos
              const parsed = new Date(dateStr);
              if (!isNaN(parsed.getTime())) {
                fechaAdq = parsed.toISOString().split('T')[0];
              }
            }
          }
        }

        // Combinar descripcion y comentarios si ambos existen
        const descripcionFinal = comentarios 
          ? (descripcion ? `${descripcion}\n\nComentarios: ${comentarios}` : `Comentarios: ${comentarios}`)
          : (descripcion || null);

        // Insertar equipo con nuevos campos
        const query = `INSERT INTO Elementos
          (id_categoria, id_ambiente, tipo, marca, modelo, descripcion, 
           fecha_adquisicion, costo, vida_util_meses, estado_fisico, specs_completas, registrado_por,
           r_centro, consecutivo, placa, atributos, valor_ingreso)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        await defaultDb.execute(query, [
          categoriaId,
          ambienteId,
          tipo,
          marca || null,
          modelo,
          descripcionFinal,
          fechaAdq || null,
          costo ? parseFloat(costo) : null,
          vidaUtilMeses ? parseInt(vidaUtilMeses) : null,
          estadoFisicoValido,
          specsCompletas || null,
          userId,
          rCentro,
          numeroSerie || null,
          placa || null,
          atributos || null,
          valorIngreso ? parseFloat(valorIngreso) : (costo ? parseFloat(costo) : null)
        ]);

        resultados.exitosos++;
      } catch (error) {
        resultados.errores.push({
          fila: numeroFila,
          codigo: row['Placa'] || row['placa'] || 'N/A',
          error: error.message || 'Error desconocido'
        });
        resultados.fallidos++;
      }
    }

    return res.json({
      message: `Importación completada: ${resultados.exitosos} exitosos, ${resultados.fallidos} fallidos`,
      resultados
    });
  } catch (error) {
    logger.error('Error en importarEquipos', { error: error.message, stack: error.stack });
    return res.status(500).json({ error: 'Error al procesar el archivo Excel', detalle: error.message });
  }
}

/**
 * Importar usuarios desde archivo Excel
 */
export async function importarUsuarios(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      return res.status(400).json({ error: 'El archivo Excel está vacío' });
    }

    const resultados = {
      total: data.length,
      exitosos: 0,
      fallidos: 0,
      errores: [],
      correosEnviados: 0,
      correosFallidos: 0
    };

    const userId = req.user?.id || null;
    const usuariosParaEnviarCorreo = []; // Almacenar usuarios con contraseñas generadas

    // Procesar cada fila
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const numeroFila = i + 2;

      try {
        // Mapear columnas del Excel
        const nombreUsuario = String(row['nombre_usuario'] || row['Nombre'] || row['NOMBRE_USUARIO'] || '').trim();
        const cedula = String(row['cedula'] || row['Cédula'] || row['CEDULA'] || '').trim();
        const telefono = row['telefono'] || row['Teléfono'] || row['TELEFONO'] || null;
        const correo = row['correo'] || row['Correo'] || row['CORREO'] || row['email'] || row['Email'] || null;
        const rol = String(row['rol'] || row['Rol'] || row['ROL'] || 'Aprendiz').trim();
        const contrasena = row['contrasena'] || row['Contraseña'] || row['CONTRASENA'] || row['password'] || null;
        const estado = String(row['estado'] || row['Estado'] || row['ESTADO'] || 'Activo').trim();

        // Validaciones básicas
        if (!nombreUsuario || !cedula) {
          resultados.errores.push({
            fila: numeroFila,
            cedula: cedula || 'N/A',
            error: 'Nombre y cédula son obligatorios'
          });
          resultados.fallidos++;
          continue;
        }

        // Validar cédula única
        const [[cedulaExistente]] = await defaultDb.execute(
          'SELECT id_usuario FROM Usuarios WHERE cedula = ? LIMIT 1',
          [cedula]
        );
        if (cedulaExistente) {
          resultados.errores.push({
            fila: numeroFila,
            cedula: cedula,
            error: 'La cédula ya está registrada'
          });
          resultados.fallidos++;
          continue;
        }

        // Validar correo único (si se proporciona)
        if (correo) {
          const [[correoExistente]] = await defaultDb.execute(
            'SELECT id_usuario FROM Usuarios WHERE correo = ? LIMIT 1',
            [correo]
          );
          if (correoExistente) {
            resultados.errores.push({
              fila: numeroFila,
              cedula: cedula,
              error: 'El correo ya está registrado'
            });
            resultados.fallidos++;
            continue;
          }
        }

        // Resolver rol
        const [[rolRow]] = await defaultDb.execute(
          'SELECT id_rol FROM Roles WHERE nombre_rol = ? LIMIT 1',
          [rol]
        );
        if (!rolRow?.id_rol) {
          resultados.errores.push({
            fila: numeroFila,
            cedula: cedula,
            error: `Rol "${rol}" no encontrado. Debe ser: Administrador, Instructor o Aprendiz`
          });
          resultados.fallidos++;
          continue;
        }

        // Validar estado
        const estadosValidos = ['Activo', 'Inactivo'];
        const estadoValido = estadosValidos.includes(estado) ? estado : 'Activo';

        // Generar contraseña si no se proporciona
        let contrasenaHash = null;
        let contrasenaPlana = null; // Guardar contraseña en texto plano para enviar por correo
        
        if (contrasena && contrasena.trim()) {
          // Si se proporciona contraseña, usarla
          contrasenaPlana = contrasena.trim();
          contrasenaHash = await bcrypt.hash(contrasenaPlana, 10);
        } else {
          // Generar contraseña única y segura
          contrasenaPlana = emailService.generatePassword(12);
          contrasenaHash = await bcrypt.hash(contrasenaPlana, 10);
        }

        // Determinar si requiere cambio de contraseña (si fue generada automáticamente)
        const requiereCambio = !contrasena || !contrasena.trim();

        // Insertar usuario
        const query = `INSERT INTO Usuarios
          (nombre_usuario, cedula, telefono, correo, contrasena, id_rol, estado, requiere_cambio_contrasena, creado_por)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        await defaultDb.execute(query, [
          nombreUsuario,
          cedula,
          telefono || null,
          correo || null,
          contrasenaHash,
          rolRow.id_rol,
          estadoValido,
          requiereCambio ? 1 : 0,
          userId
        ]);

        // Si no se proporcionó contraseña y hay correo, agregar a la lista para enviar
        if (!contrasena && correo && correo.trim()) {
          usuariosParaEnviarCorreo.push({
            correo: correo.trim(),
            nombreUsuario,
            cedula,
            password: contrasenaPlana
          });
        }

        resultados.exitosos++;
      } catch (error) {
        resultados.errores.push({
          fila: numeroFila,
          cedula: row['cedula'] || 'N/A',
          error: error.message || 'Error desconocido'
        });
        resultados.fallidos++;
      }
    }

    // Enviar correos con contraseñas generadas
    if (usuariosParaEnviarCorreo.length > 0) {
      const correosResultado = await emailService.enviarContrasenasMasivo(usuariosParaEnviarCorreo);
      resultados.correosEnviados = correosResultado.exitosos;
      resultados.correosFallidos = correosResultado.fallidos;
      
      // Agregar errores de correos a los errores generales (solo como información)
      if (correosResultado.errores.length > 0) {
        correosResultado.errores.forEach(error => {
          resultados.errores.push({
            fila: 'N/A',
            cedula: error.nombre || 'N/A',
            error: `Usuario creado pero no se pudo enviar correo: ${error.razon}`
          });
        });
      }
    }

    let mensaje = `Importación completada: ${resultados.exitosos} exitosos, ${resultados.fallidos} fallidos`;
    if (resultados.correosEnviados > 0) {
      mensaje += `. ${resultados.correosEnviados} correo(s) con contraseñas enviado(s)`;
    }
    if (resultados.correosFallidos > 0) {
      mensaje += `. ${resultados.correosFallidos} correo(s) no pudo(eron) enviarse`;
    }

    return res.json({
      message: mensaje,
      resultados
    });
  } catch (error) {
    logger.error('Error en importarUsuarios', { error: error.message, stack: error.stack });
    return res.status(500).json({ error: 'Error al procesar el archivo Excel', detalle: error.message });
  }
}

