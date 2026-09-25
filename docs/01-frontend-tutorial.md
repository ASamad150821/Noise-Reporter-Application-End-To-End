# Part 1: Building the Noise Reporter front end

This is the first of three tutorials that rebuild the Noise Reporter from an empty folder:

1. **Front end** (this document): the React pages the customer clicks through
2. [Back end](02-backend-tutorial.md): the Express server that stores each report
3. [Cypress tests](03-cypress-tutorial.md): end-to-end tests for the whole thing

By the end of this part you will have a five-page form that remembers the user's answers, validates their details and sends everything to `/api/submitCase`. That endpoint doesn't exist until Part 2, so for now submitting will show an error message. That's expected.

> **Convention used in all three tutorials:** a heading like 📄 **`src/App.tsx`** followed by a code block means *create this file with exactly this content* (or replace it completely if it already exists). Short snippets without that heading are for explanation only.

---

## 0. What you're building

The customer moves through five pages:

```
 /                 /noise-type          /noise-details          /your-details           /confirmation
┌────────────┐    ┌───────────────┐    ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Report     │    │ What kind of  │    │ How long?  [▼]  │    │ First name       │    │ Report Submitted │
│ noise in   │ →  │ noise is it?  │ →  │ Describe it     │ →  │ Last name        │ →  │                  │
│ your area  │    │ ( ) Music ... │    │ [            ]  │    │ Email            │    │ Ref: NR-1A2B3C4D │
│ [Start]    │    │ [Back][Cont.] │    │ [Back][Cont.]   │    │ [Back][Submit]   │    │                  │
└────────────┘    └───────────────┘    └─────────────────┘    └──────────────────┘    └──────────────────┘
                                                                        │ POST /api/submitCase
                                                                        ▼
                                                               Express server (Part 2)
```

| Route | Page | Rule |
|---|---|---|
| `/` | Start | Intro text and a **Start report** button |
| `/noise-type` | Noise type | Four radio buttons. **Continue** is disabled until one is chosen |
| `/noise-details` | Noise details | "How long" dropdown and a description. **Continue** needs both, and a description of only spaces doesn't count |
| `/your-details` | Your details | First name, last name and email, validated on **Submit**. Valid details are sent to the API |
| `/confirmation` | Confirmation | Shows the case reference the API returned |

**The tools and why each one is here**

| Tool | Job in this app |
|---|---|
| **Vite** | Dev server and build tool. Starts instantly and reloads on save |
| **React + TypeScript** | The UI, with types that catch mistakes before the browser does |
| **React Router** | Gives every page its own URL |
| **Zustand** | A small global store, so answers from page 2 are still available on page 4 |
| **Zustand `persist`** | Saves the store to `localStorage`, so a page refresh doesn't wipe the form |
| **Zod** | Describes what valid details look like and produces the error messages |
| **TanStack Query** | Runs the submit request and tracks its loading and error states for us |
| **Tailwind CSS** | Styling with utility classes, so no separate CSS files are needed |

---

## 1. Prerequisites

- **Node.js 22 or newer** (`node --version`). Vite 8 needs at least 20.19. The CI in Part 3 uses Node 24.
- A code editor. VS Code with the ESLint and Tailwind CSS IntelliSense extensions works well.
- Basic React knowledge: components, props, `useState`.

---

## 2. Create the project

```bash
npm create vite@latest noise-reporter -- --template react-ts
cd noise-reporter
npm install
```

Then install the libraries the app uses:

```bash
npm install react-router-dom zustand @tanstack/react-query zod
npm install -D tailwindcss@3 postcss autoprefixer
```

> **Why `tailwindcss@3`?** Tailwind 4 uses a different setup (no config file, a Vite plugin instead of PostCSS). This app uses Tailwind 3, so pin the version to make the steps below work exactly as written.

Start the dev server to check that everything works:

```bash
npm run dev
```

Open http://localhost:5173 and you should see the Vite + React starter page. Leave the server running. It reloads automatically as you work.

---

## 3. Clear out the starter code

The template comes with a demo counter that we don't need. Delete these files:

```bash
rm src/App.css
rm -r src/assets
```

The other generated files (`src/App.tsx`, `src/index.css`, `index.html`) will be replaced in the steps below. By the end the `src` folder will look like this:

```
src/
  main.tsx                     ← boots React, wraps the app in providers
  App.tsx                      ← the list of routes
  index.css                    ← Tailwind directives
  components/
    Button.tsx                 ← shared button with primary/secondary styles
    YourDetailsField.tsx       ← one labelled text input with an error message
  Pages/
    Start.tsx
    NoiseType.tsx
    NoiseDetails.tsx
    YourDetails.tsx
    Confirmation.tsx
  schemas/
    YourDetails.ts             ← Zod validation rules
  store/
    useNoiseStore.ts           ← all form answers, persisted to localStorage
```

