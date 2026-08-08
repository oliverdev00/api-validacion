require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.status(200).json({ message: 'API de Validación de Identidad Colombia - Activa' });
});

app.post('/api/v1/validar', async (req, res) => {
  const documentoRaw = req.body?.documento || req.body?.cedula || req.query?.documento || req.query?.cedula;
  const documento = String(documentoRaw ?? '').trim().replace(/\D/g, '');

  if (!documento) {
    return res.status(400).json({
      success: false,
      valido: false,
      error: 'El campo "documento" es obligatorio'
    });
  }

  if (documento.length < 5 || documento.length > 10) {
    return res.status(400).json({
      success: false,
      valido: false,
      error: 'La longitud del documento no es válida para Colombia'
    });
  }

  try {
    const resultadoExterno = await consultarFuenteExterna(documento);

    return res.status(200).json({
      success: true,
      valido: resultadoExterno.valido,
      documento,
      nombre: resultadoExterno.nombre,
      estado: resultadoExterno.estado,
      alerta_riesgo: resultadoExterno.alerta_riesgo,
      score: resultadoExterno.score,
      fecha_validacion: resultadoExterno.fecha_validacion,
      fuente: resultadoExterno.fuente,
      datos_externos: resultadoExterno.datos_externos
    });
  } catch (error) {
    console.error('Error consultando fuente externa:', error.message);

    return res.status(502).json({
      success: false,
      valido: false,
      error: error.message || 'No fue posible consultar la fuente externa de validación',
      code: 'FUENTE_NO_DISPONIBLE'
    });
  }
});

async function consultarFuenteExterna(documento) {
  const endpoint = process.env.VALIDATOR_API_URL;
  if (!endpoint) {
    console.warn('No se configuró VALIDATOR_API_URL; usando modo demo.');
    return consultarFuenteDemo(documento);
  }

  const method = (process.env.VALIDATOR_API_METHOD || 'GET').toUpperCase();
  const timeout = Number(process.env.VALIDATOR_API_TIMEOUT || 8000);

  const headers = {};
  if (process.env.VALIDATOR_API_TOKEN) {
    headers.Authorization = `Bearer ${process.env.VALIDATOR_API_TOKEN}`;
  }

  const config = {
    timeout,
    headers,
    ...(method === 'GET' ? { params: { documento } } : {})
  };

  const response = method === 'POST'
    ? await axios.post(endpoint, { documento }, config)
    : await axios.get(endpoint, config);

  const data = response.data || {};
  if (!data || typeof data !== 'object') {
    throw new Error('La API externa devolvió una respuesta inválida');
  }

  const valido = data.valido;
  if (typeof valido !== 'boolean') {
    throw new Error('La API externa no devolvió el campo "valido"');
  }

  const nombre = data.nombre || data.name || data.title || `Documento ${documento}`;
  const estado = data.estado || data.status || data.state || (valido ? 'VIGENTE' : 'EN REVISIÓN');
  const alertaRiesgo = data.alerta_riesgo || data.alerta || data.risk || (valido ? 'SIN ALERTAS' : 'RIESGO MODERADO');

  return {
    valido,
    nombre,
    estado,
    alerta_riesgo: alertaRiesgo,
    score: data.score || 85,
    fecha_validacion: new Date().toISOString(),
    fuente: endpoint,
    datos_externos: data
  };
}

function consultarFuenteDemo(documento) {
  const digits = documento.split('').map(Number);
  const suma = digits.reduce((sum, n) => sum + n, 0);
  const patterns = ['VIGENTE', 'EN REVISIÓN', 'SUSPENDIDO'];
  const risk = ['SIN ALERTAS', 'RIESGO MODERADO', 'ALTO RIESGO'];
  const nombres = ['Carlos Andrés Morales', 'Daniela Torres', 'Sofía Ramírez', 'Miguel Ángel Peña', 'Valentina Gómez', 'Andrés Felipe Castillo'];

  const index = suma % patterns.length;
  const valido = index === 0;

  return {
    valido,
    nombre: nombres[suma % nombres.length],
    estado: patterns[index],
    alerta_riesgo: risk[suma % risk.length],
    score: 60 + (suma % 31),
    fecha_validacion: new Date().toISOString(),
    fuente: 'demo',
    datos_externos: { documento, modo: 'demo' }
  };
}

app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor ejecutándose en http://${HOST}:${PORT}`);
});