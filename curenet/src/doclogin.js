import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Validation from './LoginValidation';
import axios from 'axios';
import './DocLogin.css';

function Doclogin() {
    const [values, setValues] = useState({
        email: "",
        password: ""
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleInput = (event) => {
        const { name, value } = event.target;
        setValues(prev => ({ ...prev, [name]: value }));
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: "" }));
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const validationErrors = Validation(values);
        setErrors(validationErrors);

        if (Object.keys(validationErrors).length === 0) {
            setLoading(true);
            try {
                const res = await axios.post("http://localhost:8801/doclogin", values);
                if (res.data.success) {
                    navigate("/docdashboard");
                } else {
                    setErrors({ auth: "Invalid credentials. Please try again." });
                }
            } catch (err) {
                console.error("Error during login:", err);
                setErrors({ auth: "An error occurred. Please try again." });
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="doc-login-container">
            <div className="login-panel">
                <div className="left-panel">
                    <div className="welcome-content">
                        <h1>Welcome Back, Doctor</h1>
                        <p>Access your patient records, appointments, and more.</p>
                        <div className="feature-list">
                            <div className="feature-item">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 4v16m-8-8h16"/>
                                </svg>
                                <span>Manage Appointments</span>
                            </div>
                            <div className="feature-item">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                </svg>
                                <span>Patient Records</span>
                            </div>
                            <div className="feature-item">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                </svg>
                                <span>Virtual Consultations</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="right-panel">
                    <div className="login-form-container">
                        <div className="logo">
                            <h2>CureNet</h2>
                            <p>Doctor Portal</p>
                        </div>

                        {errors.auth && (
                            <div className="error-alert">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M12 8v4m0 4h.01"/>
                                </svg>
                                <span>{errors.auth}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="login-form">
                            <div className="form-group">
                                <label htmlFor="email">Email Address</label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={values.email}
                                    onChange={handleInput}
                                    placeholder="Enter your email"
                                    className={errors.email ? 'error' : ''}
                                />
                                {errors.email && <span className="error-text">{errors.email}</span>}
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">Password</label>
                                <input
                                    type="password"
                                    id="password"
                                    name="password"
                                    value={values.password}
                                    onChange={handleInput}
                                    placeholder="Enter your password"
                                    className={errors.password ? 'error' : ''}
                                />
                                {errors.password && <span className="error-text">{errors.password}</span>}
                            </div>

                            <button 
                                type="submit" 
                                className={`submit-button ${loading ? 'loading' : ''}`}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <span className="spinner"></span>
                                        <span>Logging in...</span>
                                    </>
                                ) : 'Login to Dashboard'}
                            </button>

                            <div className="form-footer">
                                <p className="terms">
                                    By logging in, you agree to our 
                                    <Link to="/terms">Terms of Service</Link> and
                                    <Link to="/privacy">Privacy Policy</Link>
                                </p>

                                <div className="signup-prompt">
                                    <span>New to CureNet?</span>
                                    <Link to="/docsignup">Create an Account</Link>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Doclogin;