Create the empty folders now:

```bash
mkdir -p src/components src/Pages src/schemas src/store
```

Give the browser tab a proper title:

📄 **`index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mini Noise Reporter</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## 4. Set up Tailwind CSS

Tailwind scans your files for class names like `text-lg` and generates only the CSS you use. It needs two config files.

📄 **`tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

`content` tells Tailwind where to look for class names. If a class isn't styled, check that its file matches this pattern.

📄 **`postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

Vite finds this file automatically and runs Tailwind (and Autoprefixer, which adds vendor prefixes) on your CSS.

Replace all of the template's CSS with Tailwind's three layers:

📄 **`src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## 5. A shared Button component

Every page has at least one button, and they all look the same: blue for the main action and grey for "Back". Build it once.

📄 **`src/components/Button.tsx`**

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
  children: ReactNode;
};

export default function Button({ variant = 'primary', className = '', disabled, children, ...rest }: ButtonProps) {
  const base =
    'px-4 py-2 rounded font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';

  const styles =
    variant === 'primary'
      ? 'bg-blue-600 text-white hover:bg-blue-700'
      : 'bg-gray-200 text-gray-800 hover:bg-gray-300';

  return (
    <button className={`${base} ${styles} ${className}`} disabled={disabled} {...rest}>
      {children}
    </button>
  );
}
```

How it works:

- `ButtonHTMLAttributes<HTMLButtonElement>` means the component accepts every prop a normal `<button>` accepts (`onClick`, `type`, `disabled`…), plus our own `variant`.
- `...rest` collects the props we didn't name and passes them on to the real `<button>`.
- The `disabled:` prefix is a Tailwind *variant*: `disabled:opacity-50` only applies while the button is disabled.

> ⚠️ **A real bug from the original build:** `disabled` is pulled out of the props by name, so it is **not** in `...rest`. The first version forgot `disabled={disabled}` on the `<button>`, so every Continue and Submit button in the app could always be clicked. ESLint warned about it (`'disabled' is defined but never used`), and the Cypress tests in Part 3 caught it. Whenever you destructure a prop by name, make sure you use it.

---

## 6. The store: one place for every answer

Each page collects part of the report, but only the last page sends it. The answers need to live somewhere every page can reach. That's what a global store is for.

📄 **`src/store/useNoiseStore.ts`**

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NoiseType = "music" | "construction" | "shouting" | "other" | "";

export type YourDetails = {
  firstName: string;
  lastName: string;
  email: string;
};

const emptyDetails: YourDetails = {
  firstName: "",
  lastName: "",
  email: "",
};

type NoiseStore = {
  noiseType: NoiseType;
  howLong: string;
  description: string;
  yourDetails: YourDetails;
  caseReference: string;

  setNoiseType: (noiseType: NoiseType) => void;
  setHowLong: (howLong: string) => void;
  setDescription: (description: string) => void;
  setYourDetails: (yourDetails: YourDetails) => void;
  setCaseReference: (caseReference: string) => void;
  reset: () => void;
};

export const useNoiseStore = create<NoiseStore>()(
  persist(
    (set) => ({
      noiseType: '',
      howLong: '',
      description: '',
      yourDetails: emptyDetails,
      caseReference: '',

      setNoiseType: (noiseType) => set({ noiseType }),
      setHowLong: (howLong) => set({ howLong }),
      setDescription: (description) => set({ description }),
      setYourDetails: (yourDetails) => set({ yourDetails }),
      setCaseReference: (caseReference) => set({ caseReference }),
      reset: () =>
        set({
          noiseType: '',
          howLong: '',
          description: '',
          yourDetails: emptyDetails,
          caseReference: '',
        }),
    }),
    { name: 'mini-noise-reporter-storage' },
  ),
);
```

Key ideas:

- **State and actions sit together.** `noiseType` is the value and `setNoiseType` changes it. `set({ noiseType })` merges that one field into the store and leaves the rest alone.
- **Components pick only what they need:** `useNoiseStore((state) => state.noiseType)`. The component re-renders only when *that* value changes.
- **`persist` saves the store to `localStorage`** under the key `mini-noise-reporter-storage`. Refresh the page halfway through the form and the answers are still there. Part 3 relies on this key to put the app into a known state before each test.
- `NoiseType` is a *union type*: TypeScript won't let you store `"musc"` by mistake. `""` means "nothing chosen yet".

---

## 7. Routing and providers

