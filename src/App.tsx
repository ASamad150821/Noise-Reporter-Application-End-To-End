import { BrowserRouter, Routes, Route } from 'react-router-dom';
import StartPage from './Pages/Start';
import NoiseTypePage from './Pages/NoiseType';
import NoiseDetailsPage from './Pages/NoiseDetails';
import YourDetailsPage from './Pages/YourDetails';
import ConfirmationPage from './Pages/Confirmation';

export default function App() {
  return (
    <BrowserRouter>
      <main className="max-w-xl mx-auto p-6">
        <Routes>
          <Route path="/" element={<StartPage />} />
          <Route path="/noise-type" element={<NoiseTypePage />} />
          <Route path="/noise-details" element={<NoiseDetailsPage />} />
          <Route path="/your-details" element={<YourDetailsPage />} />
          <Route path="/confirmation" element={<ConfirmationPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
