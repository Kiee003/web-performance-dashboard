// ─────────────────────────────────────────────────────────────────────────────
// Login state for the whole app: who is logged in, their role, and the
// login / register / logout actions. Server calls go through services/api.js.
// ─────────────────────────────────────────────────────────────────────────────
import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, registerUser, getCurrentUser, TOKEN_KEY } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY));
    const [loading, setLoading] = useState(true);

    // Save the token immediately so the very next request already carries it
    const saveSession = (newToken, newUser) => {
        localStorage.setItem(TOKEN_KEY, newToken);
        setToken(newToken);
        setUser(newUser);
    };

    const logout = () => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
    };

    // On app load, check that a stored token is still valid
    useEffect(() => {
        const verifyStoredToken = async () => {
            if (!token) {
                setLoading(false);
                return;
            }
            try {
                const data = await getCurrentUser();
                if (data.success) {
                    setUser(data.user);
                } else {
                    logout();
                }
            } catch (err) {
                // Only an expired/invalid token (401) logs you out. If the server
                // is just unreachable, keep the token so a refresh restores the session.
                if (err.response?.status === 401) logout();
            } finally {
                setLoading(false);
            }
        };
        verifyStoredToken();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const login = async (email, password) => {
        const data = await loginUser(email, password);
        if (data.success) saveSession(data.token, data.user);
        return data;
    };

    const register = async (username, email, password) => {
        const data = await registerUser(username, email, password);
        if (data.success) saveSession(data.token, data.user);
        return data;
    };

    // Role helpers
    const isAdmin = user?.role === 'admin';
    const isModerator = user?.role === 'moderator' || user?.role === 'admin';
    const isNormal = user?.role === 'normal';

    const can = (action) => {
        if (!user) return false;
        const permissions = {
            normal:    ['run_audit', 'own_history', 'crawler', 'export_own'],
            moderator: ['run_audit', 'own_history', 'crawler', 'export_own', 'all_history', 'user_list', 'delete_audit', 'export_all'],
            admin:     ['run_audit', 'own_history', 'crawler', 'export_own', 'all_history', 'user_list', 'delete_audit', 'export_all', 'manage_users', 'change_roles', 'server_stats'],
        };
        return permissions[user.role]?.includes(action) || false;
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, register, logout, isAdmin, isModerator, isNormal, can }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

export default AuthContext;