📄 **`src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import StartPage from './Pages/Start';
import NoiseTypePage from './Pages/NoiseType';
import NoiseDetailsPage from './Pages/NoiseDetails';
import YourDetailsPage from './Pages/YourDetails';
import ConfirmationPage from './Pages/Confirmation';

export default function App() {
  return (
    <BrowserRouter>
      <main className="max-w-xl mx-auto p-6">
        <Routes>
          <Route path="/" element={<StartPage />} />
          <Route path="/noise-type" element={<NoiseTypePage />} />
          <Route path="/noise-details" element={<NoiseDetailsPage />} />
          <Route path="/your-details" element={<YourDetailsPage />} />
          <Route path="/confirmation" element={<ConfirmationPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
```

- `BrowserRouter` keeps the URL in the address bar in sync with the page shown.
- Each `Route` maps a path to a page component. The `<main>` wrapper centres every page and caps its width.
- The page components end in `Page` (for example `NoiseTypePage`) so their names don't clash with the `NoiseType` and `YourDetails` *types* from the store.

📄 **`src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
```

`QueryClientProvider` makes TanStack Query available to every component. We use it on the Your details page to send the report.

The app won't compile until the five pages exist, so create them next.

---

## 8. Page 1: Start

📄 **`src/Pages/Start.tsx`**

```tsx
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';

export default function StartPage() {
  const navigate = useNavigate();

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Report noise in your area</h2>
      <p className="text-gray-700 mb-6">
        This short form helps us log a noise complaint. It takes about two minutes.
      </p>
      <Button onClick={() => navigate('/noise-type')}>Start report</Button>
    </div>
  );
}
```

`useNavigate()` returns a function that changes the route in code. Use it when navigation happens as a result of an action (a click) rather than a plain link.

---

## 9. Page 2: Noise type

📄 **`src/Pages/NoiseType.tsx`**

```tsx
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
```

Things to notice:

- **Controlled inputs.** Each radio's `checked` comes from the store and `onChange` writes back to it. The store is the single source of truth, so the choice survives Back/Continue and page reloads.
- **`as const`** makes TypeScript treat `option.value` as the exact literal (`"music"`, not just `string`), so it can be passed straight to `setNoiseType`, which only accepts a `NoiseType`.
- **Radios share a `name`.** That's what makes the browser allow only one to be selected.
- **Derived state.** `canContinue` is calculated on every render, not stored. Never store a value you can calculate.
- Wrapping each input in its `<label>` makes the whole row clickable.

> 🐛 **Another bug from the original build:** Back first navigated to `"/noise-type"`, the page you're already on, so clicking it did nothing. Check each Back button goes to the *previous* page.

---

## 10. Page 3: Noise details

📄 **`src/Pages/NoiseDetails.tsx`**

```tsx
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
```

Things to notice:

- The first `<option value="">` is a placeholder. Because its value is `""`, "nothing chosen" and "placeholder shown" are the same state.
- The dropdown shows a friendly label but stores a short code (`'under-hour'`). Store codes, not display text, so you can reword a label without breaking the data.
- `description.trim()` stops someone continuing with a description of only spaces.
- **`data-cy` attributes** have no effect on how the page looks or works. They give the Cypress tests in Part 3 a stable way to find these fields. We add them to every input as we build it, so we don't have to come back later.

---

## 11. Page 4: Your details

This is the page with the most going on. It's built from three parts: validation rules, a reusable input and the page itself.

### 11a. Validation rules with Zod

📄 **`src/schemas/YourDetails.ts`**

```ts
import { z } from 'zod';

export const yourDetailsSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.email('Enter a valid email address'),
});
```

A schema describes valid data. `yourDetailsSchema.safeParse(data)` returns either `{ success: true }` or `{ success: false, error }`, where `error.issues` lists every problem with its field (`path`) and its `message`. The strings passed to `min(1, ...)` and `email(...)` are the messages the user will see.

### 11b. A reusable labelled input

The page has three inputs with the same layout: label, input and optional error. Build that once.

📄 **`src/components/YourDetailsField.tsx`**

```tsx
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
```

- `keyof YourDetails` means `field` can only be `"firstName" | "lastName" | "email"`. A typo becomes a compile error.
- The field name also produces the test IDs: `data-cy="email"` for the input and `data-cy="email-error"` for its message.
- The border turns red when there's an error.

### 11c. The page

📄 **`src/Pages/YourDetails.tsx`**

```tsx
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
```

Walk through what happens when the user clicks **Submit**:

