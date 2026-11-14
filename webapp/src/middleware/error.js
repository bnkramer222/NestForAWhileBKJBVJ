export function notFoundHandler(req, res) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.status(404).render('error', {
    title: 'Not found',
    status: 404,
    message: 'That page does not exist. Head back to the kiosk to start a session.',
  });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || (err.code === 'RESTRICTED_ITEM' ? 409 : 500);
  if (status >= 500) console.error('[error]', err);

  const payload = {
    error: status >= 500 ? 'Something went wrong on our side.' : err.message,
  };
  if (err.details) payload.details = err.details;

  if (req.path.startsWith('/api/')) {
    return res.status(status).json(payload);
  }
  res.status(status).render('error', {
    title: status >= 500 ? 'Server error' : 'Request blocked',
    status,
    message: payload.error,
  });
}
