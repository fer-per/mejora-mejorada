import { errores } from './errors.js';

const EXTENSIONES = {
  pdf: 'PDF/A',
  tif: 'TIFF',
  tiff: 'TIFF',
};

function extensionDe(nombre) {
  return String(nombre ?? '').toLowerCase().split('.').pop();
}

function firmaPdf(buffer) {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

function firmaTiff(buffer) {
  if (buffer.length < 4) return false;
  const [b0, b1, b2, b3] = buffer;
  return (
    (b0 === 0x49 && b1 === 0x49 && b2 === 0x2a && b3 === 0x00) ||
    (b0 === 0x4d && b1 === 0x4d && b2 === 0x00 && b3 === 0x2a)
  );
}

export function validarArchivoDigital({ buffer, nombreOriginal, tipoMime }) {
  if (!buffer || buffer.length === 0) {
    throw errores.archivoInvalido('El archivo está vacío o no fue recibido.');
  }

  const extension = extensionDe(nombreOriginal);
  const formato = EXTENSIONES[extension];
  if (!formato) {
    throw errores.archivoInvalido('Solo se admiten archivos PDF/A (.pdf) o TIFF (.tif, .tiff).');
  }

  const mimeEsperado = formato === 'PDF/A' ? 'application/pdf' : 'image/tiff';
  const mimeAceptable =
    !tipoMime || tipoMime === mimeEsperado || tipoMime === 'application/octet-stream';
  if (!mimeAceptable) {
    throw errores.archivoInvalido('El tipo de contenido del archivo no corresponde al formato declarado.');
  }

  if (formato === 'PDF/A' && !firmaPdf(buffer)) {
    throw errores.archivoInvalido('El archivo no contiene una firma PDF válida.');
  }
  if (formato === 'TIFF' && !firmaTiff(buffer)) {
    throw errores.archivoInvalido('El archivo no contiene una firma TIFF válida.');
  }

  return { formato, extension, tipoContenido: mimeEsperado };
}

export function tituloDesdeNombre(nombreOriginal) {
  const base = String(nombreOriginal ?? '').replace(/\.[^.]+$/, '').trim();
  return base || 'Documento sin título';
}
