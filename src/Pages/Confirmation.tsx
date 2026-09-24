import { useNoiseStore } from "../store/useNoiseStore";

export default function Confirmation() {
    const caseReference = useNoiseStore((state) => state.caseReference);

    return (
        <div>
            <h2 className="text-lg font-semibold mb-4">Report Submitted</h2>
            <p className="text-sm text-gray-600 mb-2">Thank you for your report. We will be in touch.</p>
            {caseReference && (
                <p className="text-sm font-medium">
                    Your case reference: <span data-cy="case-reference" className="font-bold">{caseReference}</span>
                </p>
            )}
        </div>
    );
}
