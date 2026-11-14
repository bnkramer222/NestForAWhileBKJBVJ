import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

import { env } from './config/env.js';
import { brand } from './config/brand.js';
import { db, pool } from './config/db.js';
import routes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PgSession = connectPgSimple(session);

export function createApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.locals.brand = brand; // available to every view, including error pages
  app.set('views', path.join(__dirname, 'views'));
  app.set('trust proxy', 1);
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
          mediaSrc: ["'self'", 'blob:'],
        },
      },
    }),
  );
  app.use(compression());
  app.use(morgan(env.isProd ? 'combined' : 'dev'));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json({ limit: '256kb' }));
  app.use('/static', express.static(path.join(__dirname, '..', 'public'), { maxAge: env.isProd ? '1d' : 0 }));
  // Open-source barcode/QR scanner (Apache-2.0), self-hosted so the CSP can stay 'self'-only.
  app.get('/static/vendor/html5-qrcode.min.js', (req, res) =>
    res.sendFile(path.join(__dirname, '..', 'node_modules', 'html5-qrcode', 'html5-qrcode.min.js'), {
      maxAge: env.isProd ? '7d' : 0,
    }),
  );

  const store = db.enabled
    ? new PgSession({ pool, tableName: 'session', createTableIfNotExists: false })
    : undefined;
  if (!store) console.warn('[app] No database configured — using in-memory sessions (dev only).');

  app.use(
    session({
      name: 'ecmtg.sid',
      secret: env.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.isProd,
        maxAge: 1000 * 60 * 60 * 4,
      },
    }),
  );

  app.use((req, res, next) => {
    res.locals.dbEnabled = db.enabled;
    res.locals.currentPath = req.path;
    next();
  });

  app.use(routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
