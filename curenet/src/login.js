import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Validation from './LoginValidation';
import axios from 'axios';
import './Login.css';

function Login() {
    const [values, setValues] = useState({
        email: "",
        password: ""
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleInput = (event) => {
        setValues(prev => ({ ...prev, [event.target.name]: event.target.value }));
        if (errors[event.target.name]) {
            setErrors(prev => ({ ...prev, [event.target.name]: "" }));
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const validationErrors = Validation(values);
        setErrors(validationErrors);

        if (Object.keys(validationErrors).length === 0) {
            setLoading(true);
            try {
                const res = await axios.post("http://localhost:8801/login", values);
                if (res.data.success) {
                    navigate("/dashboard");
                } else {
                    setErrors({ auth: "Invalid email or password" });
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
        <div className="login-container">
            <div className="login-panel">
                <div className="left-panel">
                    <div className="welcome-content">
                        <h1>Welcome to CureNet</h1>
                        <p>Your Health, Our Priority</p>
                        
                        <div className="feature-list">
                            <div className="feature-item">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                </svg>
                                <span>Easy Appointment Booking</span>
                            </div>
                            <div className="feature-item">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                </svg>
                                <span>Virtual Consultations</span>
                            </div>
                            <div className="feature-item">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                                </svg>
                                <span>24/7 Health Support</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="right-panel">
                    <div className="login-form-container">
                        <div className="logo">
                            <h2>CureNet</h2>
                            <p>Patient Portal</p>
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
                                <div className="input-group">
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        value={values.email}
                                        onChange={handleInput}
                                        placeholder="Enter your email"
                                        className={errors.email ? 'error' : ''}
                                    />
                                    {errors.email && <div className="error-text">{errors.email}</div>}
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">Password</label>
                                <div className="input-group">
                                    <input
                                        type="password"
                                        id="password"
                                        name="password"
                                        value={values.password}
                                        onChange={handleInput}
                                        placeholder="Enter your password"
                                        className={errors.password ? 'error' : ''}
                                    />
                                    {errors.password && <div className="error-text">{errors.password}</div>}
                                </div>
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
                                ) : 'Login to Your Account'}
                            </button>

                            <div className="form-footer">
                                <p className="terms">
                                    By logging in, you agree to our 
                                    <Link to="/terms">Terms of Service</Link> and
                                    <Link to="/privacy">Privacy Policy</Link>
                                </p>

                                <div className="signup-prompt">
                                    <span>Don't have an account?</span>
                                    <Link to="/signup">Create Account</Link>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;