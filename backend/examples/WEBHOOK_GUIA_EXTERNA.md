# Guía para Sistemas Externos - Webhook SGE-SENA

Esta guía explica cómo un sistema externo puede enviar datos al webhook del SGE-SENA.

## 📋 Información Necesaria

Para que un sistema externo pueda conectarse, necesitas compartir:

1. **URL del Webhook**: `https://tu-dominio.com/webhook/externo` (o `http://localhost:3000/webhook/externo` en desarrollo)
2. **Token de Autenticación**: El valor de `WEBHOOK_SECRET` configurado en el servidor

## 🔐 Seguridad

- **NUNCA** compartas el token públicamente
- Usa **HTTPS** en producción (no HTTP)
- El token debe enviarse en el header `x-api-key`
- Si el token se compromete, cámbialo inmediatamente en el `.env` del servidor

## 📦 Formato de Datos

El sistema externo debe enviar un JSON con estos campos **obligatorios**:

```json
{
  "usuario": "string",
  "ambiente": "number (int)",
  "ficha": "string",
  "estado": "string"
}
```

### Ejemplo de datos válidos:

```json
{
  "usuario": "juan.perez",
  "ambiente": 1,
  "ficha": "FICHA-12345",
  "estado": "pendiente"
}
```

**Nota**: El campo `ambiente` debe ser un **número entero** (int), no un string. Representa el ID del ambiente.

## 🔌 Ejemplos de Implementación

### 1. JavaScript/Node.js con Axios

```javascript
import axios from 'axios';

const WEBHOOK_URL = 'https://tu-dominio.com/webhook/externo';
const API_KEY = 'token-secreto-compartido';

async function enviarDatos(datos) {
  try {
    const response = await axios.post(WEBHOOK_URL, datos, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
    });
    
    console.log('✅ Datos enviados correctamente:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

// Uso
enviarDatos({
  usuario: 'juan.perez',
  ambiente: 1, // Debe ser un número entero (ID del ambiente)
  ficha: 'FICHA-12345',
  estado: 'pendiente',
});
```

## 📊 Respuestas del Servidor

### ✅ Éxito (201 Created)

```json
{
  "success": true,
  "message": "Datos recibidos y guardados correctamente",
  "id": 123
}
```

### ❌ Error 400 - Datos incompletos

```json
{
  "success": false,
  "error": "Datos incompletos",
  "detalles": "Faltan los siguientes campos: ficha, estado"
}
```

### ❌ Error 403 - Token inválido

```json
{
  "success": false,
  "error": "Token de autenticación inválido"
}
```

### ❌ Error 500 - Error del servidor

```json
{
  "success": false,
  "error": "Error al guardar los datos"
}
```

## 🧪 Cómo Probar la Conexión

### Paso 1: Verificar que el servidor esté funcionando

```bash
curl https://tu-dominio.com/health
```

Debería responder:
```json
{
  "status": "ok",
  "env": "production",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Paso 2: Probar el webhook con datos válidos

Usa cualquiera de los ejemplos anteriores con:
- URL correcta
- Token correcto
- Todos los campos requeridos

### Paso 3: Verificar en la base de datos

```sql
SELECT * FROM pedidos_externos ORDER BY fecha_recepcion DESC LIMIT 10;
```

## ⚠️ Errores Comunes

1. **403 Forbidden**: Token incorrecto o no enviado
   - Verifica que el header `x-api-key` esté presente
   - Verifica que el token coincida exactamente con `WEBHOOK_SECRET`

2. **400 Bad Request**: Datos incompletos o tipos inválidos
   - Verifica que todos los campos estén presentes: `usuario`, `ambiente`, `ficha`, `estado`
   - Verifica que `usuario`, `ficha` y `estado` sean strings
   - Verifica que `ambiente` sea un número entero (int)

3. **500 Internal Server Error**: Error del servidor
   - Verifica que la tabla `pedidos_externos` exista
   - Revisa los logs del servidor

4. **Connection Error**: No se puede conectar
   - Verifica que la URL sea correcta
   - Verifica que el servidor esté en ejecución
   - Verifica firewall/red

## 📝 Checklist para Compartir con el Sistema Externo

- [ ] URL del webhook (con protocolo https://)
- [ ] Token secreto (WEBHOOK_SECRET)
- [ ] Formato de datos requerido (JSON con 4 campos)
- [ ] Ejemplo de petición exitosa
- [ ] Códigos de respuesta posibles
- [ ] Contacto para soporte en caso de problemas

## 🔄 Flujo de Integración

```
Sistema Externo
    │
    ├─> Prepara datos (usuario, ambiente, ficha, estado)
    │
    ├─> Hace POST a /webhook/externo
    │   ├─> Header: x-api-key: [token]
    │   └─> Body: JSON con los datos
    │
    └─> Recibe respuesta
        ├─> 201: ✅ Éxito (datos guardados)
        ├─> 400: ❌ Datos inválidos
        ├─> 403: ❌ Token inválido
        └─> 500: ❌ Error del servidor
```

## 💡 Recomendaciones

1. **Implementa reintentos**: Si falla, reintenta 2-3 veces con backoff exponencial
2. **Logs**: Guarda logs de las peticiones (éxito y fallos)
3. **Validación local**: Valida los datos antes de enviarlos
4. **Timeout**: Configura timeout razonable (10-30 segundos)
5. **Manejo de errores**: Implementa manejo robusto de errores

