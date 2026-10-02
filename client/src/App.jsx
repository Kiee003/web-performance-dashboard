import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './components/Dashboard';
import LoginPage from './components/LoginPage';
import { PantauLogo } from './components/Logo';

const AppContent = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }}>
                <div style={{ textAlign: 'center', color: 'white' }}>
                    <PantauLogo size={64} shadow={false} />
                    <p style={{ fontSize: '1.1rem', marginTop: '14px' }}>Loading Pantau...</p>
                </div>
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