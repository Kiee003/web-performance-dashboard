import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './components/Dashboard';
import LoginPage from './components/LoginPage';
import { PantauLogo } from './components/Logo';

const AppContent = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="boot" role="status" aria-live="polite">
                <PantauLogo size={56} shadow={false} />
                <p className="boot__label">Loading Pantau<span className="boot__dots" aria-hidden="true" /></p>
            </div>
        );
    }

    return user ? <Dashboard /> : <LoginPage />;
};

const App = () => {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
};

export default App;
