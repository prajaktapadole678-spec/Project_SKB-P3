import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

export const fetchWeather = (city = 'Pune') =>
  api.get('/weather', { params: { city } }).then(r => r.data);

export const fetchCrops = (cropName = null) => {
  const params = cropName ? { crop: cropName } : {};
  return api.get('/crops', { params }).then(r => r.data);
};

export const fetchPrediction = (city = 'Pune') =>
  api.get('/predict', { params: { city } }).then(r => r.data);

export const fetchScenario = (city, soilType, targetCrop) =>
  api.get('/scenario', {
    params: { city, soil_type: soilType, target_crop: targetCrop },
  }).then(r => r.data);

export const uploadCropCSV = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post('/crops/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export default api;
