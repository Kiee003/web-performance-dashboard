import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PantauLogo, BRAND } from './Logo';
import './LoginPage.css';

const LoginPage = () => {
    const { login, register } = useAuth();
    const [mode, setMode] = useState('login');
    const [form, setForm] = useState({ username: '', email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (e) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            let result;
            if (mode === 'login') {
                result = await login(form.email, form.password);
            } else {
                if (!form.username.trim()) {
                    setError('Please enter a username');
                    setLoading(false);
                    return;
                }
                result = await register(form.username, form.email, form.password);
            }
            if (!result.success) setError(result.error || 'Something went wrong');
        } catch (err) {
            setError(err.response?.data?.error || 'Could not connect to server');
        } finally {
            setLoading(false);
        }
    };

    const switchMode = (newMode) => {
        setMode(newMode);
        setError('');
        setForm({ username: '', email: '', password: '' });
    };

    return (
        <div className="login-page">
            <div className="login-card">

                {/* Header */}
                <div className="login-header">
                    <div className="login-icon-wrap">
                        <PantauLogo size={72} />
                    </div>
                    <h1>{BRAND.name}</h1>
                    <p>Analyse, optimise and monitor your website</p>
                </div>

                {/* Tabs */}
                <div className="login-tabs">
                    <button
                        className={`tab-btn ${mode === 'login' ? 'active' : ''}`}
                        onClick={() => switchMode('login')}
                        type="button"
                    >
                        Sign In
                    </button>
                    <button
                        className={`tab-btn ${mode === 'register' ? 'active' : ''}`}
                        onClick={() => switchMode('register')}
                        type="button"
                    >
                        Create Account
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="login-form">
                    {mode === 'register' && (
                        <div className="form-group">
                            <label>Username</label>
                            <input
                                type="text"
                                name="username"
                                value={form.username}
                                onChange={handleChange}
                                placeholder="Your name"
                                disabled={loading}
                                autoComplete="name"
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label>Email Address</label>
                        <input
                            type="email"
                            name="email"
                            value={form.email}
                            onChange={handleChange}
                            placeholder="you@example.com"
                            disabled={loading}
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <div className="password-wrapper">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                placeholder={mode === 'register' ? 'At least 6 characters' : 'Your password'}
                                disabled={loading}
                                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            />
                            <button
                                type="button"
                                className="show-password"
                                onClick={() => setShowPassword(p => !p)}
                                tabIndex={-1}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {/* Eye icon SVG instead of emoji */}
                                {showPassword ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                                        <line x1="1" y1="1" x2="23" y2="23"/>
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                        <circle cx="12" cy="12" r="3"/>
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="login-error">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            {error}
                        </div>
                    )}

                    <button type="submit" className="login-submit" disabled={loading}>
                        {loading
                            ? (mode === 'login' ? 'Signing in...' : 'Creating account...')
                            : (mode === 'login' ? 'Sign In' : 'Create Account')
                        }
                    </button>
                </form>

                {/* Footer */}
                <div className="login-footer">
                    {mode === 'register' ? (
                        <p>
                            Already have an account?{' '}
                            <button className="link-btn" onClick={() => switchMode('login')}>
                                Sign in
                            </button>
                        </p>
                    ) : (
                        <p>
                            Don't have an account?{' '}
                            <button className="link-btn" onClick={() => switchMode('register')}>
                                Create one
                            </button>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoginPage;