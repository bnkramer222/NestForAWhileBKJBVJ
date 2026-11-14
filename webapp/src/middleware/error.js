export function notFoundHandler(req, res) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.status(404).render('error', {
    title: 'Page not found',
    status: 404,
    message: "We couldn't find that page. Head back to the kiosk and we'll get you shopping.",
  });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || (err.code === 'RESTRICTED_ITEM' ? 409 : 500);
  if (status >= 500) console.error('[error]', err);

  const payload = {
    error: status >= 500 ? "Sorry — something went wrong on our end. Please try again, or ask a volunteer." : err.message,
  };
  if (err.details) payload.details = err.details;

  if (req.path.startsWith('/api/')) {
    return res.status(status).json(payload);
  }
  res.status(status).render('error', {
    title: status >= 500 ? 'Sorry about that' : "Let's sort this out",
    status,
    message: payload.error,
  });
}
