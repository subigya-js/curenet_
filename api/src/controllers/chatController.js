const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

function formatPredictionResponse(predictions) {
  if (!predictions || predictions.length === 0) {
    return "I couldn't determine any potential conditions based on these symptoms.";
  }

  const formattedPredictions = predictions.map((pred, index) => {
    const confidence = (pred.confidence || 0).toFixed(1);
    return `${index + 1}. ${pred.disease} (${confidence}%)`;
  });

  return `Based on your symptoms, you might have:\n\n${formattedPredictions.join('\n')}\n\nAlso consult your doctor for this.\n The diseases mentioned are based on your symptoms, if you want more clarity provide your entire symptoms.`;
}

exports.askChatbot = (req, res, next) => {
  const { question } = req.body;

  if (!question || question.trim() === '') {
    return res.status(400).json({
      success: false,
      response: 'Please provide symptoms'
    });
  }

  // Look for recommend.py in ml_services first, fallback to current dir
  const mlServicePath = path.resolve(__dirname, '../../ml_services/recommend.py');
  const legacyPath = path.resolve(__dirname, '../../recommend.py');
  const scriptPath = fs.existsSync(mlServicePath) ? mlServicePath : legacyPath;
  const scriptDir = path.dirname(scriptPath);

  // Use execFile with arguments to avoid shell command injection
  execFile('python3', [scriptPath, question], { cwd: scriptDir, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) {
      console.error(`Error executing recommendation script: ${stderr || err.message}`);
      return res.status(500).json({
        success: false,
        response: 'Error in processing the symptom model'
      });
    }

    try {
      const predictions = JSON.parse(stdout.trim());
      const formattedResponse = formatPredictionResponse(predictions);
      return res.json({
        success: true,
        response: formattedResponse
      });
    } catch (parseError) {
      console.error('Error parsing prediction JSON:', parseError, stdout);
      return res.status(500).json({
        success: false,
        response: 'Error processing the prediction results'
      });
    }
  });
};
