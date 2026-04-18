"""
CropSense — FastAPI Backend
Endpoints:
  GET  /          Health check
  GET  /weather   Fetch live weather for a city (Pune default; or mock if no API key)
  GET  /crops     List all crop traits from SQLite
  POST /crops/upload  Upload CSV to update crop traits
  GET  /predict   Combine weather + traits → resilience scores + recommendation
  GET  /scenario  User scenario: city + soil_type + target_crop → auto comparison
"""
import csv
import io
import os
import random
from datetime import datetime
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import CropTrait, get_db, seed_database
from models import WeatherResponse, CropTraitResponse, PredictionResponse, ScenarioResponse
from scoring import score_all_crops, build_recommendation

load_dotenv()

app = FastAPI(
    title="CropSense API",
    description="Weather-integrated crop resilience scoring for Wheat and Soybean",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_CITY = os.getenv("CITY", "Pune")
API_KEY = os.getenv("OPENWEATHER_API_KEY", "").strip()
OWM_URL = "https://api.openweathermap.org/data/2.5/weather"

ALLOWED_CITIES = ["Pune", "Nagpur"]

# ─── Startup ────────────────────────────────────────────────────────────────

@app.on_event("startup")
def startup_event():
    seed_database()
    print(f"[CropSense] API v2 started. Default City: {DEFAULT_CITY}. API key: {'set' if API_KEY else 'NOT SET (mock mode)'}.")


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {
        "service": "CropSense API",
        "status": "running",
        "supported_cities": ALLOWED_CITIES,
        "weather_mode": "live" if API_KEY else "mock",
        "timestamp": datetime.utcnow().isoformat(),
    }


# ─── Weather ─────────────────────────────────────────────────────────────────

NAGPUR_OFFSETS = {"temp": 2.5, "humidity": -5, "rainfall": -10}

def _mock_weather(city: str = "Pune") -> WeatherResponse:
    """Returns realistic weather data varied by season and city."""
    month = datetime.now().month
    if month in (3, 4, 5):
        temp     = round(random.uniform(32, 42), 1)
        humidity = round(random.uniform(20, 45), 1)
        rainfall = round(random.uniform(5, 30), 1)
        desc     = "Hazy sunshine, hot and dry"
    elif month in (6, 7, 8, 9):
        temp     = round(random.uniform(22, 30), 1)
        humidity = round(random.uniform(70, 95), 1)
        rainfall = round(random.uniform(100, 200), 1)
        desc     = "Heavy monsoon showers, high humidity"
    elif month in (10, 11):
        temp     = round(random.uniform(24, 32), 1)
        humidity = round(random.uniform(50, 70), 1)
        rainfall = round(random.uniform(10, 50), 1)
        desc     = "Partly cloudy, pleasant"
    else:
        temp     = round(random.uniform(12, 22), 1)
        humidity = round(random.uniform(35, 60), 1)
        rainfall = round(random.uniform(2, 15), 1)
        desc     = "Clear skies, cool and comfortable"

    # Nagpur is slightly hotter and drier than Pune
    if city.lower() == "nagpur":
        temp     = round(min(temp + NAGPUR_OFFSETS["temp"], 48), 1)
        humidity = round(max(humidity + NAGPUR_OFFSETS["humidity"], 10), 1)
        rainfall = round(max(rainfall + NAGPUR_OFFSETS["rainfall"], 0), 1)

    return WeatherResponse(
        city=city,
        temperature=temp,
        humidity=humidity,
        rainfall=rainfall,
        description=desc,
        feels_like=round(temp + random.uniform(-2, 3), 1),
        wind_speed=round(random.uniform(5, 25), 1),
        source="mock",
    )


async def _fetch_live_weather(city: str) -> WeatherResponse:
    params = {"q": city, "appid": API_KEY, "units": "metric"}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(OWM_URL, params=params)
    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"OpenWeatherMap API error {resp.status_code}: {resp.text}",
        )
    data = resp.json()
    rain_3h    = data.get("rain", {}).get("3h", 0.0)
    monthly_est = min(round(rain_3h * (720 / 3), 1), 300.0)

    return WeatherResponse(
        city=data["name"],
        temperature=data["main"]["temp"],
        humidity=data["main"]["humidity"],
        rainfall=monthly_est,
        description=data["weather"][0]["description"].capitalize(),
        feels_like=data["main"]["feels_like"],
        wind_speed=data["wind"]["speed"],
        source="live",
    )


async def _get_weather(city: str) -> WeatherResponse:
    if API_KEY:
        return await _fetch_live_weather(city)
    return _mock_weather(city)


@app.get("/weather", response_model=WeatherResponse, tags=["Weather"])
async def get_weather(city: str = Query(DEFAULT_CITY, description="City name: Pune or Nagpur")):
    """Fetch current weather for the specified city."""
    return await _get_weather(city)


# ─── Crops ───────────────────────────────────────────────────────────────────

@app.get("/crops", response_model=list[CropTraitResponse], tags=["Crops"])
def list_crops(
    crop: Optional[str] = Query(None, description="Filter by crop name"),
    db: Session = Depends(get_db),
):
    query = db.query(CropTrait)
    if crop:
        query = query.filter(CropTrait.crop_name.ilike(f"%{crop}%"))
    results = query.all()
    if not results:
        raise HTTPException(status_code=404, detail="No crop traits found.")
    return results


