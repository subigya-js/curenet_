const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysisController');
const upload = require('../middleware/upload');

router.post('/analyze-image', upload.single('image'), analysisController.analyzeImage);
router.get('/analysis-history/:email', analysisController.getAnalysisHistory);

module.exports = router;
