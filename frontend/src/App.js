import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ImagingPage from './pages/ImagingPage';
import SymptomSearchPage from './pages/SymptomSearchPage';
import MethodologyPage from './pages/MethodologyPage';
import AboutPage from './pages/AboutPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/imaging" element={<ImagingPage />} />
        <Route path="/symptoms" element={<SymptomSearchPage />} />
        <Route path="/methodology" element={<MethodologyPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
