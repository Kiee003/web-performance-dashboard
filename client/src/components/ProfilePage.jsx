import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateUsername, changePassword } from '../services/api';
import './ProfilePage.css';

// ─────────────────────────────────────────────────────────────────────────────
// My Profile — the one page where a user edits something about themselves.
//
// Two independent forms:
//   • Display name  → PUT /api/auth/profile   (username only)
//   • Password      → PUT /api/auth/password  (requires the current password)
//
// Email and role are displayed but not editable: the email is the login
// identity and an admin manages roles. This is the same for every role — an
// admin changes other people's accounts in Manage Accounts, not here.
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_LABEL = { admin: 'Admin', moderator: 'Moderator', normal: 'User' };
const PASSWORD_MIN = 6;      // same rule as registration
const USERNAME_MIN = 2;      // matches the server's rule

const initials = (name) => (name || '?').trim().charAt(0).toUpperCase() || '?';

const formatDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

// One small banner for "it worked" / "it didn't"
const Alert = ({ tone, children }) => (
    <p className={`profile__alert profile__alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
        {children}
    </p>
);

const ProfilePage = () => {
    const { user, updateSession, logout } = useAuth();

    // ── Display name ─────────────────────────────────────────────────────────
    const [username, setUsername] = useState(user?.username || '');
    const [nameState, setNameState] = useState({ saving: false, error: null, ok: null });

    // ── Password ─────────────────────────────────────────────────────────────
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [passwordState, setPasswordState] = useState({ saving: false, error: null, ok: null });

    if (!user) return null;

    const trimmedName = username.trim();
    const nameChanged = trimmedName !== user.username;
    const memberSince = formatDate(user.created_at);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleNameSubmit = async (event) => {
        event.preventDefault();
        if (!nameChanged || trimmedName.length < USERNAME_MIN) return;

        setNameState({ saving: true, error: null, ok: null });
        try {
            const data = await updateUsername(trimmedName);
            // The username is part of the login token, so keep the new one
            if (data.token) updateSession(data.token, data.user);
            setUsername(data.user?.username || trimmedName);
            setNameState({ saving: false, error: null, ok: 'Your username has been updated.' });
        } catch (err) {
            setNameState({ saving: false, error: err.message, ok: null });
        }
    };

    const handlePasswordSubmit = async (event) => {
        event.preventDefault();

        // Checked here as well as on the server so the user gets an instant answer
        if (newPassword.length < PASSWORD_MIN) {
            setPasswordState({
                saving: false, ok: null,
                error: `Your new password must be at least ${PASSWORD_MIN} characters.`
            });
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordState({ saving: false, ok: null, error: 'The two new passwords do not match.' });
            return;
        }
        if (newPassword === currentPassword) {
            setPasswordState({
                saving: false, ok: null,
                error: 'Choose a password that is different from your current one.'
            });
            return;
        }

        setPasswordState({ saving: true, error: null, ok: null });
        try {
            await changePassword(currentPassword, newPassword);
            // The server has bumped this account's token version, so every open
            // session is already invalid. Sign out here as well and send the
            // user to the login page with an explanation.
            logout('Your password has been changed. Please sign in again with your new password.');
        } catch (err) {
            setPasswordState({ saving: false, error: err.message, ok: null });
        }
    };

    const passwordType = showPasswords ? 'text' : 'password';
    const canSaveName = !nameState.saving && nameChanged && trimmedName.length >= USERNAME_MIN;
    const canSavePassword = !passwordState.saving && !!currentPassword && !!newPassword && !!confirmPassword;

    return (
        <div className="profile">

            {/* Who you are — read-only */}
            <section className="profile__summary">
                <div className="profile__avatar" aria-hidden="true">{initials(user.username)}</div>
                <div className="profile__identity">
                    <h3>{user.username}</h3>
                    <p className="profile__email">{user.email}</p>
                    <p className="profile__meta">
                        <span className={`profile__role profile__role--${user.role}`}>
                            {ROLE_LABEL[user.role] || user.role}
                        </span>
                        <span>{memberSince ? `Member since ${memberSince}` : 'Member'}</span>
                    </p>
                </div>
            </section>

            <div className="profile__grid">

                {/* ── Display name ─────────────────────────────────────────── */}
                <section className="profile__card">
                    <h3 className="profile__card-title">Display name</h3>
                    <p className="profile__card-lead">
                        This is the name shown in the sidebar and alongside your audits.
                    </p>

                    <form className="profile__form" onSubmit={handleNameSubmit}>
                        <label htmlFor="profile-username">Username</label>
                        <input
                            id="profile-username"
                            type="text"
                            value={username}
                            onChange={(event) => {
                                setUsername(event.target.value);
                                if (nameState.ok || nameState.error) setNameState({ saving: false, error: null, ok: null });
                            }}
                            autoComplete="username"
                            maxLength={40}
                            disabled={nameState.saving}
                        />
                        <p className="profile__hint">
                            2–40 characters. Letters, numbers, spaces and . _ - only.
                        </p>

                        {nameState.error && <Alert tone="error">{nameState.error}</Alert>}
                        {nameState.ok && <Alert tone="ok">{nameState.ok}</Alert>}

                        <div className="profile__actions">
                            <button type="submit" disabled={!canSaveName}>
                                {nameState.saving ? 'Saving…' : 'Save username'}
                            </button>
                            {nameChanged && !nameState.saving && (
                                <button
                                    type="button"
                                    className="profile__ghost"
                                    onClick={() => {
                                        setUsername(user.username);
                                        setNameState({ saving: false, error: null, ok: null });
                                    }}
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                </section>

                {/* ── Password ─────────────────────────────────────────────── */}
                <section className="profile__card">
                    <h3 className="profile__card-title">Password</h3>
                    <p className="profile__card-lead">
                        Enter your current password to set a new one. Changing it signs you out everywhere,
                        and you sign back in with the new password.
                    </p>

                    <form className="profile__form" onSubmit={handlePasswordSubmit}>
                        <label htmlFor="profile-current">Current password</label>
                        <input
                            id="profile-current"
                            type={passwordType}
                            value={currentPassword}
                            onChange={(event) => setCurrentPassword(event.target.value)}
                            autoComplete="current-password"
                            disabled={passwordState.saving}
                        />

                        <label htmlFor="profile-new">New password</label>
                        <input
                            id="profile-new"
                            type={passwordType}
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            autoComplete="new-password"
                            disabled={passwordState.saving}
                        />

                        <label htmlFor="profile-confirm">Confirm new password</label>
                        <input
                            id="profile-confirm"
                            type={passwordType}
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            autoComplete="new-password"
                            disabled={passwordState.saving}
                        />

                        <label className="profile__check" htmlFor="profile-show">
                            <input
                                id="profile-show"
                                type="checkbox"
                                checked={showPasswords}
                                onChange={(event) => setShowPasswords(event.target.checked)}
                            />
                            Show passwords
                        </label>

                        <p className="profile__hint">At least {PASSWORD_MIN} characters.</p>

                        {passwordState.error && <Alert tone="error">{passwordState.error}</Alert>}
                        {passwordState.ok && <Alert tone="ok">{passwordState.ok}</Alert>}

                        <div className="profile__actions">
                            <button type="submit" disabled={!canSavePassword}>
                                {passwordState.saving ? 'Updating…' : 'Update password'}
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </div>
    );
};

export default ProfilePage;
