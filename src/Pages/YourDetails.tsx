import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { useNoiseStore, type YourDetails } from "../store/useNoiseStore";

type ReportResponse = { caseReference: string };
import { useState, type ChangeEvent } from "react";
import { YourDetailsField } from "../components/YourDetailsField";
import { yourDetailsSchema } from "../schemas/YourDetails";
import { ZodError } from "zod";
import { useMutation } from "@tanstack/react-query";

type FieldErrors = Partial<Record<'firstName' | 'lastName' | 'email', string>>;

export default function YourDetails() {

    let navigate = useNavigate();
    let yourDetails = useNoiseStore((state) => state.yourDetails);
    let setYourDetails = useNoiseStore((state) => state.setYourDetails);
    let setCaseReference = useNoiseStore((state) => state.setCaseReference);
    let noiseType = useNoiseStore((state) => state.noiseType);
    let howLong = useNoiseStore((state) => state.howLong);
    let description = useNoiseStore((state) => state.description);
    let [errors, setErrors] = useState<FieldErrors>({});

    let mutation = useMutation<ReportResponse, Error, YourDetails>({
        mutationFn: (formData) => fetch('/api/submitCase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...formData, noiseType, howLong, description }),
        }).then(res => {
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            return res.json();
        }),
        onSuccess: (data) => {
            setCaseReference(data.caseReference);
            navigate("/confirmation");
        },
        onError: () => console.log('Something went wrong.'),
    });


    function handleBackButton() {
        navigate("/noise-details")
    }

    function handleContinueButton() {
        try {
            yourDetailsSchema.parse(yourDetails);
            mutation.mutate(yourDetails)
        } catch (err) {
            if (err instanceof ZodError) {
                const fieldErrors: FieldErrors = {};
                for (const issue of err.issues) {
                    const field = issue.path[0] as keyof FieldErrors;
                    if (!fieldErrors[field]) fieldErrors[field] = issue.message;
                }
                setErrors(fieldErrors);
            }
        }
    }

    function handleDetailsChange(event : ChangeEvent<HTMLInputElement>, field : string) {
      setYourDetails({ ...yourDetails, [field]: event.target.value });
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }

    return (
        <div>
            <h2 className="text-lg font-semibold mb-4">Your Details</h2>
            <p className="text-sm text-gray-600 mb-4">We need these details so that we can contact you about the case</p>

            <YourDetailsField type="input" value={yourDetails.firstName} onChange={handleDetailsChange} detailsToChange="firstName" error={errors.firstName}>First Name</YourDetailsField>
            <YourDetailsField type="input" value={yourDetails.lastName} onChange={handleDetailsChange} detailsToChange="lastName" error={errors.lastName}>Last Name</YourDetailsField>
            <YourDetailsField type="input" value={yourDetails.email} onChange={handleDetailsChange} detailsToChange="email" error={errors.email}>Email</YourDetailsField>

            <div className="flex justify-between">
                <Button variant="secondary" onClick={handleBackButton}>Back</Button>
                <Button variant="primary" onClick={handleContinueButton} disabled={mutation.isPending}>Submit</Button>
            </div>
        </div>
    )
}