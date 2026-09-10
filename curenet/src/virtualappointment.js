import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './VirtualAppointment.css';
import { FaVideo, FaHome, FaLock, FaCalendar, FaClock, FaUser, FaEnvelope, FaNotesMedical, FaCommentMedical } from 'react-icons/fa';

function VirtualAppointment() {
    const [values, setValues] = useState({
        app_date: "",
        app_time: "",
        p_name: "",
        p_email: "",
        symptoms: "",
        concerns: ""
    });

    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const navigate = useNavigate();

    const handleInput = (event) => {
        const { name, value } = event.target;
        setValues(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: "" }));
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const validationErrors = validateForm(values);
        setErrors(validationErrors);

        if (Object.keys(validationErrors).length === 0) {
            setLoading(true);
            try {
                const res = await axios.post("http://localhost:8801/schedulevirtual", values);
                if (res.data.success) {
                    navigate('/dashboard');
                } else {
                    setErrors({ submit: res.data.message || "Failed to schedule appointment" });
                }
            } catch (err) {
                setErrors({ submit: err.response?.data.message || "An error occurred" });
            } finally {
                setLoading(false);
            }
        }
    };

    const validateForm = (values) => {
        const errors = {};
        if (!values.app_date) errors.app_date = "Date is required";
        if (!values.app_time) errors.app_time = "Time is required";
        if (!values.p_name?.trim()) errors.p_name = "Name is required";
        if (!values.p_email?.trim()) errors.p_email = "Email is required";
        else if (!/\S+@\S+\.\S+/.test(values.p_email)) {
            errors.p_email = "Please enter a valid email address";
        }
        return errors;
    };

    return (
        <div className="virtual-appointment-container">
            <div className="appointment-panel">
                <div className="left-panel">
                    <div className="info-content">
                        <h1>Virtual Consultation</h1>
                        <p>Connect with our healthcare professionals from the comfort of your home</p>

                        <div className="feature-list">
                            <div className="feature-item">
                                <FaVideo className="feature-icon" />
                                <div className="feature-text">
                                    <h3>Video Consultation</h3>
                                    <p>Face-to-face interaction with doctors</p>
                                </div>
                            </div>

                            <div className="feature-item">
                                <FaHome className="feature-icon" />
                                <div className="feature-text">
                                    <h3>Home Comfort</h3>
                                    <p>No travel or waiting room required</p>
                                </div>
                            </div>

                            <div className="feature-item">
                                <FaLock className="feature-icon" />
                                <div className="feature-text">
                                    <h3>Secure Platform</h3>
                                    <p>Private and confidential consultation</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="right-panel">
                    <div className="form-container">
                        <div className="form-header">
                            <h2>Schedule Virtual Consultation</h2>
                            <p>Book your online appointment</p>
                        </div>

                        {errors.submit && (
                            <div className="error-alert">
                                <FaEnvelope />
                                <span>{errors.submit}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="virtual-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="p_name">
                                        <FaUser className="input-icon" />
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        id="p_name"
                                        name="p_name"
                                        value={values.p_name}
                                        onChange={handleInput}
                                        placeholder="Enter your full name"
                                        className={errors.p_name ? 'error' : ''}
                                    />
                                    {errors.p_name && <div className="error-text">{errors.p_name}</div>}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="p_email">
                                        <FaEnvelope className="input-icon" />
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        id="p_email"
                                        name="p_email"
                                        value={values.p_email}
                                        onChange={handleInput}
                                        placeholder="Enter your email"
                                        className={errors.p_email ? 'error' : ''}
                                    />
                                    {errors.p_email && <div className="error-text">{errors.p_email}</div>}
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="app_date">
                                        <FaCalendar className="input-icon" />
                                        Consultation Date
                                    </label>
                                    <input
                                        type="date"
                                        id="app_date"
                                        name="app_date"
                                        value={values.app_date}
                                        onChange={handleInput}
                                        min={new Date().toISOString().split('T')[0]}
                                        className={errors.app_date ? 'error' : ''}
                                    />
                                    {errors.app_date && <div className="error-text">{errors.app_date}</div>}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="app_time">
                                        <FaClock className="input-icon" />
                                        Consultation Time
                                    </label>
                                    <input
                                        type="time"
                                        id="app_time"
                                        name="app_time"
                                        value={values.app_time}
                                        onChange={handleInput}
                                        className={errors.app_time ? 'error' : ''}
                                    />
                                    {errors.app_time && <div className="error-text">{errors.app_time}</div>}
                                </div>
                            </div>

                            <div className="form-row full-width">
                                <div className="form-group">
                                    <label htmlFor="symptoms">
                                        <FaNotesMedical className="input-icon" />
                                        Symptoms (Optional)
                                    </label>
                                    <textarea
                                        id="symptoms"
                                        name="symptoms"
                                        value={values.symptoms}
                                        onChange={handleInput}
                                        placeholder="Please describe your symptoms"
                                        className="textarea-field"
                                        rows="3"
                                    />
                                </div>
                            </div>

                            <div className="form-row full-width">
                                <div className="form-group">
                                    <label htmlFor="concerns">
                                        <FaCommentMedical className="input-icon" />
                                        Concerns (Optional)
                                    </label>
                                    <textarea
                                        id="concerns"
                                        name="concerns"
                                        value={values.concerns}
                                        onChange={handleInput}
                                        placeholder="Any specific concerns you'd like to discuss?"
                                        className="textarea-field"
                                        rows="3"
                                    />
                                </div>
                            </div>

                            <div className="form-actions">
                                <button 
                                    type="button" 
                                    onClick={() => navigate('/dashboard')}
                                    className="cancel-button"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className={`submit-button ${loading ? 'loading' : ''}`}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <span className="spinner"></span>
                                            <span>Scheduling...</span>
                                        </>
                                    ) : 'Schedule Virtual Consultation'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default VirtualAppointment;