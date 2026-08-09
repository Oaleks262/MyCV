const crypto = require('crypto');

function safeRequestId(value) {
  const input = String(value || '').trim();
  return /^[a-zA-Z0-9._:-]{8,100}$/.test(input) ? input : '';
}

module.exports = function requestContext(req, res, next) {
  req.requestId = safeRequestId(req.get('x-request-id')) || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  res.locals.requestId = req.requestId;
  next();
};
