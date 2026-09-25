import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import Button from "../components/Button";
import { YourDetailsField } from "../components/YourDetailsField";
import { yourDetailsSchema } from "../schemas/YourDetails";
import { useNoiseStore, type YourDetails } from "../store/useNoiseStore";

type FieldErrors = Partial<Record<keyof YourDetails, string>>;
type ReportResponse = { caseReference: string };

export default function YourDetailsPage() {
  const navigate = useNavigate();
  const yourDetails = useNoiseStore((state) => state.yourDetails);
  const setYourDetails = useNoiseStore((state) => state.setYourDetails);
  const setCaseReference = useNoiseStore((state) => state.setCaseReference);
  const noiseType = useNoiseStore((state) => state.noiseType);
  const howLong = useNoiseStore((state) => state.howLong);
  const description = useNoiseStore((state) => state.description);
  const [errors, setErrors] = useState<FieldErrors>({});

  const mutation = useMutation({
    mutationFn: async (details: YourDetails): Promise<ReportResponse> => {
      const res = await fetch('/api/submitCase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...details, noiseType, howLong, description }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      return res.json();
    },
    onSuccess: (data) => {
      setCaseReference(data.caseReference);
      navigate("/confirmation");
    },
  });

  function handleChange(field: keyof YourDetails, value: string) {
    setYourDetails({ ...yourDetails, [field]: value });
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit() {
    const result = yourDetailsSchema.safeParse(yourDetails);

    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof YourDetails;
        fieldErrors[field] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    mutation.mutate(yourDetails);
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Your Details</h2>
      <p className="text-sm text-gray-600 mb-4">We need these details so that we can contact you about the case</p>

      <YourDetailsField field="firstName" value={yourDetails.firstName} error={errors.firstName} onChange={handleChange}>First Name</YourDetailsField>
      <YourDetailsField field="lastName" value={yourDetails.lastName} error={errors.lastName} onChange={handleChange}>Last Name</YourDetailsField>
      <YourDetailsField field="email" type="email" value={yourDetails.email} error={errors.email} onChange={handleChange}>Email</YourDetailsField>

      {mutation.isError && (
        <p data-cy="submit-error" role="alert" className="text-sm text-red-600 mb-4">
          Something went wrong sending your report. Please try again.
        </p>
      )}

      <div className="flex justify-between">
        <Button variant="secondary" onClick={() => navigate("/noise-details")}>Back</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={mutation.isPending}>Submit</Button>
      </div>
    </div>
  );
}