1. **Validate.** `safeParse` checks the details against the schema. If there are problems, we build a `{ field: message }` object from `error.issues` and store it in local state. `??=` keeps only the *first* message for each field. Then we stop.
2. **Send.** If the details are valid, `mutation.mutate(yourDetails)` runs `mutationFn`, which POSTs the details *plus* the answers from the previous two pages (read from the store) as one JSON object.
3. **Loading.** While the request is in flight, `mutation.isPending` is `true`, so Submit is disabled. That stops double submissions.
4. **Success.** `onSuccess` receives the parsed JSON (`{ caseReference }`), saves it in the store and moves to the confirmation page.
5. **Failure.** `fetch` only rejects on network errors, not on HTTP 500. That's why we check `res.ok` and throw ourselves. A thrown error sets `mutation.isError`, which shows the red message. The user stays on the page with their details intact and can try again.

Two smaller details:

- **Errors clear as you type.** `handleChange` removes that field's error as soon as the field is edited. The user gets feedback on *submit*, not on every keystroke, and the red border disappears once they start fixing it.
- **Why `useState` for errors but the store for the details?** Errors only matter on this page while it's open. The details must survive reloads and navigation. Keep state as local as it can be.

---

## 12. Page 5: Confirmation

📄 **`src/Pages/Confirmation.tsx`**

```tsx
import { useNoiseStore } from "../store/useNoiseStore";

export default function ConfirmationPage() {
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
```

`{caseReference && (...)}` renders the line only when there is a reference. If someone opens `/confirmation` directly, they won't see "Your case reference:" followed by nothing.

---

## 13. Try it out

With `npm run dev` running, open http://localhost:5173 and check each rule:

- [ ] **Start report** goes to the noise type page
- [ ] **Continue** is greyed out until you pick a noise type
- [ ] Picking a noise type then pressing **F5** keeps your choice
- [ ] On the details page, **Continue** stays disabled with only a duration, or with a description of only spaces
- [ ] Every **Back** button goes to the previous page with your answers still filled in
- [ ] Clicking **Submit** with empty fields shows three red messages
- [ ] Typing in a field clears *only* that field's message
- [ ] `not-an-email` in the email field shows "Enter a valid email address"
- [ ] With valid details, **Submit** shows "Something went wrong sending your report". The back end doesn't exist yet. It's added in Part 2

**Look inside the store.** Open DevTools → **Application** → **Local Storage** → `http://localhost:5173` → `mini-noise-reporter-storage`. You'll see JSON like:

```json
{"state":{"noiseType":"music","howLong":"days","description":"Drilling","yourDetails":{"firstName":"","lastName":"","email":""},"caseReference":""},"version":0}
```

Delete that key and refresh to start over. You'll use this same shape in Part 3 to skip straight to a page in a test.

**Look at the request.** Open DevTools → **Network**, submit valid details and click the `submitCase` request. The **Payload** tab shows all six fields combined into one object. That's the *contract* the back end in Part 2 has to accept.

---

## 14. Lint and build

```bash
npm run lint    # ESLint: catches unused variables, hook mistakes, etc.
npm run build   # type-checks with tsc, then bundles to dist/
```

Both should finish without errors. If `build` reports a type error, read the file and line number it gives. TypeScript is usually right.

---

## Common mistakes

| Symptom | Likely cause |
|---|---|
| No styles at all | `src/index.css` isn't imported in `main.tsx`, or `postcss.config.js` is missing |
| Some classes don't style | The file isn't matched by `content` in `tailwind.config.js` |
| Continue/Submit always clickable | `disabled` isn't passed through to `<button>` (see section 5) |
| Answers vanish on refresh | `persist(...)` missing from the store, or the storage key changed |
| `useNavigate() may be used only in the context of a <Router>` | A page is rendered outside `<BrowserRouter>` |
| `No QueryClient set` | `QueryClientProvider` missing from `main.tsx` |
| Typing in one field clears the others | `setYourDetails({ [field]: value })` without `...yourDetails` spread first |

---

## Exercises

1. **Summary before submit.** Show the three earlier answers (with friendly labels, not codes) on the Your details page, so the user can check them.
2. **Reset after submit.** After a successful submission, **Start report** still shows the old answers. Call the store's `reset()` at the right moment so a new report starts empty, but the confirmation page still shows the case reference.
3. **Trim names.** `"   "` currently passes as a first name, because `min(1)` doesn't trim. Fix the schema (hint: `z.string().trim().min(1, ...)`).
4. **Guard the routes.** Opening `/your-details` directly skips the earlier questions. Redirect to `/noise-type` if `noiseType` is empty (hint: React Router's `<Navigate>`).
5. **Progress indicator.** Add "Step 2 of 4" to each form page.

➡️ **Next:** [Part 2: Building the back end](02-backend-tutorial.md)
