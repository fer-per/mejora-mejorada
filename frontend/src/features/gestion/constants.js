export const SECCIONES = [
  { id: 'documentos', etiqueta: 'Documentos' },
  { id: 'estructura', etiqueta: 'Jerarquía' },
  { id: 'operaciones', etiqueta: 'Historial' },
  { id: 'duplicados', etiqueta: 'Duplicados' },
];

export const TIPOS_ESTRUCTURA = [
  { id: 'repositorios', etiqueta: 'Repositorios' },
  { id: 'fondos', etiqueta: 'Fondos' },
  { id: 'escribanos', etiqueta: 'Escribanos' },
  { id: 'protocolos', etiqueta: 'Protocolos' },
  { id: 'anios', etiqueta: 'Años' },
  { id: 'registros', etiqueta: 'Registros' },
  { id: 'titulos', etiqueta: 'Títulos' },
];

export const TIPOS_FUSION = ['fondos', 'escribanos', 'protocolos', 'anios', 'registros'];

export const FILTROS_DOCUMENTOS_INICIALES = {
  texto: '',
  conservacion: '',
  estado: 'activos',
  orden: 'fecha',
};

export const FORMULARIO_MASIVA_INICIAL = {
  estado_conservacion: '',
  tipologia: '',
  serie: '',
  subserie: '',
  ubicacion_fisica: '',
  observaciones: '',
};

export const CAMPOS_ESTRUCTURA = {
  repositorios: {
    siglo: { etiqueta: 'Siglo', tipo: 'number', numerico: true },
    numero: { etiqueta: 'Número' },
  },
  fondos: {
    id_repositorio: { etiqueta: 'ID repositorio', tipo: 'number', numerico: true },
    denominacion: { etiqueta: 'Denominación' },
    descripcion: { etiqueta: 'Descripción', tipo: 'textarea' },
  },
  escribanos: {
    id_fondo: { etiqueta: 'ID fondo', tipo: 'number', numerico: true },
    nombre_completo: { etiqueta: 'Nombre completo' },
    periodo_ejercicio: { etiqueta: 'Periodo de ejercicio' },
    seccion: { etiqueta: 'Sección' },
  },
  protocolos: {
    id_fondo: { etiqueta: 'ID fondo', tipo: 'number', numerico: true },
    id_escribano: { etiqueta: 'ID escribano', tipo: 'number', numerico: true },
    numero: { etiqueta: 'Número de protocolo' },
  },
  anios: {
    id_protocolo: { etiqueta: 'ID protocolo', tipo: 'number', numerico: true },
    anio: { etiqueta: 'Año', tipo: 'number', numerico: true },
  },
  registros: {
    id_anio_protocolo: { etiqueta: 'ID año de protocolo', tipo: 'number', numerico: true },
    numero: { etiqueta: 'Número de registro' },
  },
  titulos: {
    id_registro: { etiqueta: 'ID registro', tipo: 'number', numerico: true },
    nombre: { etiqueta: 'Nombre del título' },
    mes: { etiqueta: 'Mes', tipo: 'number', numerico: true },
  },
};

export const COLUMNAS_ESTRUCTURA = {
  repositorios: [
    ['id', 'ID'],
    ['siglo', 'Siglo'],
    ['numero', 'Número'],
    ['fondos', 'Fondos'],
  ],
  fondos: [
    ['id', 'ID'],
    ['denominacion', 'Denominación'],
    ['repositorio', 'Repositorio'],
    ['escribanos', 'Escribanos'],
    ['protocolos', 'Protocolos'],
  ],
  escribanos: [
    ['id', 'ID'],
    ['nombre_completo', 'Nombre completo'],
    ['fondo', 'Fondo'],
    ['periodo_ejercicio', 'Periodo'],
    ['protocolos', 'Protocolos'],
  ],
  protocolos: [
    ['id', 'ID'],
    ['numero', 'Número'],
    ['fondo', 'Fondo'],
    ['escribano', 'Escribano'],
    ['anios', 'Años'],
    ['registros', 'Registros'],
    ['documentos', 'Documentos'],
  ],
  anios: [
    ['id', 'ID'],
    ['anio', 'Año'],
    ['protocolo', 'Protocolo'],
    ['fondo', 'Fondo'],
    ['registros', 'Registros'],
    ['documentos', 'Documentos'],
  ],
  registros: [
    ['id', 'ID'],
    ['numero', 'Número'],
    ['anio', 'Año'],
    ['protocolo', 'Protocolo'],
    ['titulos', 'Títulos'],
    ['documentos', 'Documentos'],
  ],
  titulos: [
    ['id', 'ID'],
    ['nombre', 'Nombre'],
    ['anio', 'Año'],
    ['protocolo', 'Protocolo'],
    ['registro', 'Registro'],
    ['documentos', 'Documentos'],
  ],
};

export const ETIQUETA_CAMBIO = {
  titulo: 'Título',
  tipologia: 'Título/Escritura',
  serie: 'Serie',
  subserie: 'Subserie',
  folios: 'Nro. de folios',
  formato: 'Formato',
  estado_conservacion: 'Conservación',
  alcance_contenido: 'Alcance y contenido',
  descriptores: 'Descriptores',
  fecha_produccion: 'Fecha de producción',
  observaciones: 'Observaciones',
  ubicacion_fisica: 'Data tópica',
  interesados: 'Interesados',
  anulado: 'Anulado',
  motivo_anulacion: 'Motivo de anulación',
  archivo: 'Archivo digital',
  nombre: 'Nombre',
  numero: 'Número',
  mes: 'Mes',
  id_registro: 'Registro',
  id_anio_protocolo: 'Año de protocolo',
  id_protocolo: 'Protocolo',
  id_escribano: 'Escribano',
  id_fondo: 'Fondo',
  id_repositorio: 'Repositorio',
  denominacion: 'Denominación',
  descripcion: 'Descripción',
  nombre_completo: 'Nombre completo',
  periodo_ejercicio: 'Periodo de ejercicio',
  seccion: 'Sección',
  anio: 'Año',
  siglo: 'Siglo',
};

export const OPERACIONES_REVERSIBLES = new Set([
  'EDICION',
  'EDICION_MASIVA',
  'ANULACION',
  'RESTAURACION',
  'REVERSION',
]);
