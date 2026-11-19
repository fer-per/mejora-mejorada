import { useAvisos } from '../hooks/useAvisos.js';
import { useDuplicadosGestion } from '../hooks/useDuplicadosGestion.js';
import Avisos from './Avisos.jsx';

const GRUPOS = [
  ['protocolos', 'Protocolos duplicados', (grupo) => `${grupo.fondo} · ${grupo.numero}`],
  ['escribanos', 'Escribanos duplicados', (grupo) => `${grupo.fondo} · ${grupo.nombreNormalizado}`],
  ['registros', 'Registros duplicados', (grupo) => `${grupo.anio} · ${grupo.protocolo} · ${grupo.numero}`],
  ['interesados', 'Interesados duplicados', (grupo) => grupo.nombreNormalizado],
];

export default function DuplicadosTab({ esAdmin, onFusionar }) {
  const { duplicados, error, recargar } = useDuplicadosGestion();
  const avisos = useAvisos();

  return (
    <>
      <Avisos error={avisos.error || error} exito={avisos.exito} />

      <section className="panel-resultados">
        <div className="resultados-barra">
          <div>
            <p className="resultados-titulo">Detección de duplicados</p>
            <p className="resultados-subtitulo">Los interesados duplicados se informan para revisión manual.</p>
          </div>
          <button type="button" className="btn boton-secundario" onClick={recargar}>
            Actualizar
          </button>
        </div>
        {!duplicados ? (
          <div className="estado-resultados"><p>Cargando duplicados...</p></div>
        ) : (
          <>
            <div className="row g-3 mb-3">
              {[
                ['Protocolos', duplicados.totales.protocolos],
                ['Escribanos', duplicados.totales.escribanos],
                ['Registros', duplicados.totales.registros],
                ['Grupos de interesados', duplicados.totales.interesados],
              ].map(([etiqueta, valor]) => (
                <div className="col-6 col-md-3" key={etiqueta}>
                  <div className="dato-resumen">
                    <span className="dato-resumen-numero">{valor}</span>
                    <span className="dato-resumen-etiqueta">{etiqueta}</span>
                  </div>
                </div>
              ))}
            </div>

            {GRUPOS.map(([clave, titulo, describir]) => (
              <div className="seccion-formulario" key={clave}>
                <h2 className="seccion-formulario-titulo">{titulo}</h2>
                {duplicados[clave]?.length === 0 ? (
                  <p className="seccion-formulario-ayuda">No se detectaron grupos duplicados.</p>
                ) : (
                  <div className="tabla-usuarios-contenedor">
                    <table className="table tabla-usuarios align-middle">
                      <thead>
                        <tr>
                          <th scope="col">Grupo</th>
                          <th scope="col">Cantidad</th>
                          <th scope="col">Entidades</th>
                          {esAdmin && clave !== 'interesados' && <th scope="col" className="text-end">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {duplicados[clave]?.map((grupo) => (
                          <tr key={`${clave}-${describir(grupo)}-${grupo.cantidad}`}>
                            <td>{describir(grupo)}</td>
                            <td>{grupo.cantidad}</td>
                            <td className="small">
                              {(grupo.entidades ?? []).map((entidad) => (
                                <span key={entidad.id} className="me-2">
                                  #{entidad.id}{entidad.nombre ? ` ${entidad.nombre}` : ''}
                                </span>
                              ))}
                            </td>
                            {esAdmin && clave !== 'interesados' && (
                              <td className="text-end">
                                <button
                                  type="button"
                                  className="btn btn-sm boton-secundario"
                                  onClick={() => onFusionar(clave, grupo.entidades ?? [])}
                                >
                                  Ir a fusionar
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </section>
    </>
  );
}
