import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';


export default function Start() {

    const navigate = useNavigate();
    
    function handleClick() {
    console.log('Button was clicked! User has been navigated to the next page.');
    navigate('/noise-type');
    }

    return (
        <div>
            <h2 className="text-lg font-semibold mb-4">Report noise in your area</h2>
            <p className="text-gray-700 mb-6">
                This short form helps us log a noise complaint. It takes about two minutes.
            </p>
            <Button onClick={handleClick}>Start report</Button>
        </div>
    )
}