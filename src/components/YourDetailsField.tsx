import type { ChangeEvent, ReactNode } from "react";

type YourDetailsFieldProps = {
    children: ReactNode;
    type: string;
    value: string;
    onChange: (event: ChangeEvent<HTMLInputElement>, field: string) => void;
    detailsToChange: string;
    error?: string;
};

export function YourDetailsField({children, type, value, onChange, detailsToChange, error} : YourDetailsFieldProps) {
    return (
        <div>
            <label className="block mb-4">
                <span className="block text-sm font-medium mb-1">
                    {children}
                </span>
                <input data-cy={detailsToChange} type={type} className={`w-full border rounded p-2 ${error ? 'border-red-500' : 'border-gray-300'}`} value={value} onChange={(event) => onChange(event, detailsToChange)}></input>
                {error ?  <p data-cy={`${detailsToChange}-error`} className="text-sm text-red-600 mt-1">{error}</p> : ""}
            </label>
        </div>
    )
}