/** Wrap async route handlers so rejections reach the error middleware (Express 4). */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
