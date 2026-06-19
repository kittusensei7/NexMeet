const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * Checks the Authorization header for a Bearer JWT token.
 * Verifies the token and attaches the user payload to req.user.
 */
const auth = (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    // Check if Authorization header exists and has Bearer token format
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Extract the token
    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach decoded user payload to request object
    req.user = decoded;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = auth;
