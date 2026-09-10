import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Selection.css';

function Selection() {
    const navigate = useNavigate();

    const handlePatientClick = () => {
        navigate('/login');
    };

    const handleDoctorClick = () => {
        navigate('/doclogin');
    };

    const handleAdminClick = () => {
        navigate('/admin');
    };

    return (
        <div className="selection-container">
            <div className="selection-content">
                <div className="logo-section">
                    <h1>CureNet</h1>
                    <p className="tagline">Choose your role to continue</p>
                </div>

                <div className="cards-container">
                    <div className="role-card" onClick={handlePatientClick}>
                        <div className="role-icon patient-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                        </div>
                        <h2>Patient</h2>
                        <p>Schedule appointments and consult with doctors</p>
                    </div>

                    <div className="role-card" onClick={handleDoctorClick}>
                        <div className="role-icon doctor-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M4.8 19.2h14.4M4.8 4.8h14.4M12 4.8v14.4M7.2 9.6h9.6" />
                            </svg>
                        </div>
                        <h2>Doctor</h2>
                        <p>Manage appointments and treat patients</p>
                    </div>

                    <div className="role-card" onClick={handleAdminClick}>
                        <div className="role-icon admin-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 4.8v14.4M4.8 12h14.4M8.4 4.8h7.2M8.4 19.2h7.2" />
                            </svg>
                        </div>
                        <h2>Admin</h2>
                        <p>System administration and management</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Selection;