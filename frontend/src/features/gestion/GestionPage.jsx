import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BarraNavegacion from '../../components/BarraNavegacion.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useResumenGestion } from './hooks/useResumenGestion.js';
import DocumentosTab from './components/DocumentosTab.jsx';
import DuplicadosTab from './components/DuplicadosTab.jsx';
import EstructuraTab from './components/EstructuraTab.jsx';
import GestionTabs from './components/GestionTabs.jsx';
import OperacionesTab from './components/OperacionesTab.jsx';

export default function GestionPage() {
  const { usuario } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const esAdmin = usuario?.role === 'admin';

  const [documentoInicial, setDocumentoInicial] = useState(null);
  const [seccion, setSeccion] = useState('documentos');
  const [version, setVersion] = useState(0);
  const [fusionInicial, setFusionInicial] = useState(null);
  const resumen = useResumenGestion(version);

  useEffect(() => {
    const id = searchParams.get('documento');
    if (!id) return;
    setDocumentoInicial(id);
    const siguientes = new URLSearchParams(searchParams);
    siguientes.delete('documento');
    setSearchParams(siguientes, { replace: true });
  }, [searchParams, setSearchParams]);

  const cambiarSeccion = (nuevaSeccion) => {
    setFusionInicial(null);
    setSeccion(nuevaSeccion);
  };

  const irAFusionar = (tipo, entidades) => {
    setFusionInicial({ tipo, entidades });
    setSeccion('estructura');
  };

  return (
    <div className="app-fondo">
      <BarraNavegacion />

      <main className="contenedor-busqueda">
        <header className="encabezado-busqueda">
          <div>
            <p className="encabezado-etiqueta">Procesos tÃ©cnicos archivÃ­sticos</p>
            <h1 className="encabezado-titulo">GestiÃ³n documental</h1>
            <p className="encabezado-descripcion">
              Edite metadatos e interesados, administre la jerarquÃ­a archivÃ­stica, revise el historial con valores
              anteriores y posteriores, y detecte duplicados.
            </p>
          </div>
          <div className="resumen-datos">
            <div className="dato-resumen">
              <span className="dato-resumen-numero">{resumen?.documentos ?? 'â€”'}</span>
              <span className="dato-resumen-etiqueta">Documentos activos</span>
            </div>
            <div className="dato-resumen">
              <span className="dato-resumen-numero">{resumen?.anulados ?? 'â€”'}</span>
              <span className="dato-resumen-etiqueta">Anulados</span>
            </div>
            <div className="dato-resumen">
              <span className="dato-resumen-numero">{resumen?.cambios ?? 'â€”'}</span>
              <span className="dato-resumen-etiqueta">Cambios registrados</span>
            </div>
          </div>
        </header>

        <GestionTabs seccion={seccion} onChange={cambiarSeccion} />

        {seccion === 'documentos' && (
          <DocumentosTab
            esAdmin={esAdmin}
            documentoInicial={documentoInicial}
            onCerrarDocumento={() => setDocumentoInicial(null)}
            onCambio={() => setVersion((valor) => valor + 1)}
          />
        )}
        {seccion === 'estructura' && (
          <EstructuraTab
            esAdmin={esAdmin}
            fusionInicial={fusionInicial}
            onCambio={() => setVersion((valor) => valor + 1)}
          />
        )}
        {seccion === 'operaciones' && (
          <OperacionesTab onCambio={() => setVersion((valor) => valor + 1)} />
        )}
        {seccion === 'duplicados' && (
          <DuplicadosTab esAdmin={esAdmin} onFusionar={irAFusionar} />
        )}
      </main>
    </div>
  );
}
