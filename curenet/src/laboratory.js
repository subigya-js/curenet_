import React, { useState } from 'react';
import './Laboratory.css';

const Laboratory = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [prediction, setPrediction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysisType, setAnalysisType] = useState('stroke');

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.includes('image/')) {
        setError('Please select an image file (JPG or PNG)');
        return;
      }
      setSelectedFile(file);
      setError('');
      setPrediction('');
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setError('Please select an image first');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('analysis_type', analysisType);

    try {
      // Make request directly to FastAPI server
      const response = await fetch('http://127.0.0.1:8000/predict', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error analyzing image');
      }

      const data = await response.json();
      setPrediction({
        message: data.message,
        probability: data.probability,
        probabilities: data.probabilities,
        type: data.prediction,
        warning: data.warning
      });
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Error analyzing image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <div className="form-box">
        <h1>Curenet Laboratory</h1>
        
        <div className="analysis-buttons">
          <button
            onClick={() => setAnalysisType('stroke')}
            className={`analysis-btn ${analysisType === 'stroke' ? 'active' : ''}`}
          >
            Brain Stroke Analysis
          </button>
          <button
            onClick={() => setAnalysisType('cancer')}
            className={`analysis-btn ${analysisType === 'cancer' ? 'active' : ''}`}
          >
            Lung Image Classification
          </button>
        </div>
  
        <div className="content-container">
          <div className="upload-section">
            <div 
              className="upload-area"
              onClick={() => document.getElementById('fileInput').click()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) {
                  const input = document.getElementById('fileInput');
                  const dataTransfer = new DataTransfer();
                  dataTransfer.items.add(file);
                  input.files = dataTransfer.files;
                  handleFileSelect({ target: input });
                }
              }}
              onDragOver={(e) => e.preventDefault()}
            >
              <input
                id="fileInput"
                type="file"
                onChange={handleFileSelect}
                accept="image/*"
                style={{ display: 'none' }}
              />
              
              {preview ? (
                <div className="preview-container">
                  <img src={preview} alt="Preview" className="image-preview" />
                  <button 
                    className="remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      setPreview(null);
                      setPrediction('');
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="upload-prompt">
                  <span>Drop your scan here, or click to select</span>
                  <small>Supports JPG, PNG</small>
                </div>
              )}
            </div>
  
            {error && <div className="error-message">{error}</div>}
  
            {selectedFile && (
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="analyze-btn"
              >
                {loading ? 'Analyzing...' : 'Analyze Image'}
              </button>
            )}
          </div>
  
          <div className="result-section">
            {prediction ? (
              <div className="prediction">
                <div className="prediction-message">{prediction.message}</div>
                <div className="prediction-probability">
                  Selected-class score: {(prediction.probability * 100).toFixed(1)}%
                </div>
                {prediction.probabilities && (
                  <div className="prediction-scores">
                    {Object.entries(prediction.probabilities).map(([label, score]) => (
                      <div key={label}>
                        {label}: {(score * 100).toFixed(1)}%
                      </div>
                    ))}
                  </div>
                )}
                <div className="research-warning">{prediction.warning}</div>
              </div>
            ) : (
              <div className="prediction">
                <div className="prediction-message">
                  Upload an image to see the analysis results
                </div>
                <div className="research-warning">
                  Research demonstration only. Results are not a medical diagnosis.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Laboratory;
