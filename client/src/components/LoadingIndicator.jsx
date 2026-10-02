import React from 'react';
import './LoadingIndicator.css';

const LoadingIndicator = ({ message }) => {
    return (
        <div className="loading-container">
            <div className="loading-spinner"></div>
            <p className="loading-message">{message || 'Running performance audit...'}</p>
            <p className="loading-note">Complex websites may take 30-60 seconds</p>
        </div>
    );
};

export default LoadingIndicator;