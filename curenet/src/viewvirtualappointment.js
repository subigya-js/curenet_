import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import './viewvirtualappointment.css';

const ViewVirtualAppointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8801/appointmentsvirtual');
      if (!response.ok) {
        throw new Error('Failed to fetch appointments');
      }
      const data = await response.json();
      setAppointments(data);
    } catch (err) {
      setError('Error fetching appointments');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (a_id, status) => {
    try {
      const response = await fetch(`http://localhost:8801/appointments/${a_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error('Failed to update appointment status');
      }

      await fetchAppointments();
    } catch (err) {
      setError(`Error updating appointment: ${err.message}`);
      console.error('Error:', err);
    }
  };

  const handleDiagnose = async (a_id) => {
    try {
      // First, make the request to update status and create history record
      const response = await fetch(`http://localhost:8801/appointments/${a_id}/diagnose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to update appointment status and history');
      }

      // If successful, open the diagnosis window
      window.open('http://localhost:3001', '_blank');
      
      // Refresh the appointments list
      await fetchAppointments();
    } catch (err) {
      setError(`Error processing diagnosis: ${err.message}`);
      console.error('Error:', err);
    }
  };

  const handleCancel = async (appointmentId) => {
    try {
      const response = await fetch(`http://localhost:8801/appointments/${appointmentId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
  
      if (!response.ok) {
        throw new Error('Failed to cancel appointment');
      }
  
      const data = await response.json();
      // Handle successful cancellation (e.g., show success message, update UI)
      
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      // Handle error (e.g., show error message)
    }
  };

  const formatDate = (date) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(date).toLocaleDateString(undefined, options);
  };

  const formatTime = (time) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading virtual appointments...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <div className="nav-left">
          <h1>Virtual Appointments</h1>
        </div>
        <div className="nav-right">
          <button className="back-button" onClick={() => navigate(-1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
        </div>
      </nav>

      <div className="dashboard-content">
        {error && (
          <div className="error-banner">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4m0 4h.01" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="appointments-grid">
          {appointments.length === 0 ? (
            <div className="no-appointments">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3>No Appointments Found</h3>
              <p>There are no virtual appointments scheduled at the moment.</p>
            </div>
          ) : (
            appointments.map((appointment) => (
              <div key={appointment.a_id} className="appointment-card">
                <div className="appointment-header">
                  <div className="appointment-id">#{appointment.a_id}</div>
                  <div className={`appointment-status ${appointment.status}`}>
                    {appointment.status || 'Pending'}
                  </div>
                </div>

                <div className="appointment-body">
                  <div className="patient-info">
                    <h3>{appointment.p_name}</h3>
                    <p>{appointment.p_email}</p>
                  </div>

                  <div className="appointment-details">
                    <div className="detail-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>{formatDate(appointment.app_date)}</span>
                    </div>
                    <div className="detail-item">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                      <span>{formatTime(appointment.app_time)}</span>
                    </div>
                  </div>

                  <div className="medical-info">
                    <div className="info-section">
                      <h4>Symptoms</h4>
                      <p>{appointment.symptoms}</p>
                    </div>
                    <div className="info-section">
                      <h4>Concerns</h4>
                      <p>{appointment.concerns}</p>
                    </div>
                  </div>

                  {appointment.status !== 'diagnosed' && (
                    <div className="appointment-actions">
                      <button
                        className="diagnose-button"
                        onClick={() => handleDiagnose(appointment.a_id)}
                        style={{maxWidth: "150px", display: "flex", justifyContent: "center", alignItems: "center"}}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Diagnose
                      </button>
                      {/* <CopyToClipboard 
                        text={`http://localhost:3001`}
                        onCopy={() => handleCopyClick(appointment.a_id)}
                      >
                        <button className="copy-button">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                          </svg>
                          {copiedId === appointment.a_id ? 'Copied!' : 'Copy Call Link'}
                        </button>
                      </CopyToClipboard> */}
                      <button
                        className="cancel-button"
                        onClick={() =>handleCancel
                          (appointment.a_id, 'cancelled')}
                        style={{minWidth: "40%"}}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewVirtualAppointments;