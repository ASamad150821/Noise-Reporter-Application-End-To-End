import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { useNoiseStore } from "../store/useNoiseStore";

const OPTIONS = [
  { value: "music", label: "Loud music" },
  { value: "construction", label: "Construction" },
  { value: "shouting", label: "Shouting / arguing" },
  { value: "other", label: "Something else" },
] as const;

export default function NoiseTypePage() {
  const navigate = useNavigate();
  const noiseType = useNoiseStore((state) => state.noiseType);
  const setNoiseType = useNoiseStore((state) => state.setNoiseType);

  const canContinue = noiseType !== "";

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">What kind of noise is it?</h2>

      <fieldset className="space-y-2 mb-6">
        {OPTIONS.map((option) => (
          <label key={option.value} className="flex items-center gap-3 p-3 border border-gray-200 rounded cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="noiseType"
              value={option.value}
              checked={noiseType === option.value}
              onChange={() => setNoiseType(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>

      <div className="flex justify-between">
        <Button variant="secondary" onClick={() => navigate("/")}>Back</Button>
        <Button variant="primary" onClick={() => navigate("/noise-details")} disabled={!canContinue}>Continue</Button>
      </div>
    </div>
  );
}
