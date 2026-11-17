import { SECCIONES } from '../constants.js';

export default function GestionTabs({ seccion, onChange }) {
  return (
    <div className="panel-busqueda-tabs" role="tablist" aria-label="Secciones de gestión">
      {SECCIONES.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={seccion === item.id}
          className={`tab-busqueda ${seccion === item.id ? 'activo' : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.etiqueta}
        </button>
      ))}
    </div>
  );
}
