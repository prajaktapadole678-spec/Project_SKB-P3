import sqlite3
db=sqlite3.connect('cropsense.db')
try:
    db.execute("ALTER TABLE crop_traits ADD COLUMN optimal_soil_type VARCHAR(50) DEFAULT 'Loamy'")
except sqlite3.OperationalError:
    pass
db.execute("UPDATE crop_traits SET optimal_soil_type='Clay' WHERE crop_name LIKE '%Soybean%'")
db.commit()
print("Migration done")
