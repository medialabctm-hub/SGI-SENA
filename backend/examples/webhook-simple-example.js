/**
 * Ejemplo simple de uso del webhook externo
 * 
 * Uso:
 * 1. Configura WEBHOOK_SECRET en el .env del servidor
 * 2. Ejecuta el script SQL para crear la tabla pedidos_externos
 * 3. Ajusta WEBHOOK_URL y API_KEY según tu entorno
 * 4. Ejecuta: node webhook-simple-example.js
 */

import axios from 'axios';

const WEBHOOK_URL = 'http://localhost:3000/webhook/externo';
const API_KEY = 'tu-token-secreto-aqui'; // Debe coincidir con WEBHOOK_SECRET

const datos = {
  usuario: 'juan.perez',
  ambiente: 1, // Debe ser un número entero (ID del ambiente)
  ficha: 'FICHA-12345',
  estado: 'pendiente',
};

axios
  .post(WEBHOOK_URL, datos, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
  })
  .then((response) => {
    console.log('✅ Éxito:', response.data);
  })
  .catch((error) => {
    console.error('❌ Error:', error.response?.data || error.message);
  });

