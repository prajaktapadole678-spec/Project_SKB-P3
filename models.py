"""
Pydantic models for request/response validation.
"""
from pydantic import BaseModel, Field
from typing import Optional


class WeatherResponse(BaseModel):
    city: str
    temperature: float = Field(..., description="Temperature in °C")
    humidity: float = Field(..., description="Relative humidity in %")
    rainfall: float = Field(..., description="Rainfall in mm (last 3h, scaled to monthly estimate)")
    description: str
    feels_like: float
    wind_speed: float
    source: str = Field(default="live", description="'live' or 'mock'")


class CropTraitResponse(BaseModel):
    id: int
    crop_name: str
    optimal_temp_min: float
    optimal_temp_max: float
    optimal_humidity_min: float
    optimal_humidity_max: float
    optimal_rainfall_min: float
    optimal_rainfall_max: float
    drought_tolerance: str
    heat_tolerance: str
    frost_tolerance: str
    description: str

    class Config:
        from_attributes = True


class CropScore(BaseModel):
    crop_name: str
    total_score: float = Field(..., description="Overall resilience score 0–100")
    temperature_score: float = Field(..., description="Temperature suitability score 0–33.3")
    humidity_score: float = Field(..., description="Humidity suitability score 0–33.3")
    rainfall_score: float = Field(..., description="Rainfall suitability score 0–33.3")
    status: str = Field(..., description="Excellent / Good / Fair / Poor")
    insights: list[str] = Field(default_factory=list)


class PredictionResponse(BaseModel):
    city: str
    weather: WeatherResponse
    scores: list[CropScore]
    recommended_crop: str
    recommendation_reason: str
    confidence: float = Field(..., description="Confidence % of recommendation 0–100")
