import defaultDb from '../config/dbconfig.js';
import XLSX from 'xlsx';
import bcrypt from 'bcrypt';
import emailService from '../services/emailService.js';

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
        // Mapear columnas del Excel a campos de la BD
        const codigoInventario = String(row['codigo_inventario'] || row['Código Inventario'] || row['CODIGO_INVENTARIO'] || '').trim();
        const tipo = String(row['tipo'] || row['Tipo'] || row['TIPO'] || '').trim();
        const marca = String(row['marca'] || row['Marca'] || row['MARCA'] || '').trim();
        const modelo = String(row['modelo'] || row['Modelo'] || row['MODELO'] || '').trim();
        const numeroSerie = String(row['numero_serie'] || row['Número Serie'] || row['NUMERO_SERIE'] || '').trim();
        const descripcion = row['descripcion'] || row['Descripción'] || row['DESCRIPCION'] || null;
        const fechaAdquisicion = row['fecha_adquisicion'] || row['Fecha Adquisición'] || row['FECHA_ADQUISICION'] || null;
        const costo = row['costo'] || row['Costo'] || row['COSTO'] || null;
        const vidaUtilMeses = row['vida_util_meses'] || row['Vida Útil (meses)'] || row['VIDA_UTIL_MESES'] || null;
        const estadoFisico = String(row['estado_fisico'] || row['Estado Físico'] || row['ESTADO_FISICO'] || 'Bueno').trim();
        const ambiente = String(row['ambiente'] || row['Ambiente'] || row['AMBIENTE'] || row['codigo_ambiente'] || row['Código Ambiente'] || '').trim();
        const incluyeMouse = row['incluye_mouse'] || row['Incluye Mouse'] || row['INCLUYE_MOUSE'] || false;
        const incluyeTeclado = row['incluye_teclado'] || row['Incluye Teclado'] || row['INCLUYE_TECLADO'] || false;
        const incluyeMonitor = row['incluye_monitor'] || row['Incluye Monitor'] || row['INCLUYE_MONITOR'] || false;
        const incluyeTorre = row['incluye_torre'] || row['Incluye Torre'] || row['INCLUYE_TORRE'] || false;
        const specsCompletas = row['specs_completas'] || row['Especificaciones'] || row['SPECS_COMPLETAS'] || null;

        // Validaciones básicas
        if (!codigoInventario) {
          resultados.errores.push({
            fila: numeroFila,
            codigo: codigoInventario || 'N/A',
            error: 'Código de inventario es obligatorio'
          });
          resultados.fallidos++;
          continue;
        }

        if (!tipo || !marca || !modelo || !numeroSerie) {
          resultados.errores.push({
            fila: numeroFila,
            codigo: codigoInventario,
            error: 'Faltan campos obligatorios: tipo, marca, modelo o número de serie'
          });
          resultados.fallidos++;
          continue;
        }

        // Validar código único
        const [[codigoExistente]] = await defaultDb.execute(
          'SELECT codigo_equipo FROM Elementos WHERE codigo_inventario = ? LIMIT 1',
          [codigoInventario]
        );
        if (codigoExistente) {
          resultados.errores.push({
            fila: numeroFila,
            codigo: codigoInventario,
            error: 'El código de inventario ya está registrado'
          });
          resultados.fallidos++;
          continue;
        }

        // Validar número de serie único (si se proporciona)
        if (numeroSerie) {
          const [[serieExistente]] = await defaultDb.execute(
            'SELECT codigo_equipo FROM Elementos WHERE numero_serie = ? LIMIT 1',
            [numeroSerie]
          );
          if (serieExistente) {
            resultados.errores.push({
              fila: numeroFila,
              codigo: codigoInventario,
              error: 'El número de serie ya está registrado'
            });
            resultados.fallidos++;
            continue;
          }
        }

        // Resolver categoría
        const [[categoria]] = await defaultDb.execute(
          'SELECT id_categoria FROM Categorias_Equipo WHERE nombre_categoria = ? LIMIT 1',
          [tipo]
        );
        if (!categoria?.id_categoria) {
          resultados.errores.push({
            fila: numeroFila,
            codigo: codigoInventario,
            error: `Categoría "${tipo}" no encontrada. Debe existir en Categorias_Equipo`
          });
          resultados.fallidos++;
          continue;
        }

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
            codigo: codigoInventario,
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

        // Insertar equipo
        const query = `INSERT INTO Elementos
          (codigo_inventario, id_categoria, id_ambiente, tipo, marca, modelo, numero_serie, descripcion, 
           fecha_adquisicion, costo, vida_util_meses, estado_fisico, incluye_mouse, incluye_teclado, 
           incluye_monitor, incluye_torre, specs_completas, registrado_por)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        await defaultDb.execute(query, [
          codigoInventario,
          categoria.id_categoria,
          ambienteId,
          tipo,
          marca,
          modelo,
          numeroSerie || null,
          descripcion || null,
          fechaAdq || null,
          costo ? parseFloat(costo) : null,
          vidaUtilMeses ? parseInt(vidaUtilMeses) : null,
          estadoFisicoValido,
          !!incluyeMouse,
          !!incluyeTeclado,
          !!incluyeMonitor,
          !!incluyeTorre,
          specsCompletas || null,
          userId
        ]);

        resultados.exitosos++;
      } catch (error) {
        resultados.errores.push({
          fila: numeroFila,
          codigo: row['codigo_inventario'] || 'N/A',
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
    console.error('Error en importarEquipos:', error);
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
        const area = row['area'] || row['Área'] || row['AREA'] || row['area_usuarios'] || row['Área Usuarios'] || null;
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
          (nombre_usuario, cedula, telefono, correo, area_usuarios, contrasena, id_rol, estado, requiere_cambio_contrasena, creado_por)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        await defaultDb.execute(query, [
          nombreUsuario,
          cedula,
          telefono || null,
          correo || null,
          area || null,
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
    console.error('Error en importarUsuarios:', error);
    return res.status(500).json({ error: 'Error al procesar el archivo Excel', detalle: error.message });
  }
}

