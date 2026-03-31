// const jwt = require('jsonwebtoken');
// const { isBlacklisted } = require('../utils/blacklist');

// const authenticateToken = (req, res, next) => {
//     const authHeader = req.headers['authorization'];
//     const token = authHeader && authHeader.split(' ')[1];

//     if (!token) {
//         return res.status(401).json({ error: 'Access denied. No token provided.' });
//     }
    
//     // Check if token is blacklisted
//     if (isBlacklisted(token)) {
//         return res.status(401).json({ error: 'Token has been revoked. Please login again.' });
//     }

//     try {
//         const decoded = jwt.verify(token, process.env.JWT_SECRET);
//         req.user = decoded;
//         next();
//     } catch (error) {
//         return res.status(403).json({ error: 'Invalid or expired token.' });
//     }
// };

// const isAdmin = (req, res, next) => {
//     if (req.user.role !== 'admin') {
//         return res.status(403).json({ error: 'Admin access required' });
//     }
//     next();
// };

// module.exports = { authenticateToken, isAdmin };

const jwt = require('jsonwebtoken');
const { isBlacklisted } = require('../utils/blacklist');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // ✅ Check if token is blacklisted
    if (isBlacklisted(token)) {
        return res.status(401).json({ error: 'Token has been revoked. Please login again.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }
};

const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

module.exports = { authenticateToken, isAdmin };