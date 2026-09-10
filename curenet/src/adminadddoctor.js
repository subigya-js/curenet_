import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Validation from './SignupValidation';
import './AdminAddDoctor.css'; // Assume some custom styles for the page

function Adminadddoctor() {
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
        // Assuming you have a Validation function to validate the inputs
        const validationErrors = Validation(values); 
        setErrors(validationErrors);

        if (Object.keys(validationErrors).length === 0) {
            setLoading(true);
            try {
                await axios.post("http://localhost:8801/addDoctor", values);
                navigate('/adminDashboard'); // Redirect to the admin dashboard after adding the doctor
            } catch (err) {
                setErrors({ submit: err.response?.data?.message || "Error adding doctor" });
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="admin-add-doctor-container">
            <div className="admin-header">
                <h1>Add New Doctor</h1>
            </div>
            <div className="form-container">
                <form onSubmit={handleSubmit} className="doctor-form">
                    {errors.submit && (
                        <div className="error-alert">
                            <span>{errors.submit}</span>
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="email">Email Address</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={values.email}
                            onChange={handleInput}
                            className={errors.email ? 'error' : ''}
                            placeholder="Enter doctor email"
                        />
                        {errors.email && <div className="error-text">{errors.email}</div>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="username">Doctor's Full Name</label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            value={values.username}
                            onChange={handleInput}
                            className={errors.username ? 'error' : ''}
                            placeholder="Enter doctor's full name"
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

                    <div className="form-group">
                        <label htmlFor="address">Professional Address</label>
                        <textarea
                            id="address"
                            name="address"
                            value={values.address}
                            onChange={handleInput}
                            className={errors.address ? 'error' : ''}
                            placeholder="Enter clinic or hospital address"
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
                            className={errors.password ? 'error' : ''}
                            placeholder="Create a secure password"
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
                                <span>Adding Doctor...</span>
                            </>
                        ) : 'Add Doctor'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Adminadddoctor;