@app.post("/crops/upload", tags=["Crops"])
async def upload_crop_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    contents = await file.read()
    text = contents.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))

    required_cols = {
        "crop_name", "optimal_temp_min", "optimal_temp_max",
        "optimal_humidity_min", "optimal_humidity_max",
        "optimal_rainfall_min", "optimal_rainfall_max",
    }
    if not required_cols.issubset(set(reader.fieldnames or [])):
        raise HTTPException(
            status_code=422,
            detail=f"CSV must contain columns: {', '.join(sorted(required_cols))}",
        )

    updated, created = 0, 0
    for row in reader:
        existing = db.query(CropTrait).filter_by(crop_name=row["crop_name"].strip()).first()
        if existing:
            existing.optimal_temp_min     = float(row["optimal_temp_min"])
            existing.optimal_temp_max     = float(row["optimal_temp_max"])
            existing.optimal_humidity_min = float(row["optimal_humidity_min"])
            existing.optimal_humidity_max = float(row["optimal_humidity_max"])
            existing.optimal_rainfall_min = float(row["optimal_rainfall_min"])
            existing.optimal_rainfall_max = float(row["optimal_rainfall_max"])
            existing.optimal_soil_type    = row.get("optimal_soil_type", existing.optimal_soil_type)
            existing.drought_tolerance    = row.get("drought_tolerance",  existing.drought_tolerance)
            existing.heat_tolerance       = row.get("heat_tolerance",     existing.heat_tolerance)
            existing.frost_tolerance      = row.get("frost_tolerance",    existing.frost_tolerance)
            existing.description          = row.get("description",        existing.description)
            updated += 1
        else:
            trait = CropTrait(
                crop_name=row["crop_name"].strip(),
                optimal_temp_min=float(row["optimal_temp_min"]),
                optimal_temp_max=float(row["optimal_temp_max"]),
                optimal_humidity_min=float(row["optimal_humidity_min"]),
                optimal_humidity_max=float(row["optimal_humidity_max"]),
                optimal_rainfall_min=float(row["optimal_rainfall_min"]),
                optimal_rainfall_max=float(row["optimal_rainfall_max"]),
                optimal_soil_type=row.get("optimal_soil_type", "Loamy"),
                drought_tolerance=row.get("drought_tolerance", "medium"),
                heat_tolerance=row.get("heat_tolerance", "medium"),
                frost_tolerance=row.get("frost_tolerance", "medium"),
                description=row.get("description", ""),
            )
            db.add(trait)
            created += 1

    db.commit()
    return {"message": "Upload successful", "created": created, "updated": updated}


# ─── Predict ─────────────────────────────────────────────────────────────────

@app.get("/predict", response_model=PredictionResponse, tags=["Predict"])
async def predict(
    city: str = Query(DEFAULT_CITY, description="City: Pune or Nagpur"),
    db: Session = Depends(get_db),
):
    weather    = await _get_weather(city)
    traits_db  = db.query(CropTrait).all()
    if not traits_db:
        raise HTTPException(status_code=404, detail="No crop traits in database.")

    traits = [CropTraitResponse.model_validate(t) for t in traits_db]
    scores = score_all_crops(weather, traits)
    recommended, reason, confidence = build_recommendation(scores, weather, city)

    return PredictionResponse(
        city=city,
        weather=weather,
        scores=scores,
        recommended_crop=recommended,
        recommendation_reason=reason,
        confidence=confidence,
    )


# ─── Scenario ────────────────────────────────────────────────────────────────

@app.get("/scenario", response_model=ScenarioResponse, tags=["Scenario"])
async def scenario(
    city:        str = Query(DEFAULT_CITY, description="City: Pune or Nagpur"),
    soil_type:   str = Query("Loamy",      description="Soil type: Loamy, Clay, Sandy, Silty"),
    target_crop: str = Query(...,          description="Target crop name to evaluate"),
    db: Session = Depends(get_db),
):
    """
    Run a 'what-if' scenario for a given city, soil type, and target crop.
    Returns the target crop's score plus full comparison against all other crops.
    """
    weather   = await _get_weather(city)
    traits_db = db.query(CropTrait).all()
    if not traits_db:
        raise HTTPException(status_code=404, detail="No crop traits in database.")

    traits = [CropTraitResponse.model_validate(t) for t in traits_db]
    scores = score_all_crops(weather, traits, user_soil=soil_type)
    recommended, reason, confidence = build_recommendation(scores, weather, city)

    # Find target crop score
    target_score = next((s for s in scores if s.crop_name.lower() == target_crop.lower()), None)
    if target_score is None:
        raise HTTPException(status_code=404, detail=f"Crop '{target_crop}' not found. Available: {[t.crop_name for t in traits]}")

    # Best alternative = top scoring crop that isn't the target
    best_alternative = next((s for s in scores if s.crop_name.lower() != target_crop.lower()), None)

    return ScenarioResponse(
        city=city,
        soil_type=soil_type,
        target_crop=target_crop,
        weather=weather,
        scores=scores,
        recommended_crop=recommended,
        recommendation_reason=reason,
        confidence=confidence,
        target_score=target_score,
        best_alternative=best_alternative,
    )
