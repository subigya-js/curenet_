import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './Medication.css';

const Medication = () => {
  const { a_id } = useParams();
  const navigate = useNavigate();

  const [appointmentDetails, setAppointmentDetails] = useState(null);
  const [medication, setMedication] = useState('');
  const [precautions, setPrecautions] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAppointmentDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`http://localhost:8801/appointments/${a_id}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch appointment details: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data) {
          throw new Error('No appointment data received');
        }

        if (!data.p_name || !data.p_email) {
          throw new Error('Incomplete appointment data');
        }

        setAppointmentDetails(data);
      } catch (err) {
        console.error('Error fetching appointment details:', err);
        setError(err.message || 'Error fetching appointment details. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchAppointmentDetails();
  }, [a_id]);

  const handleDiagnoseSubmit = async (e) => {
    e.preventDefault();
    
    if (!medication.trim() || !precautions.trim()) {
      setError('Please fill in both medication and precautions fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`http://localhost:8801/medication/${a_id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          medications: medication.trim(), 
          precautions: precautions.trim()
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to submit diagnosis');
      }

      alert('Diagnosis submitted successfully');
      navigate('/viewappointment');
    } catch (err) {
      console.error('Error during diagnosis:', err);
      setError(err.message || 'Error submitting diagnosis. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="medication-container loading">
        <div className="loading-spinner">Loading appointment details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="medication-container error">
        <div className="error-message">{error}</div>
        <button onClick={() => navigate('/viewappointment')} className="back-button">
          Back to Appointments
        </button>
      </div>
    );
  }

  if (!appointmentDetails) {
    return (
      <div className="medication-container error">
        <div className="error-message">No appointment details found</div>
        <button onClick={() => navigate('/viewappointment')} className="back-button">
          Back to Appointments
        </button>
      </div>
    );
  }

  return (
    <div className="medication-container">
      <div className="medication-card">
        <h1>Patient Diagnosis Form</h1>
        
        <div className="patient-details">
          <h2>Patient Details</h2>
          <p><strong>Name:</strong> {appointmentDetails.p_name}</p>
          <p><strong>Email:</strong> {appointmentDetails.p_email}</p>
          <p><strong>Symptoms:</strong> {appointmentDetails.symptoms || 'None specified'}</p>
          <p><strong>Concerns:</strong> {appointmentDetails.concerns || 'None specified'}</p>
        </div>

        <form onSubmit={handleDiagnoseSubmit} className="diagnosis-form">
          <div className="form-group">
            <label htmlFor="medication">Prescribed Medications:</label>
            <textarea
              id="medication"
              value={medication}
              onChange={(e) => setMedication(e.target.value)}
              placeholder="Enter prescribed medications..."
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="precautions">Precautions & Advice:</label>
            <textarea
              id="precautions"
              value={precautions}
              onChange={(e) => setPrecautions(e.target.value)}
              placeholder="Enter precautions and advice..."
              required
            />
          </div>

          <div className="button-group">
            <button
              type="button"
              onClick={() => navigate('/viewappointment')}
              className="back-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="submit-button"
            >
              Submit Diagnosis
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Medication;
