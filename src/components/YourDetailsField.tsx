export function YourDetailsField({children, type, value, onChange, detailsToChange, error}) {
    return (
        <div>
            <label className="block mb-4">
                <span className="block text-sm font-medium mb-1">
                    {children}
                </span>
                <input type={type} className={`w-full border rounded p-2 ${error ? 'border-red-500' : 'border-gray-300'}`} value={value} onChange={(event) => onChange(event, detailsToChange)}></input>
                {error ?  <p className="text-sm text-red-600 mt-1">{error}</p> : ""}
            </label>
        </div>
    )
}