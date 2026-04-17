const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const dbPath = path.join(__dirname, 'cropsense.db');
const db = new sqlite3.Database(dbPath);

const initDb = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS crop_traits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        crop_name TEXT UNIQUE,
        optimal_temp_min REAL,
        optimal_temp_max REAL,
        optimal_humidity_min REAL,
        optimal_humidity_max REAL,
        optimal_rainfall_min REAL,
        optimal_rainfall_max REAL,
        drought_tolerance TEXT,
        heat_tolerance TEXT,
        frost_tolerance TEXT,
        description TEXT
      )`);

      db.get('SELECT COUNT(*) as count FROM crop_traits', (err, row) => {
        if (err) return reject(err);
        if (row.count === 0) {
          const results = [];
          fs.createReadStream(path.join(__dirname, 'crops_data.csv'))
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => {
              const stmt = db.prepare(`INSERT INTO crop_traits (
                crop_name, optimal_temp_min, optimal_temp_max, optimal_humidity_min, optimal_humidity_max,
                optimal_rainfall_min, optimal_rainfall_max, drought_tolerance, heat_tolerance, frost_tolerance, description
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
              results.forEach(row => {
                stmt.run(
                  row.crop_name.trim(), parseFloat(row.optimal_temp_min), parseFloat(row.optimal_temp_max),
                  parseFloat(row.optimal_humidity_min), parseFloat(row.optimal_humidity_max),
                  parseFloat(row.optimal_rainfall_min), parseFloat(row.optimal_rainfall_max),
                  row.drought_tolerance || 'medium', row.heat_tolerance || 'medium', row.frost_tolerance || 'medium',
                  row.description || ''
                );
              });
              stmt.finalize();
              resolve();
            });
        } else {
          resolve();
        }
      });
    });
  });
};

const getCrops = (cropName = null) => {
  return new Promise((resolve, reject) => {
    let query = 'SELECT * FROM crop_traits';
    let params = [];
    if (cropName) {
      query += ' WHERE crop_name LIKE ?';
      params.push(`%${cropName}%`);
    }
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const upsertCrop = (row) => {
  return new Promise((resolve) => {
    db.get('SELECT id FROM crop_traits WHERE crop_name = ?', [row.crop_name.trim()], (err, existing) => {
      if (existing) {
        db.run(`UPDATE crop_traits SET 
          optimal_temp_min = ?, optimal_temp_max = ?, optimal_humidity_min = ?, optimal_humidity_max = ?,
          optimal_rainfall_min = ?, optimal_rainfall_max = ?, drought_tolerance = ?, heat_tolerance = ?, frost_tolerance = ?, description = ?
          WHERE crop_name = ?`, [
            parseFloat(row.optimal_temp_min), parseFloat(row.optimal_temp_max),
            parseFloat(row.optimal_humidity_min), parseFloat(row.optimal_humidity_max),
            parseFloat(row.optimal_rainfall_min), parseFloat(row.optimal_rainfall_max),
            row.drought_tolerance || 'medium', row.heat_tolerance || 'medium', row.frost_tolerance || 'medium',
            row.description || '', row.crop_name.trim()
          ], () => resolve('updated'));
        } else {
        db.run(`INSERT INTO crop_traits (
            crop_name, optimal_temp_min, optimal_temp_max, optimal_humidity_min, optimal_humidity_max,
            optimal_rainfall_min, optimal_rainfall_max, drought_tolerance, heat_tolerance, frost_tolerance, description
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            row.crop_name.trim(), parseFloat(row.optimal_temp_min), parseFloat(row.optimal_temp_max),
            parseFloat(row.optimal_humidity_min), parseFloat(row.optimal_humidity_max),
            parseFloat(row.optimal_rainfall_min), parseFloat(row.optimal_rainfall_max),
            row.drought_tolerance || 'medium', row.heat_tolerance || 'medium', row.frost_tolerance || 'medium',
            row.description || ''
          ], () => resolve('created'));
      }
    });
  });
};

module.exports = { initDb, getCrops, upsertCrop };
