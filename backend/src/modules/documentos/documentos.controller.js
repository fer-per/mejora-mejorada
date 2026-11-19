import fs from 'node:fs';
import { manejar } from '../../common/async-handler.js';
import { abrirObjeto } from '../../config/almacenamiento.js';
import { errores } from '../../common/errors.js';
import * as servicio from './documentos.service.js';

async function transmitir(preparado, res, next, cache) {
  let flujo;
  if (preparado.remoto) {
    try {
      flujo = await abrirObjeto(preparado.clave);
    } catch {
      next(errores.archivoNoDisponible());
      return;
    }
    if (!flujo) {
      next(errores.archivoNoDisponible());
      return;
    }
  } else {
    flujo = fs.createReadStream(preparado.rutaAbsoluta);
  }

  res.setHeader('Content-Type', preparado.tipoContenido);
  res.setHeader('Content-Disposition', `inline; filename="${preparado.nombre}"`);
  res.setHeader('Cache-Control', cache);
  flujo.on('error', next);
  flujo.pipe(res);
}

export const buscarSimple = manejar(async (req, res) => {
  const resultado = await servicio.buscarSimple(req.datos, req.usuario);
  res.json(resultado);
});

export const buscarAvanzada = manejar(async (req, res) => {
  const resultado = await servicio.buscarAvanzada(req.datos, req.usuario);
  res.json(resultado);
});

export const obtenerDetalle = manejar(async (req, res) => {
  const documento = await servicio.obtenerDetalle(req.datos.id, req.usuario);
  res.json({ documento });
});

export const crear = manejar(async (req, res) => {
  const documento = await servicio.crearDocumento(req.datos, req.file, req.usuario);
  res.status(201).json({ documento });
});

export const crearMasivo = manejar(async (req, res) => {
  const resultado = await servicio.crearDocumentosMetadatos(req.datos, req.usuario);
  res.status(201).json(resultado);
});

export const actualizar = manejar(async (req, res) => {
  const documento = await servicio.actualizarDocumento(Number(req.params.id), req.datos, req.usuario);
  res.json({ documento });
});

export const anular = manejar(async (req, res) => {
  const documento = await servicio.anularDocumento(Number(req.params.id), req.datos, req.usuario);
  res.json({ documento });
});

export const restaurar = manejar(async (req, res) => {
  const documento = await servicio.restaurarDocumento(Number(req.params.id), req.usuario);
  res.json({ documento });
});

export const reemplazarArchivo = manejar(async (req, res) => {
  const documento = await servicio.reemplazarArchivo(
    Number(req.params.id),
    req.file,
    req.usuario,
  );
  res.json({ documento });
});

export const listarHistorial = manejar(async (req, res) => {
  const resultado = await servicio.listarHistorialDocumento(
    Number(req.params.id),
    req.datos,
    req.usuario,
  );
  res.json(resultado);
});

export const revertirCambio = manejar(async (req, res) => {
  const resultado = await servicio.revertirCambioDocumento(
    Number(req.params.id),
    Number(req.params.idCambio),
    req.usuario,
    { forzar: req.datos.forzar === true || req.datos.forzar === 'true' },
  );
  res.json(resultado);
});

export const descargarArchivo = manejar(async (req, res, next) => {
  const preparado = await servicio.obtenerArchivo(req.datos.id, req.usuario);
  await transmitir(preparado, res, next, 'private, max-age=60');
});

export const descargarMiniatura = manejar(async (req, res, next) => {
  const preparado = await servicio.obtenerMiniatura(req.datos.id, req.usuario);
  await transmitir(preparado, res, next, 'private, max-age=300');
});
