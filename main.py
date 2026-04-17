"""
CropSense — FastAPI Backend
Endpoints:
  GET  /          Health check
  GET  /weather   Fetch live weather for Pune (or mock if no API key)
  GET  /crops     List all crop traits from SQLite
  POST /crops/upload  Upload CSV to update crop traits
  GET  /predict   Combine weather + traits → resilience scores + recommendation
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
from models import WeatherResponse, CropTraitResponse, PredictionResponse
from scoring import score_all_crops, build_recommendation

load_dotenv()

app = FastAPI(
    title="CropSense API",
    description="Weather-integrated crop resilience scoring for Wheat and Soybean in Pune",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CITY = os.getenv("CITY", "Pune")
API_KEY = os.getenv("OPENWEATHER_API_KEY", "").strip()
OWM_URL = "https://api.openweathermap.org/data/2.5/weather"

# ─── Startup ────────────────────────────────────────────────────────────────

@app.on_event("startup")
def startup_event():
    seed_database()
    print(f"🌱 CropSense API started. City: {CITY}. API key: {'set' if API_KEY else 'NOT SET (mock mode)'}.")


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {
        "service": "CropSense API",
        "status": "running",
        "city": CITY,
        "weather_mode": "live" if API_KEY else "mock",
        "timestamp": datetime.utcnow().isoformat(),
    }


# ─── Weather ─────────────────────────────────────────────────────────────────

def _mock_weather() -> WeatherResponse:
    """
    Returns realistic Pune weather data (seasonally varied by current month).
    April/May → hot & dry | Jun–Sep → monsoon humid | Oct–Feb → mild
    """
    month = datetime.now().month
    if month in (3, 4, 5):         # Pre-monsoon: hot & dry
        temp = round(random.uniform(32, 42), 1)
        humidity = round(random.uniform(20, 45), 1)
        rainfall = round(random.uniform(5, 30), 1)
        desc = "Hazy sunshine, hot and dry"
    elif month in (6, 7, 8, 9):    # Monsoon: warm & very humid
        temp = round(random.uniform(22, 30), 1)
        humidity = round(random.uniform(70, 95), 1)
        rainfall = round(random.uniform(100, 200), 1)
        desc = "Heavy monsoon showers, high humidity"
    elif month in (10, 11):        # Post-monsoon: pleasant
        temp = round(random.uniform(24, 32), 1)
        humidity = round(random.uniform(50, 70), 1)
        rainfall = round(random.uniform(10, 50), 1)
        desc = "Partly cloudy, pleasant"
    else:                          # Winter: cool & mild
        temp = round(random.uniform(12, 22), 1)
        humidity = round(random.uniform(35, 60), 1)
        rainfall = round(random.uniform(2, 15), 1)
        desc = "Clear skies, cool and comfortable"

    return WeatherResponse(
        city=CITY,
        temperature=temp,
        humidity=humidity,
        rainfall=rainfall,
        description=desc,
        feels_like=round(temp + random.uniform(-2, 3), 1),
        wind_speed=round(random.uniform(5, 25), 1),
        source="mock",
    )


async def _fetch_live_weather() -> WeatherResponse:
    params = {"q": CITY, "appid": API_KEY, "units": "metric"}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(OWM_URL, params=params)
    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"OpenWeatherMap API error {resp.status_code}: {resp.text}",
        )
    data = resp.json()
    # OWM gives rain.1h or rain.3h in mm; scale 3h → monthly estimate (~240h/month)
    rain_3h = data.get("rain", {}).get("3h", 0.0)
    monthly_est = round(rain_3h * (720 / 3), 1)   # rough monthly estimate
    # Clamp unreasonably high estimates for scoring purposes
    monthly_est = min(monthly_est, 300.0)

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


@app.get("/weather", response_model=WeatherResponse, tags=["Weather"])
async def get_weather():
    """
    Fetch current weather for Pune.
    Uses OpenWeatherMap if API key is set, otherwise returns mock data.
    """
    if API_KEY:
        return await _fetch_live_weather()
    return _mock_weather()


# ─── Crops ───────────────────────────────────────────────────────────────────

@app.get("/crops", response_model=list[CropTraitResponse], tags=["Crops"])
def list_crops(
    crop: Optional[str] = Query(None, description="Filter by crop name (e.g. Wheat)"),
    db: Session = Depends(get_db),
):
    """Return all crop trait records. Optionally filter by crop name."""
    query = db.query(CropTrait)
    if crop:
        query = query.filter(CropTrait.crop_name.ilike(f"%{crop}%"))
    results = query.all()
    if not results:
        raise HTTPException(status_code=404, detail="No crop traits found.")
    return results


@app.post("/crops/upload", tags=["Crops"])
async def upload_crop_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Upload a CSV file to update or add crop traits.
    Required columns: crop_name, optimal_temp_min, optimal_temp_max,
    optimal_humidity_min, optimal_humidity_max, optimal_rainfall_min, optimal_rainfall_max
    """
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
            existing.optimal_temp_min = float(row["optimal_temp_min"])
            existing.optimal_temp_max = float(row["optimal_temp_max"])
            existing.optimal_humidity_min = float(row["optimal_humidity_min"])
            existing.optimal_humidity_max = float(row["optimal_humidity_max"])
            existing.optimal_rainfall_min = float(row["optimal_rainfall_min"])
            existing.optimal_rainfall_max = float(row["optimal_rainfall_max"])
            existing.drought_tolerance = row.get("drought_tolerance", existing.drought_tolerance)
            existing.heat_tolerance = row.get("heat_tolerance", existing.heat_tolerance)
            existing.frost_tolerance = row.get("frost_tolerance", existing.frost_tolerance)
            existing.description = row.get("description", existing.description)
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
async def predict(db: Session = Depends(get_db)):
    """
    Combine live weather + stored crop traits to produce resilience scores
    and a crop recommendation for Pune.
    """
    # 1. Fetch weather
    if API_KEY:
        weather = await _fetch_live_weather()
    else:
        weather = _mock_weather()

    # 2. Load crop traits
    traits_db = db.query(CropTrait).all()
    if not traits_db:
        raise HTTPException(status_code=404, detail="No crop traits in database. Please upload CSV first.")

    traits = [CropTraitResponse.model_validate(t) for t in traits_db]

    # 3. Score
    scores = score_all_crops(weather, traits)

    # 4. Recommendation
    recommended, reason, confidence = build_recommendation(scores, weather)

    return PredictionResponse(
        city=CITY,
        weather=weather,
        scores=scores,
        recommended_crop=recommended,
        recommendation_reason=reason,
        confidence=confidence,
    )
