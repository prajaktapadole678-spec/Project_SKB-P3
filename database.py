"""
Database setup using SQLAlchemy + SQLite.
Seeds Wheat and Soybean trait data on first run.
"""
import csv
import os
from pathlib import Path
from sqlalchemy import create_engine, Column, Integer, String, Float, Text
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = Path(__file__).parent
DATABASE_URL = f"sqlite:///{BASE_DIR / 'cropsense.db'}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class CropTrait(Base):
    __tablename__ = "crop_traits"

    id = Column(Integer, primary_key=True, index=True)
    crop_name = Column(String(50), unique=True, nullable=False, index=True)
    optimal_temp_min = Column(Float, nullable=False)
    optimal_temp_max = Column(Float, nullable=False)
    optimal_humidity_min = Column(Float, nullable=False)
    optimal_humidity_max = Column(Float, nullable=False)
    optimal_rainfall_min = Column(Float, nullable=False)
    optimal_rainfall_max = Column(Float, nullable=False)
    optimal_soil_type = Column(String(50), default="Loamy")
    drought_tolerance = Column(String(20), default="medium")
    heat_tolerance = Column(String(20), default="medium")
    frost_tolerance = Column(String(20), default="medium")
    description = Column(Text, default="")


def get_db():
    """Dependency: yields a DB session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def seed_database():
    """Seed default crop traits from CSV if the table is empty."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(CropTrait).count() == 0:
            csv_path = BASE_DIR / "crops_data.csv"
            if csv_path.exists():
                with open(csv_path, newline="", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
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
                db.commit()
                print("[CropSense] Database seeded with default crop traits.")
    finally:
        db.close()
