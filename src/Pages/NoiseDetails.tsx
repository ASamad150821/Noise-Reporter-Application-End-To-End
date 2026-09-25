import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { useNoiseStore } from "../store/useNoiseStore";

const DURATIONS = [
  { value: 'under-hour', label: 'Less than an hour' },
  { value: 'hours', label: 'A few hours' },
  { value: 'days', label: 'Several days' },
  { value: 'weeks', label: 'Weeks or longer' },
];

export default function NoiseDetailsPage() {
  const navigate = useNavigate();
  const howLong = useNoiseStore((state) => state.howLong);
  const setHowLong = useNoiseStore((state) => state.setHowLong);
  const description = useNoiseStore((state) => state.description);
  const setDescription = useNoiseStore((state) => state.setDescription);

  const canContinue = howLong !== "" && description.trim().length > 0;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Tell us more about it</h2>

      <label className="block mb-4">
        <span className="block text-sm font-medium mb-1">How Long Has It Been Happening?</span>
        <select
          data-cy="how-long"
          className="w-full border border-gray-300 rounded p-2"
          value={howLong}
          onChange={(event) => setHowLong(event.target.value)}
        >
          <option value="">Choose An Option</option>
          {DURATIONS.map((duration) => (
            <option key={duration.value} value={duration.value}>{duration.label}</option>
          ))}
        </select>
      </label>

      <label className="block mb-6">
        <span className="block text-sm font-medium mb-1">Describe The Noise</span>
        <textarea
          data-cy="description"
          className="w-full border border-gray-300 rounded p-2 h-32"
          placeholder="E.g. bass music from a flat above, every night after 11pm"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      <div className="flex justify-between">
        <Button variant="secondary" onClick={() => navigate("/noise-type")}>Back</Button>
        <Button variant="primary" onClick={() => navigate("/your-details")} disabled={!canContinue}>Continue</Button>
      </div>
    </div>
  );
}
