/**
 * Ejemplo de cómo un sistema externo puede enviar datos al webhook
 * 
 * Este archivo muestra cómo usar axios para enviar datos al endpoint
 * POST /webhook/externo
 * 
 * Requisitos:
 * - Instalar axios: npm install axios
 * - Configurar la variable WEBHOOK_SECRET en el .env del servidor
 * - El token debe coincidir con el valor de WEBHOOK_SECRET
 */

import axios from 'axios';

// Configuración del webhook
const WEBHOOK_URL = 'http://localhost:3000/webhook/externo'; // Cambiar según tu entorno
const API_KEY = 'tu-token-secreto-aqui'; // Debe coincidir con WEBHOOK_SECRET en el servidor

/**
 * Función para enviar datos al webhook
 * @param {Object} datos - Objeto con los campos requeridos
 * @param {string} datos.usuario - Usuario que realiza el pedido
 * @param {number} datos.ambiente - ID del ambiente (número entero)
 * @param {string} datos.ficha - Ficha asociada al pedido
 * @param {string} datos.estado - Estado del pedido
 */
async function enviarWebhook(datos) {
  try {
    const response = await axios.post(WEBHOOK_URL, datos, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
    });

    // Webhook enviado correctamente
    return response.data;
  } catch (error) {
    if (error.response) {
      // El servidor respondió con un código de estado fuera del rango 2xx
      console.error('❌ Error en la respuesta del servidor:');
      console.error('Status:', error.response.status);
      console.error('Datos:', error.response.data);
    } else if (error.request) {
      // La solicitud se hizo pero no se recibió respuesta
      console.error('❌ No se recibió respuesta del servidor');
      console.error('Request:', error.request);
    } else {
      // Algo pasó al configurar la solicitud
      console.error('❌ Error al configurar la solicitud:', error.message);
    }
    throw error;
  }
}

// Ejemplo de uso
// Descomenta la siguiente función y ejecuta: ejemplo();
// eslint-disable-next-line no-unused-vars
async function ejemplo() {
  // Ejemplo 1: Envío exitoso
  console.warn('\n📤 Ejemplo 1: Envío de datos válidos');
  try {
    await enviarWebhook({
      usuario: 'juan.perez',
      ambiente: 1, // Debe ser un número entero (ID del ambiente)
      ficha: 'FICHA-12345',
      estado: 'pendiente',
    });
  } catch (error) {
    console.error('Error en ejemplo 1:', error.message);
  }

  // Ejemplo 2: Error por datos incompletos
  console.warn('\n📤 Ejemplo 2: Envío con datos incompletos (debe fallar)');
  try {
    await enviarWebhook({
      usuario: 'juan.perez',
      ambiente: 1,
      // Faltan ficha y estado
    });
  } catch (error) {
    console.error('Error esperado capturado:', error.response?.data);
  }

  // Ejemplo 3: Error por token inválido
  console.warn('\n📤 Ejemplo 3: Envío con token inválido (debe fallar)');
  try {
    await axios.post(WEBHOOK_URL, {
      usuario: 'juan.perez',
      ambiente: 1,
      ficha: 'FICHA-12345',
      estado: 'pendiente',
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'token-incorrecto',
      },
    });
  } catch (error) {
    console.error('Error esperado capturado:', error.response?.data);
  }
}

export { enviarWebhook };

