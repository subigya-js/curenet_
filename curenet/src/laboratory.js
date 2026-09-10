import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Laboratory.css';

/* ─── Circular SVG confidence gauge ─────────────────────────────── */
function ConfidenceGauge({ percentage, level }) {
  const radius = 40;
  const circ = 2 * Math.PI * radius;
  const dash = (percentage / 100) * circ;
  const colorMap = { success: '#10b981', warning: '#f59e0b', danger: '#ef4444', info: '#38bdf8' };
  const color = colorMap[level] || '#38bdf8';
  return (
    <svg width="110" height="110" viewBox="0 0 110 110" className="gauge-svg">
      <circle cx="55" cy="55" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
      <circle
        cx="55" cy="55" r={radius} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 55 55)"
        style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 6px ${color}88)` }}
      />
      <text x="55" y="51" textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="700">{percentage}%</text>
      <text x="55" y="66" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="9">AI Score</text>
    </svg>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
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
      if (!file.type.includes('image/')) { setError('Please select an image file (JPG or PNG)'); return; }
      setSelectedFile(file); setError(''); setPrediction(null);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) { setError('Please select a scan image first'); return; }
    setLoading(true); setError('');
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('analysis_type', analysisType);
    try {
      const response = await fetch('http://127.0.0.1:8000/predict', { method: 'POST', body: formData });
      if (!response.ok) { const err = await response.json(); throw new Error(err.detail || 'Error analyzing scan'); }
      const data = await response.json();
      setPrediction({
        message: data.message, probability: data.probability, probabilities: data.probabilities,
        type: data.prediction, status_badge: data.status_badge || data.prediction,
        status_level: data.status_level || 'info', clinical_summary: data.clinical_summary || data.message,
        confidence_label: data.confidence_label || `${(data.probability * 100).toFixed(1)}%`,
        recommended_action: data.recommended_action || 'Consult a certified clinician for review.',
        warning: data.warning, patient_headline: data.patient_headline,
        patient_explanation: data.patient_explanation, common_causes: data.common_causes || [],
        attention: data.attention || null, plain_english: data.plain_english || '',
        next_steps: data.next_steps || [],
      });
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Error analyzing image. Please try again.');
    } finally { setLoading(false); }
  };

  const pct = prediction ? Math.round(prediction.probability * 100) : 0;
  const levelLabel = { success: 'No Concern Detected', warning: 'Follow-Up Advised', danger: 'See a Doctor Soon', info: 'Unknown Output' };
  const levelIcon = { success: '✅', warning: '⚠️', danger: '🔴', info: 'ℹ️' };

  return (
    <div className="lab-page-root">
      <header className="lab-top-navbar">
        <div className="lab-brand-container">
          <div className="lab-brand-logo-badge">🔬</div>
          <div className="lab-brand-text">
            <h2>CureNet Laboratory</h2>
            <span>AI-Assisted Diagnostic Imaging</span>
          </div>
        </div>
        <nav className="lab-nav-actions">
          <button onClick={() => navigate('/dashboard')} className="lab-nav-link-btn">← Back to Dashboard</button>
          <Link to="/schedule" className="lab-nav-link-btn primary-nav-btn">📅 Book Consultation</Link>
        </nav>
      </header>

      <main className="lab-main-container">
        <div className="lab-hero-header">
          <h1>Diagnostic Imaging Laboratory</h1>
          <p>Upload a CT or MRI axial slice and get an AI-assisted pattern analysis — explained for everyone.</p>
          <div className="lab-modality-switcher">
            <button onClick={() => { setAnalysisType('lung'); setPrediction(null); setError(''); }} className={`lab-modality-btn ${analysisType === 'lung' ? 'active' : ''}`}>🫁 Lung Scan</button>
            <button onClick={() => { setAnalysisType('stroke'); setPrediction(null); setError(''); }} className={`lab-modality-btn ${analysisType === 'stroke' ? 'active' : ''}`}>🧠 Brain Stroke</button>
          </div>
        </div>

        <div className="lab-workspace-grid">
          {/* Upload panel */}
          <div className="lab-control-card">
            <h3 className="lab-card-title">📤 Upload Scan</h3>
            <div className="lab-dropzone"
              onClick={() => document.getElementById('labFileInput').click()}
              onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) { const input = document.getElementById('labFileInput'); const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files; handleFileSelect({ target: input }); } }}
              onDragOver={(e) => e.preventDefault()}
            >
              <input id="labFileInput" type="file" onChange={handleFileSelect} accept="image/*" style={{ display: 'none' }} />
              {preview ? (
                <div className="lab-preview-wrapper">
                  <img src={preview} alt="Scan Preview" className="lab-preview-img" />
                  <button className="lab-preview-remove-btn" title="Remove" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setPreview(null); setPrediction(null); setError(''); }}>×</button>
                </div>
              ) : (
                <div className="lab-dropzone-prompt">
                  <span className="lab-dropzone-icon">{analysisType === 'lung' ? '🫁' : '🧠'}</span>
                  <span className="lab-dropzone-text">Drag & drop your CT scan here</span>
                  <span className="lab-dropzone-subtext">or click to browse · JPG or PNG</span>
                </div>
              )}
            </div>
            {error && (<div className="lab-error-banner"><strong>⚠️ Notice</strong><div>{error}</div></div>)}
            {selectedFile && (<button onClick={handleAnalyze} disabled={loading} className="lab-analyze-cta">{loading ? '⚡ Analyzing scan...' : '⚡ Analyze Scan'}</button>)}
            <div className="lab-specs-card">
              <h5>📋 Scan Guidelines</h5>
              <ul>
                <li>Axial CT or MRI slice (monochrome)</li>
                <li>DICOM export or clean scan photo</li>
                <li>No charts, non-medical photos, or heavy text overlays</li>
              </ul>
            </div>
          </div>

          {/* Result panel */}
          <div className="lab-result-card">
            {prediction ? (
              <div className="result-report">

                {/* Report header with gauge */}
                <div className={`report-header report-header-${prediction.status_level}`}>
                  <ConfidenceGauge percentage={pct} level={prediction.status_level} />
                  <div className="report-header-text">
                    <div className="report-header-pills">
                      <span className={`result-level-pill level-pill-${prediction.status_level}`}>
                        {levelIcon[prediction.status_level]} {levelLabel[prediction.status_level] || prediction.status_level}
                      </span>
                      <span className="result-confidence-pill">{pct}% AI Confidence</span>
                    </div>
                    <h2 className="report-main-title">{prediction.patient_headline}</h2>
                    <p className="report-subtitle">AI-assisted {analysisType === 'lung' ? 'lung CT' : 'brain MRI'} pattern screening</p>
                  </div>
                </div>

                {/* Two-column body */}
                <div className="report-body-grid">

                  {/* Left: images + bars */}
                  <div className="report-left-col">
                    {analysisType === 'lung' && prediction.attention ? (
                      <>
                        <div className="scan-image-grid">
                          <figure><img src={preview} alt="Original CT slice" /><figcaption>Original Scan</figcaption></figure>
                          <figure><img src={prediction.attention.overlay_image} alt="AI attention heatmap" /><figcaption>AI Attention Map</figcaption></figure>
                        </div>
                        <p className="heatmap-caption">Bright areas show which parts of the image most influenced the AI's decision (Grad-CAM).</p>
                      </>
                    ) : preview ? (
                      <div className="scan-image-grid single">
                        <figure><img src={preview} alt="Uploaded scan" /><figcaption>Uploaded Scan</figcaption></figure>
                      </div>
                    ) : null}

                    {prediction.probabilities && (
                      <div className="prob-bars">
                        <p className="prob-bars-label">Pattern similarity scores:</p>
                        {Object.entries(prediction.probabilities).map(([cls, score]) => {
                          const pctVal = (score * 100).toFixed(1);
                          const isTop = cls === prediction.type;
                          const barColor = cls === 'malignant' ? '#ef4444' : cls === 'benign' ? '#f59e0b' : '#10b981';
                          return (
                            <div key={cls} className={`prob-bar-row ${isTop ? 'prob-bar-top' : ''}`}>
                              <div className="prob-bar-meta">
                                <span className="prob-bar-label-text">{cls.charAt(0).toUpperCase() + cls.slice(1)}</span>
                                <span className="prob-bar-pct">{pctVal}%</span>
                              </div>
                              <div className="prob-bar-track">
                                <div className="prob-bar-fill" style={{ width: `${pctVal}%`, background: isTop ? barColor : 'rgba(255,255,255,0.12)', boxShadow: isTop ? `0 0 8px ${barColor}66` : 'none' }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* For Everyone Cards (Moved below probability bars) */}
                    <div className="everyone-panel">
                      <div className="pe-card">
                        <p className="pe-card-eyebrow">💬 What does this mean?</p>
                        {(prediction.plain_english || prediction.patient_explanation || '').split('\n\n').map((para, i) => (
                          para.trim() && <p key={i} className="pe-card-body">{para}</p>
                        ))}
                      </div>
                      {prediction.next_steps && prediction.next_steps.length > 0 && (
                        <div className="nextsteps-card">
                          <p className="nextsteps-eyebrow">📋 What should I do now?</p>
                          <ol className="nextsteps-list">
                            {prediction.next_steps.map((step, i) => (
                              <li key={i} className="nextstep-item">
                                <span className="nextstep-num">{i + 1}</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Clinical Details */}
                  <div className="report-right-col">
                    <div className="clinicians-panel">
                      <div className="clin-card">
                        <p className="clin-eyebrow">📊 Model Analysis Summary</p>
                        <p className="clin-body">{prediction.clinical_summary}</p>
                      </div>
                      {prediction.common_causes && prediction.common_causes.length > 0 && (
                        <div className="clin-card">
                          <p className="clin-eyebrow">⚠️ Interpretation Limitations</p>
                          <ul className="clin-limits-list">
                            {prediction.common_causes.map((c, i) => (<li key={i}>{c}</li>))}
                          </ul>
                        </div>
                      )}
                      {analysisType === 'lung' && prediction.attention && (
                        <div className="clin-card">
                          <p className="clin-eyebrow">🔬 Grad-CAM Metrics</p>
                          <div className="clin-metrics-grid">
                            <div><span>Method</span><strong>{prediction.attention.method.replace('_', '-').toUpperCase()}</strong></div>
                            <div><span>Peak X</span><strong>{prediction.attention.peak_x_percent}%</strong></div>
                            <div><span>Peak Y</span><strong>{prediction.attention.peak_y_percent}%</strong></div>
                            <div><span>Active Region</span><strong>{prediction.attention.region_percent}%</strong></div>
                          </div>
                          <p className="clin-body" style={{ marginTop: '0.6rem' }}>{prediction.attention.description}</p>
                          <p className="clin-body clin-disclaimer">{prediction.attention.disclaimer}</p>
                        </div>
                      )}
                      {prediction.patient_explanation && (
                        <div className="clin-card">
                          <p className="clin-eyebrow">📝 Detailed Findings</p>
                          {prediction.patient_explanation.split('\n\n').map((p, i) => (
                            <p key={i} className="clin-body">{p}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="report-footer">
                  <div className="report-recommended">
                    <span className="report-recommended-label">Recommended next step:</span>
                    <span className="report-recommended-text">{prediction.recommended_action}</span>
                  </div>
                  <Link to="/schedule" className="appointment-cta-btn">📅 Schedule a Doctor's Consultation</Link>
                  <p className="report-legal-footnote">
                    ⓘ This AI tool screens for visual patterns only and is not a clinical diagnosis. Results must be reviewed by a qualified healthcare professional before any medical decision is made.
                  </p>
                </div>
              </div>
            ) : (
              <div className="lab-empty-state">
                <div className="lab-empty-icon">🩻</div>
                <div className="lab-empty-title">Awaiting Scan Upload</div>
                <p className="lab-empty-desc">Select a scan type, upload your axial CT or MRI slice, and click <strong>"Analyze Scan"</strong> to get an AI-assisted result — explained in plain English and clinical detail.</p>
                <div className="lab-empty-steps">
                  <div className="lab-empty-step-item"><span>STEP 1</span><p>Choose Lung or Brain mode</p></div>
                  <div className="lab-empty-step-item"><span>STEP 2</span><p>Upload your scan image</p></div>
                  <div className="lab-empty-step-item"><span>STEP 3</span><p>View results for you</p></div>
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
