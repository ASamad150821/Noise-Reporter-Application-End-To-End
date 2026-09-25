import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';

export default function StartPage() {
  const navigate = useNavigate();

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Report noise in your area</h2>
      <p className="text-gray-700 mb-6">
        This short form helps us log a noise complaint. It takes about two minutes.
      </p>
      <Button onClick={() => navigate('/noise-type')}>Start report</Button>
    </div>
  );
}
