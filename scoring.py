"""
Rule-based crop resilience scoring engine.
Each crop is scored 0–100 across four dimensions:
  - Temperature suitability  (0–33.33 pts)
  - Humidity suitability     (0–33.33 pts)
  - Rainfall suitability     (0–33.33 pts)
  - Soil suitability bonus   (0 or 10 pts → total capped at 100)
"""

from models import CropTraitResponse, CropScore, WeatherResponse

SOIL_COMPATIBILITY = {
    "Loamy":  ["Loamy", "Sandy Loam", "Clay Loam"],
    "Clay":   ["Clay", "Clay Loam", "Silty Clay"],
    "Sandy":  ["Sandy", "Sandy Loam", "Loamy"],
    "Silty":  ["Silty", "Silty Clay", "Loamy"],
}


def _linear_score(value: float, optimal_min: float, optimal_max: float, max_pts: float = 33.33) -> float:
    if optimal_min <= value <= optimal_max:
        return max_pts

    ramp = max((optimal_max - optimal_min) * 0.75, 5.0)

    if value < optimal_min:
        shortfall = optimal_min - value
    else:
        shortfall = value - optimal_max

    penalty = (shortfall / ramp) * max_pts
    return max(0.0, round(max_pts - penalty, 2))


def _soil_score(user_soil: str, crop_optimal_soil: str) -> tuple[float, bool]:
    """Returns (bonus_score, is_match). Bonus is 10 if soil matches, else 0."""
    compatible = SOIL_COMPATIBILITY.get(user_soil, [user_soil])
    match = crop_optimal_soil in compatible or user_soil == crop_optimal_soil
    return (10.0 if match else 0.0), match


def _status_label(score: float) -> str:
    if score >= 80:
        return "Excellent"
    elif score >= 60:
        return "Good"
    elif score >= 40:
        return "Fair"
    else:
        return "Poor"


def _generate_insights(
    crop_name: str,
    temp: float,
    humidity: float,
    rainfall: float,
    trait: CropTraitResponse,
    soil_match: bool,
    user_soil: str,
) -> list[str]:
    insights = []

    if temp < trait.optimal_temp_min:
        insights.append(
            f"🌡️ Temperature ({temp:.1f}°C) is below optimal range "
            f"({trait.optimal_temp_min}–{trait.optimal_temp_max}°C) for {crop_name}."
        )
    elif temp > trait.optimal_temp_max:
        insights.append(
            f"🔥 Temperature ({temp:.1f}°C) exceeds optimal range. "
            f"Heat stress risk for {crop_name}."
        )
    else:
        insights.append(f"✅ Temperature is ideal for {crop_name}.")

    if humidity < trait.optimal_humidity_min:
        insights.append(
            f"💧 Humidity ({humidity:.0f}%) is low; {crop_name} prefers "
            f"{trait.optimal_humidity_min}–{trait.optimal_humidity_max}%."
        )
    elif humidity > trait.optimal_humidity_max:
        insights.append(
            f"🌫️ Humidity ({humidity:.0f}%) is high; disease pressure may increase for {crop_name}."
        )
    else:
        insights.append(f"✅ Humidity is within optimal range for {crop_name}.")

    if rainfall < trait.optimal_rainfall_min:
        insights.append(
            f"🌵 Rainfall ({rainfall:.0f} mm/mo) is below what {crop_name} needs "
            f"({trait.optimal_rainfall_min}–{trait.optimal_rainfall_max} mm/mo). Irrigation advised."
        )
    elif rainfall > trait.optimal_rainfall_max:
        insights.append(
            f"🌧️ Rainfall ({rainfall:.0f} mm/mo) exceeds optimum. "
            f"Waterlogging risk for {crop_name}."
        )
    else:
        insights.append(f"✅ Rainfall is well-suited for {crop_name}.")

    if soil_match:
        insights.append(f"🌱 {user_soil} soil is well-matched for {crop_name}. +10 bonus points.")
    else:
        insights.append(
            f"⚠️ {user_soil} soil is not ideal for {crop_name} (prefers {trait.optimal_soil_type}). "
            f"Consider soil amendments."
        )

    return insights


def score_crop(weather: WeatherResponse, trait: CropTraitResponse, user_soil: str = "") -> CropScore:
    temp_score  = _linear_score(weather.temperature, trait.optimal_temp_min, trait.optimal_temp_max)
    hum_score   = _linear_score(weather.humidity,    trait.optimal_humidity_min, trait.optimal_humidity_max)
    rain_score  = _linear_score(weather.rainfall,    trait.optimal_rainfall_min, trait.optimal_rainfall_max)

    soil_pts, soil_match = _soil_score(user_soil, trait.optimal_soil_type) if user_soil else (0.0, False)

    total = min(100.0, round(temp_score + hum_score + rain_score + soil_pts, 1))

    insights = _generate_insights(
        trait.crop_name, weather.temperature, weather.humidity, weather.rainfall,
        trait, soil_match, user_soil or trait.optimal_soil_type,
    )

    return CropScore(
        crop_name=trait.crop_name,
        total_score=total,
        temperature_score=round(temp_score, 1),
        humidity_score=round(hum_score, 1),
        rainfall_score=round(rain_score, 1),
        soil_score=round(soil_pts, 1),
        soil_match=soil_match,
        status=_status_label(total),
        insights=insights,
    )


def score_all_crops(weather: WeatherResponse, traits: list[CropTraitResponse], user_soil: str = "") -> list[CropScore]:
    scores = [score_crop(weather, t, user_soil) for t in traits]
    return sorted(scores, key=lambda s: s.total_score, reverse=True)


def build_recommendation(scores: list[CropScore], weather: WeatherResponse, city: str = "the area") -> tuple[str, str, float]:
    if not scores:
        return "None", "No crop data available.", 0.0

    best   = scores[0]
    second = scores[1] if len(scores) > 1 else None

    if second and second.total_score > 0:
        gap   = best.total_score - second.total_score
        total = best.total_score + second.total_score
        confidence = round(min(100.0, 50 + (gap / total) * 100), 1)
    else:
        confidence = 75.0

    reason = (
        f"{best.crop_name} scores {best.total_score}/100 under current {city} conditions "
        f"(Temp: {weather.temperature}°C, Humidity: {weather.humidity}%, "
        f"Est. Rainfall: {weather.rainfall} mm/mo). "
        f"Status: {best.status}."
    )

    return best.crop_name, reason, confidence
