import { translator } from '../i18n/index.js';

const tFor = (req) => req.t || translator('en');

export function notFoundHandler(req, res) {
  const t = tFor(req);
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.status(404).render('error', {
    title: t('err.title.404'),
    status: 404,
    message: t('err.404'),
  });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const t = tFor(req);
  const status = err.status || (err.code === 'RESTRICTED_ITEM' ? 409 : 500);
  if (status >= 500) console.error('[error]', err);

  const payload = {
    error: status >= 500 ? t('err.500') : err.message,
  };
  if (err.details) payload.details = err.details;

  if (req.path.startsWith('/api/')) {
    return res.status(status).json(payload);
  }
  res.status(status).render('error', {
    title: status >= 500 ? t('err.title.500') : t('err.title.400'),
    status,
    message: payload.error,
  });
}
