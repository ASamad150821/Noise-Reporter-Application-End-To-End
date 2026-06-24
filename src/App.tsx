import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Start from './Pages/Start';
import NoiseType from './Pages/NoiseType';
import NoiseDetails from './Pages/NoiseDetails';
import YourDetails from './Pages/YourDetails';
import Confirmation from './Pages/Confirmation';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Start></Start>}></Route>
        <Route path="/noise-type" element={<NoiseType></NoiseType>}></Route>
        <Route path="/noise-details" element={<NoiseDetails></NoiseDetails>}></Route>
        <Route path="/your-details" element={<YourDetails></YourDetails>}></Route>
        <Route path="/confirmation" element={<Confirmation></Confirmation>}></Route>
      </Routes>
    </BrowserRouter>
  );
}