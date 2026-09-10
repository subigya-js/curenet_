import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css'; // Use the same CSS as the patient dashboard

function Docdashboard() {
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${day}-${month}-${year}`;
    };

    useEffect(() => {
        fetchAppointments();
    }, []);

    const fetchAppointments = async () => {
        try {
            const response = await fetch('http://localhost:8801/appointmentsdoc');
            const data = await response.json();

            if (data.success) {
                setAppointments(data.data);
            } else {
                setError('Failed to fetch appointments');
            }
        } catch (error) {
            console.error('Error:', error);
            setError('Failed to fetch appointments');
        } finally {
            setLoading(false);
        }
    };

    const navigationCards = [
        {
            title: 'Text Appointments',
            description: 'View all text-based appointments',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            action: () => navigate('/viewappointment'),
        },
        {
            title: 'Virtual Appointments',
            description: 'View all video-based appointments',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            ),
            action: () => navigate('/viewvirtualappointment'),
        },
        {
            title: 'Patient History',
            description: 'Access patient consultation history',
            icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
            ),
            action: () => navigate('/viewhistory'),
        },
    ];

    return (
        <div className="dashboard-container">
            <nav className="dashboard-nav">
                <div className="nav-brand">
                    <h2>Doctor Dashboard</h2>
                </div>
                <button className="logout-button" onClick={() => navigate('/')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                </button>
            </nav>

            <div className="dashboard-content">
                <header className="dashboard-header">
                    <div className="welcome-section">
                        <h1>Welcome, Doctor!</h1>
                        <p>Manage your appointments and patient history efficiently</p>
                    </div>
                </header>

                <section className="quick-actions">
                    <div className="section-header">
                        <h2>Quick Actions</h2>
                    </div>
                    <div className="cards-grid">
                        {navigationCards.map((card, index) => (
                            <div key={index} className="action-card" onClick={card.action}>
                                <div className="card-icon">{card.icon}</div>
                                <h3>{card.title}</h3>
                                <p>{card.description}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="appointments-section">
                    <div className="section-header">
                        <h2>Scheduled Appointments</h2>
                    </div>

                    {loading ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>Loading appointments...</p>
                        </div>
                    ) : error ? (
                        <div className="error-state">
                            <p>{error}</p>
                        </div>
                    ) : appointments.length === 0 ? (
                        <div className="empty-state">
                            <p>No appointments scheduled</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="appointments-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Patient Name</th>
                                        <th>Email</th>
                                        <th>Date</th>
                                        <th>Time</th>
                                        <th>Type</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {appointments.map((appointment) => (
                                        <tr key={appointment.a_id}>
                                            <td>#{appointment.a_id}</td>
                                            <td>{appointment.p_name}</td>
                                            <td>{appointment.p_email}</td>
                                            <td>{formatDate(appointment.app_date)}</td>
                                            <td>{appointment.app_time}</td>
                                            <td>
                                                <span className={`appointment-type ${appointment.type}`}>
                                                    {appointment.type}
                                                </span>
                                            </td>
                                            <td>{appointment.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}

export default Docdashboard;
