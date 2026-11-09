import { AppError } from '../common/errors.js';
import { config } from '../config/env.js';

export function noEncontrado(req, res, next) {
  next(new AppError(`Ruta ${req.method} ${req.originalUrl} no encontrada.`, 404, 'RUTA_NO_ENCONTRADA'));
}

export function manejarErrores(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  let estado = error.estado ?? 500;
  let codigo = error.codigo ?? 'ERROR_INTERNO';
  let mensaje = error.message || 'Error interno del servidor.';
  let detalles = error.detalles;

  if (error.name === 'ZodError') {
    estado = 400;
    codigo = 'VALIDACION_INVALIDA';
    detalles = error.issues?.map((i) => ({ campo: i.path.join('.'), mensaje: i.message }));
    mensaje = 'Los datos de entrada no son válidos.';
  } else if (error.code === '23505') {
    estado = 409;
    codigo = 'REGISTRO_DUPLICADO';
    mensaje = 'Ya existe un registro con esos datos.';
  } else if (error.code === '23503') {
    estado = 400;
    codigo = 'REFERENCIA_INVALIDA';
    mensaje = 'La operación hace referencia a un registro inexistente.';
  } else if (error.code === '23502' || error.code === '22P02') {
    estado = 400;
    codigo = 'DATO_INVALIDO';
    mensaje = 'Uno de los valores enviados no es válido.';
  } else if (error.code === '22007' || error.code === '22008') {
    estado = 400;
    codigo = 'FECHA_INVALIDA';
    mensaje = 'La fecha indicada no es válida.';
  } else if (error.name === 'MulterError') {
    estado = 400;
    codigo = 'ARCHIVO_INVALIDO';
    mensaje =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo excede el tamaño máximo permitido.'
        : 'No fue posible procesar el archivo enviado.';
  } else if (error.code && String(error.code).startsWith('ECONN')) {
    estado = 503;
    codigo = 'BASE_DE_DATOS_NO_DISPONIBLE';
    mensaje = 'No fue posible conectar con la base de datos.';
  }

  const esErrorCliente = estado >= 400 && estado < 500;
  if (!esErrorCliente) {
    console.error(`[siarc-ara] ${req.method} ${req.originalUrl} ->`, error);
  }

  res.status(estado).json({
    error: {
      codigo,
      mensaje,
      ...(detalles ? { detalles } : {}),
      ...(config.esProduccion ? {} : { pila: error.stack }),
    },
  });
}
