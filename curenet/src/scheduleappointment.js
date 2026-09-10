import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ScheduleAppointment.css';

function ScheduleAppointment() {
    const [values, setValues] = useState({
        app_date: "",
        app_time: "",
        symptoms: "",
        concerns: "",
        p_email: "",
        p_name: "",
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
                const res = await axios.post("http://localhost:8801/schedule", values);
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
        if (!values.symptoms?.trim()) errors.symptoms = "Please describe your symptoms";
        if (!values.concerns?.trim()) errors.concerns = "Please describe your concerns";
        if (!values.p_name?.trim()) errors.p_name = "Name is required";
        if (!values.p_email?.trim()) errors.p_email = "Email is required";
        return errors;
    };

    return (
        <div className="schedule-container">
            <div className="schedule-panel">
                <div className="left-panel">
                    <div className="info-content">
                        <h1>Schedule an Appointment</h1>
                        <p>Book your consultation with our healthcare professionals</p>

                        <div className="appointment-info">
                            <div className="info-item">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                                <div className="info-text">
                                    <h3>Convenient Scheduling</h3>
                                    <p>Choose a time that works best for you</p>
                                </div>
                            </div>

                            <div className="info-item">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                                </svg>
                                <div className="info-text">
                                    <h3>Expert Care</h3>
                                    <p>Consultation with qualified professionals</p>
                                </div>
                            </div>

                            <div className="info-item">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"/>
                                </svg>
                                <div className="info-text">
                                    <h3>Detailed Consultation</h3>
                                    <p>Thorough discussion of your health concerns</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="right-panel">
                    <div className="form-container">
                        <div className="form-header">
                            <h2>Book Your Appointment</h2>
                            <p>Please fill in your details below</p>
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

                        <form onSubmit={handleSubmit} className="appointment-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="p_name">Full Name</label>
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
                                    <label htmlFor="p_email">Email Address</label>
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
                                    <label htmlFor="app_date">Preferred Date</label>
                                    <input
                                        type="date"
                                        id="app_date"
                                        name="app_date"
                                        value={values.app_date}
                                        onChange={handleInput}
                                        className={errors.app_date ? 'error' : ''}
                                    />
                                    {errors.app_date && <div className="error-text">{errors.app_date}</div>}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="app_time">Preferred Time</label>
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

                            <div className="form-group">
                                <label htmlFor="symptoms">Symptoms</label>
                                <textarea
                                    id="symptoms"
                                    name="symptoms"
                                    value={values.symptoms}
                                    onChange={handleInput}
                                    placeholder="Please describe your symptoms in detail"
                                    className={errors.symptoms ? 'error' : ''}
                                    rows="3"
                                />
                                {errors.symptoms && <div className="error-text">{errors.symptoms}</div>}
                            </div>

                            <div className="form-group">
                                <label htmlFor="concerns">Additional Concerns</label>
                                <textarea
                                    id="concerns"
                                    name="concerns"
                                    value={values.concerns}
                                    onChange={handleInput}
                                    placeholder="Any other concerns you'd like to discuss"
                                    className={errors.concerns ? 'error' : ''}
                                    rows="3"
                                />
                                {errors.concerns && <div className="error-text">{errors.concerns}</div>}
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
                                    ) : 'Schedule Appointment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ScheduleAppointment;