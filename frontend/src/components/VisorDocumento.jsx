import { useEffect, useRef, useState } from 'react';
import { apiArchivo } from '../services/api.js';

let cargadorUtif = null;

function cargarUtif() {
  if (!cargadorUtif) {
    cargadorUtif = import('utif2').then((modulo) => modulo.default ?? modulo);
  }
  return cargadorUtif;
}

function nombreDescarga(documento) {
  const base = (documento.titulo ?? 'documento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const extension = documento.formato === 'TIFF' ? 'tif' : 'pdf';
  return `${base || 'documento'}.${extension}`;
}

export default function VisorDocumento({ documento }) {
  const esTiff = documento.formato === 'TIFF';
  const lienzoRef = useRef(null);
  const utifRef = useRef(null);
  const [fase, setFase] = useState('cargando');
  const [mensajeError, setMensajeError] = useState(null);
  const [urlArchivo, setUrlArchivo] = useState(null);
  const [paginas, setPaginas] = useState([]);
  const [paginaActual, setPaginaActual] = useState(0);

  useEffect(() => {
    let cancelado = false;
    let urlRevocar = null;

    setFase('cargando');
    setMensajeError(null);
    setPaginas([]);
    setPaginaActual(0);

    apiArchivo(`/api/documentos/${documento.id}/archivo`)
      .then(async (blob) => {
        if (cancelado) return;
        urlRevocar = URL.createObjectURL(blob);
        if (esTiff) {
          const buffer = await blob.arrayBuffer();
          const UTIF = await cargarUtif();
          utifRef.current = UTIF;
          const ifds = UTIF.decode(buffer);
          ifds.forEach((ifd) => UTIF.decodeImage(buffer, ifd));
          if (cancelado) return;
          if (ifds.length === 0) throw new Error('El archivo TIFF no contiene páginas válidas.');
          setPaginas(ifds);
        }
        setUrlArchivo(urlRevocar);
        setFase('listo');
      })
      .catch((error) => {
        if (cancelado) return;
        setMensajeError(error.message ?? 'No fue posible cargar el documento.');
        setFase('error');
      });

    return () => {
      cancelado = true;
      if (urlRevocar) URL.revokeObjectURL(urlRevocar);
    };
  }, [documento.id, esTiff]);

  useEffect(() => {
    if (!esTiff || fase !== 'listo') return undefined;
    const ifd = paginas[paginaActual];
    const lienzo = lienzoRef.current;
    const UTIF = utifRef.current;
    if (!ifd || !lienzo || !UTIF || !ifd.width || !ifd.height) return undefined;

    lienzo.width = ifd.width;
    lienzo.height = ifd.height;
    const contexto = lienzo.getContext('2d');
    const rgba = UTIF.toRGBA8(ifd);
    contexto.putImageData(
      new ImageData(new Uint8ClampedArray(rgba), ifd.width, ifd.height),
      0,
      0,
    );
    return undefined;
  }, [esTiff, fase, paginas, paginaActual]);

  if (fase === 'cargando') {
    return (
      <div className="text-center text-muted py-5" role="status">
        <span className="spinner-border spinner-border-sm me-2" />
        Cargando documento...
      </div>
    );
  }

  if (fase === 'error') {
    return (
      <div className="alert alert-danger py-2 small mb-0" role="alert">
        {mensajeError}
      </div>
    );
  }

  return (
    <div className="border rounded bg-body-secondary p-2 p-md-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <span className="small text-muted">
          Visor documental · {documento.formato}
          {esTiff && paginas.length > 0 ? ` · página ${paginaActual + 1} de ${paginas.length}` : ''}
        </span>
        <div className="d-flex gap-2">
          {esTiff && paginas.length > 1 && (
            <div className="btn-group btn-group-sm">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setPaginaActual((p) => Math.max(0, p - 1))}
                disabled={paginaActual === 0}
              >
                Anterior
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setPaginaActual((p) => Math.min(paginas.length - 1, p + 1))}
                disabled={paginaActual >= paginas.length - 1}
              >
                Siguiente
              </button>
            </div>
          )}
          {urlArchivo && (
            <a
              href={urlArchivo}
              download={nombreDescarga(documento)}
              className="btn btn-sm btn-dark"
            >
              Descargar
            </a>
          )}
        </div>
      </div>

      {esTiff ? (
        <div className="text-center bg-white rounded p-2 overflow-auto" style={{ maxHeight: '75vh' }}>
          <canvas ref={lienzoRef} className="img-fluid" style={{ maxWidth: '100%', height: 'auto' }} />
        </div>
      ) : (
        <iframe
          src={urlArchivo}
          title={`Visor de ${documento.titulo}`}
          className="w-100 border bg-white"
          style={{ height: '75vh' }}
        />
      )}
    </div>
  );
}
