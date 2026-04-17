const MAX_PTS = 33.33;

function _linearScore(value, optimalMin, optimalMax) {
  if (value >= optimalMin && value <= optimalMax) return MAX_PTS;
  const ramp = Math.max((optimalMax - optimalMin) * 0.75, 5.0);
  const shortfall = value < optimalMin ? optimalMin - value : value - optimalMax;
  const penalty = (shortfall / ramp) * MAX_PTS;
  return Math.max(0.0, Math.round((MAX_PTS - penalty) * 100) / 100);
}

function _statusLabel(score) {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Poor";
}

function _generateInsights(cropName, temp, humidity, rainfall, trait) {
  const insights = [];
  if (temp < trait.optimal_temp_min) insights.push(`🌡️ Temperature (${temp.toFixed(1)}°C) is below optimal range (${trait.optimal_temp_min}-${trait.optimal_temp_max}°C) for ${cropName}.`);
  else if (temp > trait.optimal_temp_max) insights.push(`🔥 Temperature (${temp.toFixed(1)}°C) exceeds optimal range (${trait.optimal_temp_min}-${trait.optimal_temp_max}°C). Heat stress risk for ${cropName}.`);
  else insights.push(`✅ Temperature is ideal for ${cropName}.`);

  if (humidity < trait.optimal_humidity_min) insights.push(`💧 Humidity (${humidity.toFixed(0)}%) is low; ${cropName} prefers ${trait.optimal_humidity_min}-${trait.optimal_humidity_max}%.`);
  else if (humidity > trait.optimal_humidity_max) insights.push(`🌫️ Humidity (${humidity.toFixed(0)}%) is high; disease pressure may increase for ${cropName}.`);
  else insights.push(`✅ Humidity is within optimal range for ${cropName}.`);

  if (rainfall < trait.optimal_rainfall_min) insights.push(`🌵 Rainfall estimate (${rainfall.toFixed(0)} mm/mo) is below what ${cropName} needs (${trait.optimal_rainfall_min}-${trait.optimal_rainfall_max} mm/mo). Irrigation advised.`);
  else if (rainfall > trait.optimal_rainfall_max) insights.push(`🌧️ Rainfall estimate (${rainfall.toFixed(0)} mm/mo) exceeds optimum. Waterlogging risk for ${cropName}.`);
  else insights.push(`✅ Rainfall is well-suited for ${cropName}.`);

  return insights;
}

function scoreAllCrops(weather, traits) {
  const scores = traits.map(trait => {
    const tempScore = _linearScore(weather.temperature, trait.optimal_temp_min, trait.optimal_temp_max);
    const humScore = _linearScore(weather.humidity, trait.optimal_humidity_min, trait.optimal_humidity_max);
    const rainScore = _linearScore(weather.rainfall, trait.optimal_rainfall_min, trait.optimal_rainfall_max);
    const total = +(tempScore + humScore + rainScore).toFixed(1);
    
    return {
      crop_name: trait.crop_name,
      total_score: total,
      temperature_score: +tempScore.toFixed(1),
      humidity_score: +humScore.toFixed(1),
      rainfall_score: +rainScore.toFixed(1),
      status: _statusLabel(total),
      insights: _generateInsights(trait.crop_name, weather.temperature, weather.humidity, weather.rainfall, trait)
    };
  });
  return scores.sort((a, b) => b.total_score - a.total_score);
}

function buildRecommendation(scores, weather) {
  if (scores.length === 0) return { recommended_crop: "None", recommendation_reason: "No crop data available.", confidence: 0.0 };
  const best = scores[0];
  const worst = scores[scores.length - 1];
  let confidence = 75.0;
  if (scores.length > 1 && worst.total_score > 0) {
    const gap = best.total_score - worst.total_score;
    const total = best.total_score + worst.total_score;
    confidence = Math.min(100.0, 50 + (gap / total) * 100);
  }
  const reason = `${best.crop_name} scores ${best.total_score}/100 under current Pune conditions (Temp: ${weather.temperature}°C, Humidity: ${weather.humidity}%, Est. Rainfall: ${weather.rainfall} mm/mo). Status: ${best.status}.`;
  
  return { recommended_crop: best.crop_name, recommendation_reason: reason, confidence: +confidence.toFixed(1) };
}

module.exports = { scoreAllCrops, buildRecommendation };
