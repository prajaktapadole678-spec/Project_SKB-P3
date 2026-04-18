import { useRef, useState } from 'react';
import { uploadCropCSV } from '../api/client';

export default function FileUpload({ onSuccess }) {
  const inputRef  = useRef();
  const [dragging, setDragging] = useState(false);
  const [status,   setStatus]   = useState(null); // null | 'loading' | 'success' | 'error'
  const [message,  setMessage]  = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setStatus('error');
      setMessage('Only .csv files are accepted.');
      return;
    }
    setStatus('loading');
    setMessage('');
    try {
      const res = await uploadCropCSV(file);
      setStatus('success');
      setMessage(`✅ Upload complete — ${res.created} created, ${res.updated} updated.`);
      onSuccess?.();
    } catch (err) {
      setStatus('error');
      setMessage(err.response?.data?.detail || 'Upload failed. Check CSV format.');
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div>
      <div
        className={`upload-zone ${dragging ? 'drag-over' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="upload-zone-icon">📂</div>
        <div className="upload-zone-text">
          {status === 'loading'
            ? 'Uploading...'
            : 'Click or drag a CSV file here to update crop traits'}
        </div>
        <div className="upload-zone-hint">
          Required columns: crop_name, optimal_temp_min, optimal_temp_max,
          optimal_humidity_min, optimal_humidity_max,
          optimal_rainfall_min, optimal_rainfall_max
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      {status === 'success' && (
        <div className="alert alert-success" style={{ marginTop: 12 }}>{message}</div>
      )}
      {status === 'error' && (
        <div className="alert alert-error" style={{ marginTop: 12 }}>❌ {message}</div>
      )}

      <div style={{ marginTop: 12 }}>
        <a
          href="/sample_crops.csv"
          download
          className="btn btn-secondary"
          style={{ fontSize: 12, padding: '6px 14px' }}
          onClick={(e) => {
            e.preventDefault();
            const content = `crop_name,optimal_temp_min,optimal_temp_max,optimal_humidity_min,optimal_humidity_max,optimal_rainfall_min,optimal_rainfall_max,drought_tolerance,heat_tolerance,frost_tolerance,description\nWheat,10,25,40,70,50,100,medium,low,high,Cool-season cereal crop\nSoybean,20,32,60,85,80,150,low,high,low,Warm-season legume\n`;
            const blob = new Blob([content], { type: 'text/csv' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url; a.download = 'sample_crops.csv'; a.click();
            URL.revokeObjectURL(url);
          }}
        >
          ⬇️ Download Sample CSV
        </a>
      </div>
    </div>
  );
}
