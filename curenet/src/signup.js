import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Signup.css';

function Signup() {
  const [values, setValues] = useState({
    email: "",
    username: "",
    gender: "",
    age: "",
    address: "",
    password: ""
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Validation function
  const validateForm = () => {
    let tempErrors = {};
    let isValid = true;

    if (!values.email) {
      tempErrors.email = "Email is required";
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(values.email)) {
      tempErrors.email = "Email is invalid";
      isValid = false;
    }

    if (!values.username.trim()) {
      tempErrors.username = "Name is required";
      isValid = false;
    }

    if (!values.gender) {
      tempErrors.gender = "Gender is required";
      isValid = false;
    }

    if (!values.age) {
      tempErrors.age = "Age is required";
      isValid = false;
    }

    if (!values.address.trim()) {
      tempErrors.address = "Address is required";
      isValid = false;
    }

    if (!values.password) {
      tempErrors.password = "Password is required";
      isValid = false;
    } else if (values.password.length < 6) {
      tempErrors.password = "Password must be at least 6 characters";
      isValid = false;
    }

    setErrors(tempErrors);
    return isValid;
  };

  const handleInput = (event) => {
    const { name, value } = event.target;
    console.log(`Input changed - ${name}: ${value}`); // Debug log
    setValues(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    console.log('Form submission started'); // Debug log

    if (validateForm()) {
      setLoading(true);
      console.log('Form validated successfully'); // Debug log

      try {
        const patientData = {
          p_name: values.username,
          p_email: values.email,
          p_age: parseInt(values.age),
          p_gender: values.gender,
          p_password: values.password,
          p_address: values.address
        };

        console.log('Sending data to backend:', patientData); // Debug log

        const res = await axios.post("http://localhost:8801/signup", patientData, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        console.log('Response received:', res.data); // Debug log

        if (res.data.success) {
          console.log('Signup successful, navigating to login'); // Debug log
          navigate('/login');
        } else {
          throw new Error(res.data.message || 'Registration failed');
        }
      } catch (err) {
        console.error('Signup error:', err); // Debug log
        setErrors(prev => ({
          ...prev,
          submit: err.response?.data?.message || "Registration failed. Please try again."
        }));
      } finally {
        setLoading(false);
      }
    } else {
      console.log('Form validation failed', errors); // Debug log
    }
  };

  // Debug log for render
  console.log('Current form values:', values);
  console.log('Current errors:', errors);

  return (
    <div className="signup-container">
      <div className="signup-panel">
      <div className="left-panel">
          <div className="welcome-content">
            <h1>Join CureNet</h1>
            <p>Your journey to better healthcare starts here</p>
            
            <div className="feature-list">
              <div className="feature-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 8v4m0 4h.01"/>
                </svg>
                <span>Easy Appointment Booking</span>
              </div>
              <div className="feature-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 4v16m-8-8h16"/>
                </svg>
                <span>Virtual Consultations</span>
              </div>
              <div className="feature-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>Secure Health Records</span>
              </div>
            </div>
          </div>
          </div>
        <div className="right-panel">
          <div className="signup-form-container">
            <div className="logo">
              <h2>CureNet</h2>
              <p>Patient Registration</p>
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
              {/* Form fields remain the same but with added debug onBlur */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={values.email}
                    onChange={handleInput}
                    onBlur={() => console.log('Email field blurred:', values.email)}
                    placeholder="Enter your email"
                    className={errors.email ? 'error' : ''}
                  />
                  {errors.email && <span className="error-text">{errors.email}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="username">Full Name</label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={values.username}
                    onChange={handleInput}
                    onBlur={() => console.log('Username field blurred:', values.username)}
                    placeholder="Enter your full name"
                    className={errors.username ? 'error' : ''}
                  />
                  {errors.username && <span className="error-text">{errors.username}</span>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Gender</label>
                  <div className="radio-group">
                    {['Male', 'Female', 'Other'].map((option) => (
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
                  {errors.gender && <span className="error-text">{errors.gender}</span>}
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
                    {Array.from({ length: 100 }, (_, i) => i + 1).map(age => (
                      <option key={age} value={age}>{age}</option>
                    ))}
                  </select>
                  {errors.age && <span className="error-text">{errors.age}</span>}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="address">Address</label>
                <textarea
                  id="address"
                  name="address"
                  value={values.address}
                  onChange={handleInput}
                  placeholder="Enter your address"
                  className={errors.address ? 'error' : ''}
                />
                {errors.address && <span className="error-text">{errors.address}</span>}
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
                {errors.password && <span className="error-text">{errors.password}</span>}
              </div>

              <button 
                type="submit" 
                className={`submit-button ${loading ? 'loading' : ''}`}
                disabled={loading}
                onClick={() => console.log('Submit button clicked')} // Debug log
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    <span>Creating Account...</span>
                  </>
                ) : 'Create Account'}
              </button>

              {/* Form footer remains the same */}
              <div className="form-footer">
                {/* ... existing footer code ... */}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;