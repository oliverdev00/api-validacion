require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3000);

// Middlewares
app.use(cors());
app.use(express.json());

// ============================================
// HEALTH CHECK (Para Render / Railway / Uptime)
// ============================================
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.status(200).json({ message: 'API de Validación de Identidad Colombia - Activa' });
});

// ============================================
// ENDPOINT PRINCIPAL: POST /api/v1/validar
// ============================================
app.post('/api/v1/validar', async (req, res) => {
  try {
    const { documento } = req.body;

    // 1. Validación de entrada
    if (!documento) {
      return res.status(400).json({
        success: false,
        valido: false,
        error: 'El campo "documento" es obligatorio',
        code: 'DOCUMENTO_REQUERIDO'
      });
    }

    // 2. Limpieza de datos (Quitar puntos, comas, espacios)
    const docLimpio = String(documento).replace(/\D/g, '');

    if (docLimpio.length < 5 || docLimpio.length > 10) {
      return res.status(400).json({
        success: false,
        valido: false,
        error: 'Longitud de documento inválida para Colombia',
        code: 'FORMATO_INVALIDO'
      });
    }

    // 3. Ejecución de lógica de validación
    const resultado = await validarDocumento(docLimpio);

    // 4. Respuesta optimizada para consumir fácil desde Google Sheets / Webhook
    return res.status(200).json({
      success: true,
      valido: resultado.valido,
      documento: docLimpio,
      nombre: resultado.nombre,
      estado: resultado.estado,
      alerta_riesgo: resultado.alerta_riesgo,
      mensaje: resultado.mensaje,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error en /api/v1/validar:', error.message);

    return res.status(500).json({
      success: false,
      valido: false,
      error: 'Error interno o timeout al consultar la fuente',
      code: 'ERROR_INTERNO'
    });
  }
});

// ============================================
// FUNCIÓN DE VALIDACIÓN (Demo Ready)
// ============================================
async function validarDocumento(doc) {
  // TODO: Reemplazar esta simulación con tu proveedor/scraper real
  // Ejemplo: const response = await axios.get(`HTTPS_FUENTE_REAL?doc=${doc}`);

  // Simulación con respuestas dinámicas según la cédula para la DEMO
  const esCedulaDePruebaRiesgo = doc.endsWith('99'); 

  if (esCedulaDePruebaRiesgo) {
    return {
      valido: false,
      nombre: 'DOCUMENTO REPORTE / ALERTA',
      estado: 'SUSPENDIDO O INEXISTENTE',
      alerta_riesgo: 'ALTO RIESGO',
      mensaje: 'El documento presenta inconsistencias en base de datos públicas.'
    };
  }

  return {
    valido: true,
    nombre: 'USUARIO VALIDADO OK', // O reemplazar dinámicamente si tienes la fuente
    estado: 'VIGENTE',
    alerta_riesgo: 'SIN ALERTAS',
    mensaje: 'Validación completada con éxito.'
  };
}

// Iniciar servidor
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor ejecutándose en http://${HOST}:${PORT}`);
});

server.on('error', (error) => {
  console.error('❌ Error al iniciar el servidor:', error);
  process.exit(1);
});