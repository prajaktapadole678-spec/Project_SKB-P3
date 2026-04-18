import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import CropComparison from './pages/CropComparison';
import Recommendation from './pages/Recommendation';

export default function App() {
  const [city, setCity] = useState(() => localStorage.getItem('app-city') || 'Pune');

  const handleCityChange = (newCity) => {
    setCity(newCity);
    localStorage.setItem('app-city', newCity);
  };

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Navbar city={city} onCityChange={handleCityChange} />
        <main className="main-content">
          <Routes>
            <Route path="/"          element={<Dashboard     city={city} />} />
            <Route path="/compare"   element={<CropComparison city={city} />} />
            <Route path="/recommend" element={<Recommendation city={city} />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
