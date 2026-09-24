import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import {useNoiseStore, type NoiseType} from "../store/useNoiseStore"

export default function NoiseType() {

   const OPTIONS : {value: string, label: string}[] = [
    {value: "music", label: "Loud music"},
    {value: "construction", label: "Construction"},
    {value: "shouting", label: "Shouting / arguing"},
    {value: "other", label: "Something else"}
   ]

    const navigate = useNavigate();
    const noiseType = useNoiseStore((state) => state.noiseType);
    const setNoiseType = useNoiseStore((state) => state.setNoiseType);
    const canContinue = noiseType !== "";


   function handleBackButton() {
    console.log('Back button was clicked! User has been navigated to the previous page.');
    navigate("/")
   }

   function handleContinueButton() {
    console.log('Continue button was clicked! User has been navigated to the next page.');
    navigate("/noise-details")
   }

   
    return (
        <div>
            <h2 className="text-lg font-semibold mb-4">What kind of noise is it?</h2>

            <fieldset className="space-y-2 mb-6">
                {OPTIONS.map((opt) => {
                    return (
                        <label key={opt.value} className="flex items-center gap-3 p-3 border border-gray-200 rounded cursor-pointer hover:bg-gray-50">
                            <input type="radio" name="noiseType" value={opt.value} onChange={(event) => setNoiseType(event.target.value as NoiseType)} checked={noiseType===opt.value}></input>
                            <span>{opt.label}</span>
                        </label>
                    )
                })}
            </fieldset>

            <div className="flex justify-between">
                <Button variant="secondary" onClick={handleBackButton}>Back</Button>
                <Button variant="primary" onClick={handleContinueButton} disabled={!canContinue}>Continue</Button>
            </div>
        </div>
    )
}