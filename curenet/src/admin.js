import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './admin.css';
import { FaUserShield, FaLock } from 'react-icons/fa';

function Admin() {
    // Demo-only gate. React environment variables are bundled into client code,
    // so this must never be treated as production authentication.
    const adminCredentials = {
        email: process.env.REACT_APP_DEMO_ADMIN_EMAIL,
        password: process.env.REACT_APP_DEMO_ADMIN_PASSWORD
    };

    const [values, setValues] = useState({
        email: '',
        password: ''
    });

    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleInput = (event) => {
        setValues(prev => ({ ...prev, [event.target.name]: event.target.value }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        if (!adminCredentials.email || !adminCredentials.password) {
            setError("Demo admin access is not configured.");
        } else if (values.email === adminCredentials.email && values.password === adminCredentials.password) {
            navigate("/admindashboard");
        } else {
            setError("Access denied. Invalid credentials.");
        }
    };

    return (
        <div className="root-auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <FaUserShield className="shield-icon" />
                    <h1 className="system-title">CureNet</h1>
                    <h3 className="auth-subtitle">Admin Login</h3>
                </div>
                
                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="credential-group">
                        <label htmlFor="email" className="input-label">
                            <FaUserShield className="field-icon" />
                            Email
                        </label>
                        <input
                            type="email"
                            placeholder="Enter Admin Email"
                            name="email"
                            value={values.email}
                            onChange={handleInput}
                            className="auth-input"
                            required
                        />
                    </div>

                    <div className="credential-group">
                        <label htmlFor="password" className="input-label">
                            <FaLock className="field-icon" />
                            Password
                        </label>
                        <input
                            type="password"
                            placeholder="Enter Admin Password"
                            name="password"
                            value={values.password}
                            onChange={handleInput}
                            className="auth-input"
                            required
                        />
                    </div>

                    {error && <div className="auth-error">{error}</div>}
                    
                    <button type="submit" className="auth-button">
                        Access Admin Panel
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Admin;
