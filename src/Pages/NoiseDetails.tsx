import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { useNoiseStore } from "../store/useNoiseStore";
import type { ChangeEvent } from "react";

    const DURATIONS = [
  { value: 'under-hour', label: 'Less than an hour' },
  { value: 'hours', label: 'A few hours' },
  { value: 'days', label: 'Several days' },
  { value: 'weeks', label: 'Weeks or longer' },
    ];

export default function NoiseDetails() {

    const navigate = useNavigate();
    const howLong = useNoiseStore((state) => state.howLong);
    const setHowLong = useNoiseStore((state) => state.setHowLong)
    const description = useNoiseStore((state) => state.description);
    const setDescription = useNoiseStore((state) => state.setDescription);

    const canContinue = description.trim().length > 0 && howLong !== "";

    function handleOptionChange(event : ChangeEvent<HTMLSelectElement>) {
        console.log(howLong)
        setHowLong(event.target.value);
    }

    function handleDescriptionChange(event: ChangeEvent<HTMLTextAreaElement>) {
        console.log(description)
        setDescription(event.target.value)
    }

    function handleBackButton() {
        console.log('Back button was clicked! User has been navigated to the previous page.');
        navigate("/noise-type")
    }

    function handleContinueButton() {
        console.log('Continue button was clicked! User has been navigated to the next page.');
        navigate("/your-details")
    }

    return (
        <div>
            <h2 className="text-lg font-semibold mb-4">Tell us more about it</h2>

            <label className="block mb-4">
                <span className="block text-sm font-medium mb-1">
                    How Long Has It Been Happening?
                </span>
                <select data-cy="how-long" className="w-full border border-gray-300 rounded p-2" value={howLong} onChange={(event) => handleOptionChange(event)} >
                    <option value="">Choose An Option</option>
                    {
                        DURATIONS.map((duration, index) => {
                            return <option key={index} value={duration.value}>
                                {duration.label}
                            </option>
                        })
                    }
                </select>
            </label>

            <label className="block mb-6">
                <span className="block text-sm font-medium mb-1">
                    Describe The Noise
                </span>
                <textarea data-cy="description" className="w-full border border-gray-300 rounded p-2 h-32" placeholder="E.g. bass music from a flat above, every night after 11pm" 
                value={description} onChange={(event) => handleDescriptionChange(event)}>
                </textarea>
            </label>


            <div className="flex justify-between">
                <Button variant="secondary" onClick={handleBackButton}>Back</Button>
                <Button variant="primary" onClick={handleContinueButton} disabled={!canContinue}>Continue</Button>
            </div>
        </div>
    )
}