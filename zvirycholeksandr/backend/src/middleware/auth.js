const jwt = require('jsonwebtoken');

// In-memory blacklist для відкликаних токенів (logout)
const blacklist = new Set();

function invalidateToken(token) {
  blacklist.add(token);
  // Чистимо старі токени раз на годину
  setTimeout(() => blacklist.delete(token), 7 * 24 * 60 * 60 * 1000);
}

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  if (blacklist.has(token)) return res.status(401).json({ error: 'Token revoked' });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    req.token = token;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports.invalidateToken = invalidateToken;
