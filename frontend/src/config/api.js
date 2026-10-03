const ML_API_URL = (
  process.env.REACT_APP_ML_API_URL || 'http://127.0.0.1:8000'
).replace(/\/$/, '');

export const IMAGING_PREDICT_URL = `${ML_API_URL}/api/v1/imaging/predict`;
export const SYMPTOM_SEARCH_URL = `${ML_API_URL}/api/v1/symptoms/search`;
export const HEALTH_URL = `${ML_API_URL}/api/v1/health`;
