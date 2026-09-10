import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Validation from './SignupValidation';
import axios from 'axios';
import './DocSignup.css';

function Docsignup() {
    const [values, setValues] = useState({
        email: "",
        username: "",
        gender: "",
        age: "",
        address: "",
        speciality: "",
        password: ""
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const navigate = useNavigate();

    const handleInput = (event) => {
        const { name, value } = event.target;
        setValues(prev => ({
            ...prev,
            [name]: value
        }));
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
                await axios.post("http://localhost:8801/docsignup", values);
                navigate('/doclogin');
            } catch (err) {
                setErrors({ submit: err.response?.data?.message || "Registration failed" });
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="doc-signup-container">
            <div className="signup-panel">
                <div className="left-panel">
                    <div className="welcome-content">
                        <h1>Join Our Medical Team</h1>
                        <p>Become part of CureNet's growing network of healthcare professionals</p>

                        <div className="feature-list">
                            <div className="feature-item">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                                </svg>
                                <span>Secure Patient Management</span>
                            </div>
                            <div className="feature-item">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                                <span>Flexible Scheduling</span>
                            </div>
                            <div className="feature-item">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                                </svg>
                                <span>Telemedicine Support</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="right-panel">
                    <div className="signup-form-container">
                        <div className="logo">
                            <h2>CureNet</h2>
                            <p>Doctor Registration</p>
                        </div>

                        {errors.submit && (
                            <div className="error-alert">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M12 8v4m0 4h.01"/>
                                </svg>
                                <span>{errors.submit}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="signup-form">
                            <div className="form-group">
                                <label htmlFor="email">Email Address</label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={values.email}
                                    onChange={handleInput}
                                    placeholder="Enter your professional email"
                                    className={errors.email ? 'error' : ''}
                                />
                                {errors.email && <div className="error-text">{errors.email}</div>}
                            </div>

                            <div className="form-group">
                                <label htmlFor="username">Full Name</label>
                                <input
                                    type="text"
                                    id="username"
                                    name="username"
                                    value={values.username}
                                    onChange={handleInput}
                                    placeholder="Dr. Full Name"
                                    className={errors.username ? 'error' : ''}
                                />
                                {errors.username && <div className="error-text">{errors.username}</div>}
                            </div>

                            <div className="form-group">
                                <label>Gender</label>
                                <div className="radio-group">
                                    {['Male', 'Female', 'Other'].map(option => (
                                        <label key={option} className="radio-label">
                                            <input
                                                type="radio"
                                                name="gender"
                                                value={option}
                                                checked={values.gender === option}
                                                onChange={handleInput}
                                            />
                                            <span>{option}</span>
                                        </label>
                                    ))}
                                </div>
                                {errors.gender && <div className="error-text">{errors.gender}</div>}
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="age">Age</label>
                                    <select
                                        id="age"
                                        name="age"
                                        value={values.age}
                                        onChange={handleInput}
                                        className={errors.age ? 'error' : ''}
                                    >
                                        <option value="">Select Age</option>
                                        {Array.from({ length: 53 }, (_, i) => i + 18).map(age => (
                                            <option key={age} value={age}>{age}</option>
                                        ))}
                                    </select>
                                    {errors.age && <div className="error-text">{errors.age}</div>}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="speciality">Speciality</label>
                                    <select
                                        id="speciality"
                                        name="speciality"
                                        value={values.speciality}
                                        onChange={handleInput}
                                        className={errors.speciality ? 'error' : ''}
                                    >
                                        <option value="">Select Speciality</option>
                                        {[
                                            'Allergist', 'Cardiologist', 'Dermatologist', 
                                            'Endocrinologist', 'Gastroenterologist', 'Gynecologist',
                                            'Hepatologist', 'Internal Medicine', 'Neurologist',
                                            'Osteopathic', 'Otolaryngologist', 'Pediatrician',
                                            'Phlebologist', 'Pulmonologist', 'Rheumatologist',
                                            'Tuberculosis'
                                        ].map(spec => (
                                            <option key={spec} value={spec}>{spec}</option>
                                        ))}
                                    </select>
                                    {errors.speciality && <div className="error-text">{errors.speciality}</div>}
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="address">Professional Address</label>
                                <textarea
                                    id="address"
                                    name="address"
                                    value={values.address}
                                    onChange={handleInput}
                                    placeholder="Enter your clinic/hospital address"
                                    className={errors.address ? 'error' : ''}
                                />
                                {errors.address && <div className="error-text">{errors.address}</div>}
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">Password</label>
                                <input
                                    type="password"
                                    id="password"
                                    name="password"
                                    value={values.password}
                                    onChange={handleInput}
                                    placeholder="Create a secure password"
                                    className={errors.password ? 'error' : ''}
                                />
                                {errors.password && <div className="error-text">{errors.password}</div>}
                            </div>

                            <button 
                                type="submit" 
                                className={`submit-button ${loading ? 'loading' : ''}`}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <span className="spinner"></span>
                                        <span>Creating Account...</span>
                                    </>
                                ) : 'Create Doctor Account'}
                            </button>

                            <div className="form-footer">
                                <p className="terms">
                                    By registering, you agree to our 
                                    <Link to="/terms">Terms of Service</Link> and
                                    <Link to="/privacy">Privacy Policy</Link>
                                </p>

                                <div className="login-prompt">
                                    <span>Already registered?</span>
                                    <Link to="/doclogin">Login to Your Account</Link>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Docsignup;