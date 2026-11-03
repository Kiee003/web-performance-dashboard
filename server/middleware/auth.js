const jwt = require('jsonwebtoken');
const config = require('../config');
const database = require('../db/database');

const JWT_SECRET = config.jwtSecret;

const ROLE_LEVEL = { normal: 1, moderator: 2, admin: 3 };

// Verify JWT token — attaches req.user if valid
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const token = authHeader.substring(7);

    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, error: 'Session expired, please log in again' });
        }
        return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    // A token stays valid only while its version matches the account's.
    // Changing a password bumps the account's version, which ends every existing
    // session at once — including any token that leaked. Tokens issued before
    // this check existed carry no version; treat those as 0 so deploying this
    // does not sign everyone out.
    const account = decoded?.id ? database.getUserById(decoded.id) : null;
    if (!account) {
        return res.status(401).json({ success: false, error: 'Account no longer exists' });
    }
    if ((decoded.token_version ?? 0) !== (account.token_version ?? 0)) {
        return res.status(401).json({
            success: false,
            error: 'Your password was changed, so this session has ended. Please sign in again.'
        });
    }

    req.user = decoded;
    next();
};

// Require a minimum role level — usage: requireMinRole('moderator')
const requireMinRole = (minRole) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const userLevel = ROLE_LEVEL[req.user.role] || 0;
        const requiredLevel = ROLE_LEVEL[minRole] || 0;

        if (userLevel < requiredLevel) {
            return res.status(403).json({
                success: false,
                error: `Access denied. Required role: ${minRole}`
            });
        }

        next();
    };
};

// Require an exact role (or array of roles) — usage: requireRole('admin') or requireRole(['admin', 'moderator'])
const requireRole = (roles) => {
    const allowed = Array.isArray(roles) ? roles : [roles];
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        if (!allowed.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: `Access denied. This action requires: ${allowed.join(' or ')}`
            });
        }
        next();
    };
};

// Sign a new token
const signToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            token_version: user.token_version ?? 0,
        },
        JWT_SECRET,
        { expiresIn: config.jwtExpiresIn }
    );
};

module.exports = { verifyToken, requireMinRole, requireRole, signToken };
