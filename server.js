require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const csv = require('csv-parser');
const axios = require('axios');
const { initDb, getCrops, upsertCrop } = require('./database');
const { scoreAllCrops, buildRecommendation } = require('./scoring');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

const CITY = process.env.CITY || 'Pune';
const API_KEY = (process.env.OPENWEATHER_API_KEY || '').trim();
const OWM_URL = 'https://api.openweathermap.org/data/2.5/weather';

function getMockWeather() {
  const month = new Date().getMonth() + 1;
  let temp, humidity, rainfall, desc;
  if ([3, 4, 5].includes(month)) {
    temp = 32 + Math.random() * 10;
    humidity = 20 + Math.random() * 25;
    rainfall = 5 + Math.random() * 25;
    desc = "Hazy sunshine, hot and dry";
  } else if ([6, 7, 8, 9].includes(month)) {
    temp = 22 + Math.random() * 8;
    humidity = 70 + Math.random() * 25;
    rainfall = 100 + Math.random() * 100;
    desc = "Heavy monsoon showers, high humidity";
  } else if ([10, 11].includes(month)) {
    temp = 24 + Math.random() * 8;
    humidity = 50 + Math.random() * 20;
    rainfall = 10 + Math.random() * 40;
    desc = "Partly cloudy, pleasant";
  } else {
    temp = 12 + Math.random() * 10;
    humidity = 35 + Math.random() * 25;
    rainfall = 2 + Math.random() * 13;
    desc = "Clear skies, cool and comfortable";
  }
  return {
    city: CITY,
    temperature: +(temp).toFixed(1),
    humidity: +(humidity).toFixed(1),
    rainfall: +(rainfall).toFixed(1),
    description: desc,
    feels_like: +(temp + (Math.random() * 5 - 2)).toFixed(1),
    wind_speed: +(5 + Math.random() * 20).toFixed(1),
    source: "mock"
  };
}

async function fetchLiveWeather() {
  try {
    const resp = await axios.get(OWM_URL, { params: { q: CITY, appid: API_KEY, units: 'metric' } });
    const data = resp.data;
    const rain3h = data.rain && data.rain['3h'] ? data.rain['3h'] : 0.0;
    let monthly_est = rain3h * (720 / 3);
    monthly_est = Math.min(monthly_est, 300.0);

    return {
      city: data.name,
      temperature: data.main.temp,
      humidity: data.main.humidity,
      rainfall: +(monthly_est).toFixed(1),
      description: data.weather[0].description.charAt(0).toUpperCase() + data.weather[0].description.slice(1),
      feels_like: data.main.feels_like,
      wind_speed: data.wind.speed,
      source: "live"
    };
  } catch (err) {
    throw new Error('OpenWeatherMap API error: ' + err.message);
  }
}

app.get('/weather', async (req, res) => {
  if (API_KEY) {
    try {
      const data = await fetchLiveWeather();
      return res.json(data);
    } catch (e) {
      return res.status(502).json({ detail: e.message });
    }
  }
  return res.json(getMockWeather());
});

app.get('/crops', async (req, res) => {
  try {
    const crops = await getCrops(req.query.crop);
    if (!crops.length) return res.status(404).json({ detail: "No crop traits found." });
    res.json(crops);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

app.post('/crops/upload', upload.single('file'), (req, res) => {
  if (!req.file || !req.file.originalname.endsWith('.csv')) {
    return res.status(400).json({ detail: "Only CSV files are accepted." });
  }
  const results = [];
  let created = 0;
  let updated = 0;
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      fs.unlinkSync(req.file.path); // cleanup
      
      const reqCols = ['crop_name', 'optimal_temp_min', 'optimal_temp_max', 'optimal_humidity_min', 'optimal_humidity_max', 'optimal_rainfall_min', 'optimal_rainfall_max'];
      if (!reqCols.every(col => Object.keys(results[0]).includes(col))) {
        return res.status(422).json({ detail: "CSV missing required columns" });
      }

      for (const row of results) {
        const action = await upsertCrop(row);
        if (action === 'created') created++;
        if (action === 'updated') updated++;
      }
      res.json({ message: "Upload successful", created, updated });
    });
});

app.get('/predict', async (req, res) => {
  try {
    const weather = API_KEY ? await fetchLiveWeather() : getMockWeather();
    const traits = await getCrops();
    if (!traits.length) return res.status(404).json({ detail: "No crop traits in database. Please upload CSV first." });

    const scores = scoreAllCrops(weather, traits);
    const rec = buildRecommendation(scores, weather);
    
    res.json({
      city: CITY,
      weather: weather,
      scores: scores,
      recommended_crop: rec.recommended_crop,
      recommendation_reason: rec.recommendation_reason,
      confidence: rec.confidence
    });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

initDb().then(() => {
  app.listen(8000, () => {
    console.log(`🌱 Node.js Backend running on http://localhost:8000`);
    console.log(`City: ${CITY} | Source: ${API_KEY ? 'Live' : 'Mock'}`);
  });
}).catch(console.error);
