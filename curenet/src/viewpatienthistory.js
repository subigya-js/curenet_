import React, { useState } from 'react';
import './Viewpatienthistory.css';

const Viewpatienthistory = () => {
  const [email, setEmail] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Please enter a valid email.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`http://localhost:8801/history/${email.trim()}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message);
      }

      setHistory(data.data);
    } catch (err) {
      console.error('Error fetching history:', err);
      setError(err.message || 'An error occurred while fetching history.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="patient-history-container">
      <div className="history-panel">
        <div className="search-section">
          <h1>Patient History</h1>
          <p>Enter patient email to view their appointment history</p>
          
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter patient email"
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Searching...
                </>
              ) : (
                'Search History'
              )}
            </button>
          </form>

          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="history-section">
            <div className="history-header">
              <h2>Medical History</h2>
              <span className="record-count">{history.length} Records Found</span>
            </div>

            <div className="history-cards">
              {history.map((item, index) => (
                <div key={index} className="history-card">
                  <div className="card-header">
                    <div className="appointment-date">
                      <div className="date">{formatDate(item.app_date)}</div>
                      <div className="time">{formatTime(item.app_time)}</div>
                    </div>
                    <div className={`appointment-type ${item.type}`}>
                      {item.type} Consultation
                    </div>
                  </div>

                  <div className="card-content">
                    {item.symptoms && (
                      <div className="content-section">
                        <h4>Symptoms</h4>
                        <p>{item.symptoms}</p>
                      </div>
                    )}

                    {item.concerns && (
                      <div className="content-section">
                        <h4>Concerns</h4>
                        <p>{item.concerns}</p>
                      </div>
                    )}

                    {item.medications && (
                      <div className="content-section">
                        <h4>Prescribed Medications</h4>
                        <p>{item.medications}</p>
                      </div>
                    )}

                    {item.precautions && (
                      <div className="content-section">
                        <h4>Precautions & Advice</h4>
                        <p>{item.precautions}</p>
                      </div>
                    )}
                  </div>

                  <div className="card-footer">
                    <span className={`status ${item.status}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Viewpatienthistory;