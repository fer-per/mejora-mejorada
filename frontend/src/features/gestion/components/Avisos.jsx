export default function Avisos({ error, exito }) {
  return (
    <>
      {error && <div className="alert alert-danger py-2 px-3 small" role="alert">{error}</div>}
      {exito && <div className="alert alert-success py-2 px-3 small" role="alert">{exito}</div>}
    </>
  );
}
