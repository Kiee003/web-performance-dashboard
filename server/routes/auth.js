const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

const database = require('../db/database');
const { verifyToken, requireMinRole, requireRole, signToken } = require('../middleware/auth');

// ─── REGISTER ─────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ success: false, error: 'Username, email and password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
        }

        const existing = database.getUserByEmail(email);
        if (existing) {
            return res.status(409).json({ success: false, error: 'An account with this email already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const userCount = database.getUserCount();
        const role = userCount === 0 ? 'admin' : 'normal';

        const userId = database.createUser(username, email, passwordHash, role);
        const user = database.getUserById(userId);
        const token = signToken(user);

        console.log(`✅ New user registered: ${email} (role: ${role})`);

        res.status(201).json({
            success: true,
            message: role === 'admin'
                ? 'Admin account created — you are the first user!'
                : 'Account created successfully',
            token,
            user: { id: user.id, username: user.username, email: user.email, role: user.role }
        });

    } catch (error) {
        console.error('❌ Register error:', error.message);
        res.status(500).json({ success: false, error: 'Registration failed' });
    }
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }

        const user = database.getUserByEmail(email);
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        database.updateLastLogin(user.id);
        const token = signToken(user);

        console.log(`✅ User logged in: ${email} (role: ${user.role})`);

        res.json({
            success: true,
            token,
            user: { id: user.id, username: user.username, email: user.email, role: user.role }
        });

    } catch (error) {
        console.error('❌ Login error:', error.message);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

// ─── GET CURRENT USER ─────────────────────────────────────────────────────────
router.get('/me', verifyToken, (req, res) => {
    const user = database.getUserById(req.user.id);
    if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, user });
});

// ─── LIST ALL USERS (moderator+) ─────────────────────────────────────────────
router.get('/users', verifyToken, requireMinRole('moderator'), (req, res) => {
    try {
        const users = database.getAllUsers();
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
});

// ─── CHANGE USER ROLE (admin only) ───────────────────────────────────────────
router.put('/users/:id/role', verifyToken, requireRole('admin'), (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!['normal', 'moderator', 'admin'].includes(role)) {
            return res.status(400).json({ success: false, error: 'Invalid role. Use: normal, moderator, admin' });
        }
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ success: false, error: 'You cannot change your own role' });
        }

        const updated = database.updateUserRole(parseInt(id), role);
        if (!updated) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        console.log(`✅ Admin ${req.user.email} changed user ${id} role to ${role}`);
        res.json({ success: true, message: `User role updated to ${role}` });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to update role' });
    }
});

// ─── DELETE USER (admin only) ─────────────────────────────────────────────────
router.delete('/users/:id', verifyToken, requireRole('admin'), (req, res) => {
    try {
        const { id } = req.params;

        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ success: false, error: 'You cannot delete your own account' });
        }

        const deleted = database.deleteUser(parseInt(id));
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        console.log(`✅ Admin ${req.user.email} deleted user ${id}`);
        res.json({ success: true, message: 'User deleted successfully' });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to delete user' });
    }
});

// ─── MODERATOR ASSIGNMENTS (admin only) ──────────────────────────────────────

// Get all assignments — used to render the assignment UI in Manage Accounts
router.get('/assignments', verifyToken, requireRole('admin'), (req, res) => {
    try {
        const assignments = database.getAllAssignments();
        res.json({ success: true, assignments });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch assignments' });
    }
});

// Assign a normal user to a moderator
router.post('/assignments', verifyToken, requireRole('admin'), (req, res) => {
    try {
        const { moderatorId, userId } = req.body;

        if (!moderatorId || !userId) {
            return res.status(400).json({ success: false, error: 'moderatorId and userId are required' });
        }

        const moderator = database.getUserById(moderatorId);
        if (!moderator || moderator.role !== 'moderator') {
            return res.status(400).json({ success: false, error: 'Target is not a moderator' });
        }

        const targetUser = database.getUserById(userId);
        if (!targetUser || targetUser.role !== 'normal') {
            return res.status(400).json({ success: false, error: 'Can only assign normal users' });
        }

        database.assignUserToModerator(parseInt(moderatorId), parseInt(userId), req.user.id);

        console.log(`✅ Admin ${req.user.email} assigned user ${userId} to moderator ${moderatorId}`);
        res.json({ success: true, message: 'User assigned successfully' });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to assign user' });
    }
});

// Remove an assignment
router.delete('/assignments/:moderatorId/:userId', verifyToken, requireRole('admin'), (req, res) => {
    try {
        const { moderatorId, userId } = req.params;
        const removed = database.unassignUserFromModerator(parseInt(moderatorId), parseInt(userId));

        if (!removed) {
            return res.status(404).json({ success: false, error: 'Assignment not found' });
        }

        console.log(`✅ Admin ${req.user.email} removed assignment (moderator ${moderatorId}, user ${userId})`);
        res.json({ success: true, message: 'Assignment removed' });

    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to remove assignment' });
    }
});

// ─── SERVER STATISTICS (admin only) ──────────────────────────────────────────
router.get('/stats', verifyToken, requireRole('admin'), (req, res) => {
    try {
        const stats = database.getStatistics();
        const userCount = database.getUserCount();
        res.json({
            success: true,
            stats: { ...stats, registered_users: userCount }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
    }
});

module.exports = router;