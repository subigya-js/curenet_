const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const { promisePool } = require('../config/db');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

exports.analyzeImage = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image uploaded' });
  }

  const cleanup = () => {
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error removing temporary upload:', err);
      });
    }
  };

  try {
    // Health check ML service
    try {
      await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 3000 });
    } catch (err) {
      cleanup();
      return res.status(503).json({
        success: false,
        message: 'ML imaging service is not running. Please start the FastAPI service.'
      });
    }

    const formData = new FormData();
    formData.append('file', fs.createReadStream(req.file.path));
    formData.append('analysis_type', req.body.type || 'stroke');

    const response = await axios.post(`${ML_SERVICE_URL}/predict`, formData, {
      headers: { ...formData.getHeaders() },
      timeout: 30000
    });

    cleanup();

    // Optionally save to medical_analysis if patient email is provided
    const patientEmail = req.body.p_email || req.body.email;
    if (patientEmail) {
      try {
        await promisePool.query(
          `INSERT INTO medical_analysis (p_email, analysis_type, prediction, probability, image_path)
           VALUES (?, ?, ?, ?, ?)`,
          [
            patientEmail,
            req.body.type || 'stroke',
            response.data.prediction,
            response.data.probability,
            req.file.filename
          ]
        );
      } catch (dbErr) {
        console.warn('Failed to record medical analysis in DB:', dbErr.message);
      }
    }

    return res.json({
      success: true,
      result: response.data.message,
      probability: response.data.probability,
      prediction: response.data.prediction,
      probabilities: response.data.probabilities,
      warning: response.data.warning,
      model_version: response.data.model_version,
      stroke_probability: response.data.stroke_probability,
      input_scope: response.data.input_scope,
      detected_anatomy: response.data.detected_anatomy,
      anatomy_probability: response.data.anatomy_probability,
      anatomy_gate_version: response.data.anatomy_gate_version
    });
  } catch (error) {
    cleanup();
    console.error('Error during image analysis:', error.message);
    return res.status(500).json({
      success: false,
      message: error.response?.data?.detail || error.message || 'Error processing image'
    });
  }
};

exports.getAnalysisHistory = async (req, res, next) => {
  try {
    const [rows] = await promisePool.query(
      `SELECT * FROM medical_analysis WHERE p_email = ? ORDER BY analysis_date DESC`,
      [req.params.email]
    );
    res.json(rows);
  } catch (error) {
    next(error);
  }
};
