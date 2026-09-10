import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Laboratory.css';

const Laboratory = () => {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysisType, setAnalysisType] = useState('lung');

  const handleFileSelect = (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) {
      if (!file.type.includes('image/')) {
        setError('Please select an image file (axial JPG or PNG scan)');
        return;
      }
      setSelectedFile(file);
      setError('');
      setPrediction(null);

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setError('Please select an authentic axial radiological scan first');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('analysis_type', analysisType);

    try {
      const response = await fetch('http://127.0.0.1:8000/predict', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error analyzing scan');
      }

      const data = await response.json();
      setPrediction({
        message: data.message,
        probability: data.probability,
        probabilities: data.probabilities,
        type: data.prediction,
        status_badge: data.status_badge || data.prediction,
        status_level: data.status_level || 'info',
        clinical_summary: data.clinical_summary || data.message,
        confidence_label: data.confidence_label || `${(data.probability * 100).toFixed(1)}%`,
        recommended_action: data.recommended_action || 'Consult a certified clinician for review.',
        warning: data.warning,
        patient_headline: data.patient_headline,
        patient_explanation: data.patient_explanation,
        common_causes: data.common_causes || [],
      });
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Error analyzing image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lab-page-root">
      {/* Top Navigation Bar */}
      <header className="lab-top-navbar">
        <div className="lab-brand-container">
          <div className="lab-brand-logo-badge">🔬</div>
          <div className="lab-brand-text">
            <h2>CureNet Laboratory</h2>
            <span>Diagnostic Imaging & Screening</span>
          </div>
        </div>

        <nav className="lab-nav-actions">
          <button
            onClick={() => navigate('/dashboard')}
            className="lab-nav-link-btn"
            title="Return to patient dashboard"
          >
            ← Back to Dashboard
          </button>
          <Link
            to="/schedule"
            className="lab-nav-link-btn primary-nav-btn"
            title="Book an appointment with a doctor"
          >
            📅 Book Consultation
          </Link>
        </nav>
      </header>

      {/* Main Container */}
      <main className="lab-main-container">
        {/* Hero Section */}
        <div className="lab-hero-header">
          <h1>Diagnostic Imaging Laboratory</h1>
          <p>
            Automated radiological screening for axial monochrome scans with patient-friendly 
            explanations and physician triage indicators.
          </p>

          {/* Analysis Modality Switcher */}
          <div className="lab-modality-switcher">
            <button
              onClick={() => {
                setAnalysisType('lung');
                setPrediction(null);
                setError('');
              }}
              className={`lab-modality-btn ${analysisType === 'lung' ? 'active' : ''}`}
            >
              🫁 Lung Scan Analysis
            </button>
            <button
              onClick={() => {
                setAnalysisType('stroke');
                setPrediction(null);
                setError('');
              }}
              className={`lab-modality-btn ${analysisType === 'stroke' ? 'active' : ''}`}
            >
              🧠 Brain Stroke Analysis
            </button>
          </div>
        </div>

        {/* Full Workspace Grid */}
        <div className="lab-workspace-grid">
          {/* Left Column: Upload & Controls */}
          <div className="lab-control-card">
            <h3 className="lab-card-title">
              📤 Upload Axial Scan
            </h3>

            <div
              className="lab-dropzone"
              onClick={() => document.getElementById('labFileInput').click()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) {
                  const input = document.getElementById('labFileInput');
                  const dataTransfer = new DataTransfer();
                  dataTransfer.items.add(file);
                  input.files = dataTransfer.files;
                  handleFileSelect({ target: input });
                }
              }}
              onDragOver={(e) => e.preventDefault()}
            >
              <input
                id="labFileInput"
                type="file"
                onChange={handleFileSelect}
                accept="image/*"
                style={{ display: 'none' }}
              />

              {preview ? (
                <div className="lab-preview-wrapper">
                  <img src={preview} alt="Scan Preview" className="lab-preview-img" />
                  <button
                    className="lab-preview-remove-btn"
                    title="Remove scan"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      setPreview(null);
                      setPrediction(null);
                      setError('');
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="lab-dropzone-prompt">
                  <span className="lab-dropzone-icon">
                    {analysisType === 'lung' ? '🫁' : '🧠'}
                  </span>
                  <span className="lab-dropzone-text">
                    Drag & drop your axial CT or MRI scan here
                  </span>
                  <span className="lab-dropzone-subtext">
                    or click to browse local files (Monochrome JPG or PNG)
                  </span>
                </div>
              )}
            </div>

            {error && (
              <div className="lab-error-banner">
                <strong>⚠️ Scan Validation Notice</strong>
                <div>{error}</div>
              </div>
            )}

            {selectedFile && (
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="lab-analyze-cta"
              >
                {loading ? '⚡ Screening Radiological Scan...' : '⚡ Analyze Radiological Scan'}
              </button>
            )}

            <div className="lab-specs-card">
              <h5>📋 Scan Input Guidelines:</h5>
              <ul>
                <li>Authentic monochrome CT / MRI cross-section (axial slice).</li>
                <li>Digital DICOM export or clean photo of hospital monitor.</li>
                <li>No colorful charts, non-medical photos, or heavy text overlays.</li>
              </ul>
            </div>
          </div>

          {/* Right Column: Results & Clinical Interpretation */}
          <div className="lab-result-card">
            {prediction ? (
              <div className={`patient-card patient-card-${prediction.status_level}`}>
                <div className="card-header-badge">
                  <span className={`status-pill status-pill-${prediction.status_level}`}>
                    {prediction.status_badge}
                  </span>
                  <span className="confidence-pill">{prediction.confidence_label}</span>
                </div>

                {prediction.patient_headline && (
                  <div className="patient-headline-box">
                    <h3 className="patient-headline-title">
                      {prediction.patient_headline}
                    </h3>
                  </div>
                )}

                {prediction.patient_explanation && (
                  <div className="patient-explanation-box">
                    <div className="patient-explanation-text">
                      {prediction.patient_explanation.split('\n\n').map((paragraph, idx) => (
                        <p key={idx} style={{ margin: '0 0 0.6rem 0', lineHeight: 1.6 }}>
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {prediction.common_causes && prediction.common_causes.length > 0 && (
                  <div className="common-causes-card">
                    <h5 className="common-causes-title">
                      💡 Common & Everyday Reasons for This Finding:
                    </h5>
                    <ul className="common-causes-list">
                      {prediction.common_causes.map((cause, idx) => (
                        <li key={idx} className="common-cause-item">
                          <span className="cause-icon">✓</span>
                          <span>{cause}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="action-box">
                  <div style={{ fontSize: '0.9rem', color: '#ffd54f', marginBottom: '0.4rem' }}>
                    <strong>Recommended Next Step:</strong> {prediction.recommended_action}
                  </div>
                  <Link to="/schedule" className="appointment-cta-btn">
                    📅 Schedule Consultation with a Doctor
                  </Link>
                </div>

                <details className="technical-details-toggle">
                  <summary className="technical-summary-header">
                    🔬 Technical & Laboratory Data (For Clinicians & Radiologists)
                  </summary>
                  <div className="technical-content">
                    <div className="clinical-summary-box">
                      <h4 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontSize: '0.9rem' }}>
                        📝 Clinical Morphology Summary
                      </h4>
                      <p style={{ margin: 0, lineHeight: 1.5, fontSize: '0.85rem', color: '#cbd5e1' }}>
                        {prediction.clinical_summary}
                      </p>
                    </div>

                    {prediction.probabilities && (
                      <div className="probability-meters">
                        <h5 style={{ margin: '0.5rem 0 0.4rem 0', color: '#94a3b8', fontSize: '0.82rem' }}>
                          Model Distribution Breakdown:
                        </h5>
                        {Object.entries(prediction.probabilities).map(([label, score]) => {
                          const percentage = (score * 100).toFixed(1);
                          const isTop = label === prediction.type;
                          return (
                            <div key={label} className="meter-row">
                              <div className="meter-label">
                                <span style={{ fontWeight: isTop ? 600 : 400 }}>{label}</span>
                                <span>{percentage}%</span>
                              </div>
                              <div className="meter-track">
                                <div
                                  className={`meter-fill ${isTop ? 'meter-fill-top' : ''}`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </details>

                <div className="research-warning">{prediction.warning}</div>
              </div>
            ) : (
              <div className="lab-empty-state">
                <div className="lab-empty-icon">🩻</div>
                <div className="lab-empty-title">Awaiting Radiological Scan</div>
                <p className="lab-empty-desc">
                  Select an axial CT or MRI scan on the left panel and click 
                  <strong>"Analyze Radiological Scan"</strong> to generate patient-friendly 
                  visual findings and clinical triage data.
                </p>

                <div className="lab-empty-steps">
                  <div className="lab-empty-step-item">
                    <span>STEP 1</span>
                    <p>Select scan type (Lung or Brain)</p>
                  </div>
                  <div className="lab-empty-step-item">
                    <span>STEP 2</span>
                    <p>Upload axial monochrome scan</p>
                  </div>
                  <div className="lab-empty-step-item">
                    <span>STEP 3</span>
                    <p>View plain-English interpretation</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Laboratory;
