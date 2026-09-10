import React, { useState, useEffect } from 'react';
import './admindash.css';
import { FaUserMd, FaUsers, FaCalendarAlt, FaSignOutAlt, FaTable } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Admindashboard() {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        doctorCount: 6,
        patientCount: 8,
        appointmentCount: 4
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchDashboardStats();
    }, []);

    const fetchDashboardStats = async () => {
        try {
            setLoading(true);
            const response = await axios.get('http://localhost:8801/dashboard-stats');
            if (response.data.success) {
                setStats(response.data.data);
                setError(null);
            }
        } catch (err) {
            console.error('Dashboard stats error:', err);
            setError('Failed to fetch dashboard statistics');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-dashboard-container">
            <div className="sidebar">
                <div className="sidebar-header">
                    <h2>Admin Panel</h2>
                </div>
                
                <div className="sidebar-menu">
                    <button className="menu-item" onClick={() => navigate('/adminadddoctor')}>
                        <FaUserMd /> Add New Doctor
                    </button>
                    
                    <button className="menu-item" onClick={() => navigate('/viewtables')}>
                        <FaTable /> View Database
                    </button>
                    
                    <button className="menu-item logout" onClick={() => navigate('/')}>
                        <FaSignOutAlt /> Logout
                    </button>
                </div>
            </div>

            <div className="main-content">
                <h1>Welcome to Admin Dashboard</h1>

                <div className="content-wrapper">
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon">
                                <FaUserMd />
                            </div>
                            <div className="stat-text">
                                <h3>Total Doctors</h3>
                                <div className="stat-number">{stats.doctorCount}</div>
                                <span>Registered Doctors</span>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon">
                                <FaUsers />
                            </div>
                            <div className="stat-text">
                                <h3>Total Patients</h3>
                                <div className="stat-number">{stats.patientCount}</div>
                                <span>Registered Patients</span>
                            </div>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon">
                                <FaCalendarAlt />
                            </div>
                            <div className="stat-text">
                                <h3>Active Appointments</h3>
                                <div className="stat-number">{stats.appointmentCount}</div>
                                <span>Pending Consultations</span>
                            </div>
                        </div>
                    </div>

                    <div className="action-buttons">
                        <button className="action-btn" onClick={() => navigate('/adminadddoctor')}>
                            Add New Doctor
                        </button>
                        <button className="action-btn" onClick={() => navigate('/viewtables')}>
                            View Database
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Admindashboard;