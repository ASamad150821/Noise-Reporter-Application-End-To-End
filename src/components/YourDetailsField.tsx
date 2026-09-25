import type { ReactNode } from "react";
import type { YourDetails } from "../store/useNoiseStore";

type YourDetailsFieldProps = {
  field: keyof YourDetails;
  type?: string;
  value: string;
  error?: string;
  onChange: (field: keyof YourDetails, value: string) => void;
  children: ReactNode;
};

export function YourDetailsField({ field, type = "text", value, error, onChange, children }: YourDetailsFieldProps) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium mb-1">{children}</span>
      <input
        data-cy={field}
        type={type}
        className={`w-full border rounded p-2 ${error ? 'border-red-500' : 'border-gray-300'}`}
        value={value}
        onChange={(event) => onChange(field, event.target.value)}
      />
      {error && <p data-cy={`${field}-error`} className="text-sm text-red-600 mt-1">{error}</p>}
    </label>
  );
}
