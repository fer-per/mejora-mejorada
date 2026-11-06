import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config/env.js';
import authRoutes from './modules/auth/auth.routes.js';
import documentosRoutes from './modules/documentos/documentos.routes.js';
import catalogosRoutes from './modules/catalogos/catalogos.routes.js';
import { manejarErrores, noEncontrado } from './middlewares/error-handler.js';

export function crearApp() {
  const app = express();

  if (config.esProduccion) {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          frameSrc: ["'self'", 'blob:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );
  app.use(
    cors({
      origin(origen, callback) {
        callback(null, origen === config.corsOrigen);
      },
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  app.get('/api/salud', (req, res) =>
    res.json({ estado: 'operativo', sistema: 'SIARC-ARA', fecha: new Date().toISOString() }),
  );

  app.use('/api/auth', authRoutes);
  app.use('/api/documentos', documentosRoutes);
  app.use('/api/catalogos', catalogosRoutes);

  app.use('/api', noEncontrado);

  const compilacionFrontend = config.rutas.frontend;
  if (fs.existsSync(path.join(compilacionFrontend, 'index.html'))) {
    app.use(express.static(compilacionFrontend));
    app.get(/^(?!\/api).*/, (req, res) => {
      res.sendFile(path.join(compilacionFrontend, 'index.html'));
    });
  }

  app.use(noEncontrado);
  app.use(manejarErrores);

  return app;
}
