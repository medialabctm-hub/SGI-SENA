/**
 * Envuelve handlers/middleware async para que los rechazos lleguen a
 * Express error middleware (Express 4 no captura promesas rechazadas).
 *
 * @param {(req, res, next) => Promise<unknown>} fn
 * @returns {import('express').RequestHandler}
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
