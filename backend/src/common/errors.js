export class AppError extends Error {
  constructor(mensaje, estado = 500, codigo = 'ERROR_INTERNO', detalles = undefined) {
    super(mensaje);
    this.name = 'AppError';
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

export const errores = {
  credencialesInvalidas: () =>
    new AppError('Usuario o contraseña incorrectos.', 401, 'CREDENCIALES_INVALIDAS'),
  cuentaInactiva: () =>
    new AppError('La cuenta se encuentra inactiva. Contacte al administrador.', 403, 'CUENTA_INACTIVA'),
  cuentaBloqueada: (minutos) =>
    new AppError(
      `La cuenta está bloqueada tras varios intentos fallidos. Intente de nuevo en ${minutos} minuto(s).`,
      403,
      'CUENTA_BLOQUEADA',
    ),
  tokenInvalido: () =>
    new AppError('Sesión no válida o expirada. Inicie sesión nuevamente.', 401, 'TOKEN_INVALIDO'),
  perfilNoAutorizado: () =>
    new AppError('Su perfil no tiene permiso para acceder a esta funcionalidad.', 403, 'PERFIL_NO_AUTORIZADO'),
  noEncontrado: (recurso = 'Recurso') =>
    new AppError(`${recurso} no encontrado.`, 404, 'NO_ENCONTRADO'),
  archivoNoDisponible: () =>
    new AppError('El archivo digital no está disponible en el repositorio.', 404, 'ARCHIVO_NO_DISPONIBLE'),
  rutaInvalida: () =>
    new AppError('La ubicación del archivo no es válida.', 400, 'RUTA_INVALIDA'),
  sinResultados: () =>
    new AppError('No se encontraron documentos que coincidan con los criterios.', 404, 'SIN_RESULTADOS'),
  parametrosInvalidos: (detalles) =>
    new AppError('Los criterios de búsqueda no son válidos.', 400, 'PARAMETROS_INVALIDOS', detalles),
  demasiadosIntentos: () =>
    new AppError('Demasiados intentos. Espere unos minutos antes de volver a intentar.', 429, 'DEMASIADOS_INTENTOS'),
  errorBaseDeDatos: () =>
    new AppError('No fue posible consultar la base de datos.', 503, 'BASE_DE_DATOS_NO_DISPONIBLE'),
  operacionNoPermitida: (mensaje) =>
    new AppError(mensaje, 400, 'OPERACION_NO_PERMITIDA'),
  archivoInvalido: (mensaje) =>
    new AppError(mensaje, 400, 'ARCHIVO_INVALIDO'),
  conflictoConcurrencia: () =>
    new AppError(
      'El documento fue modificado por otro usuario. Recargue la ficha e intente nuevamente.',
      409,
      'CONFLICTO_CONCURRENCIA',
    ),
  conflictoVersion: () =>
    new AppError(
      'La entidad fue modificada por otro usuario. Recargue los datos e intente nuevamente.',
      409,
      'CONFLICTO_VERSION',
    ),
  conflictoReversion: () =>
    new AppError(
      'El documento tiene cambios posteriores. Confirme la reversión forzada o revise el historial.',
      409,
      'CONFLICTO_REVERSION',
    ),
  conflictoJerarquia: (mensaje) =>
    new AppError(mensaje, 409, 'CONFLICTO_JERARQUIA'),
};

export default AppError;
