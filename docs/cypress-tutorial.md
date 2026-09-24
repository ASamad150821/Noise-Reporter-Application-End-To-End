# Adding Cypress end-to-end tests to the Noise Reporter

This tutorial walks through exactly how the Cypress suite in this repo was built, in the order it was built. Follow it on a fresh branch and you will end up with the same 25 tests — and, more importantly, you'll know how to write the next 25 yourself.

**What you'll learn**

1. Installing and configuring Cypress in a Vite + Express project
2. Running the frontend and backend together for tests, without polluting real data
3. Choosing selectors that don't break when the styling changes
4. Writing your first spec, then specs for each page
5. Skipping slow UI setup by seeding app state
6. Stubbing, spying on and asserting against network requests (`cy.intercept`)
7. Custom commands and fixtures to remove repetition
8. A true end-to-end test and API tests against the real server (`cy.request`)
9. Reading a failing test and using it to find a real bug
10. Running the suite in GitHub Actions

> **Tip:** To practise, create a branch from the commit *before* the tests were added (`git log` → find the commit before "Add Cypress E2E tests") and rebuild everything by following this guide. Compare with `main` when you get stuck.

---

## 0. Understand the app before testing it

You can't test what you don't understand. Spend ten minutes reading the code first. Here's what matters for testing:

| Route | File | What it does |
|---|---|---|
| `/` | `src/Pages/Start.tsx` | Intro text and a **Start report** button |
| `/noise-type` | `src/Pages/NoiseType.tsx` | Four radio buttons; **Continue** only enabled once one is chosen |
| `/noise-details` | `src/Pages/NoiseDetails.tsx` | "How long" dropdown + description textarea; **Continue** needs both |
| `/your-details` | `src/Pages/YourDetails.tsx` | First name, last name, email; validated by Zod; **Submit** POSTs to `/api/submitCase` |
| `/confirmation` | `src/Pages/Confirmation.tsx` | Shows the case reference returned by the API |

Two details that are easy to miss but very important for tests:

- **State lives in Zustand and is persisted to `localStorage`** under the key `mini-noise-reporter-storage` (`src/store/useNoiseStore.ts`). So answers survive a page reload, and we can *pre-fill* state in a test by writing to `localStorage`.
- **The API is a separate Express server** on port 3001 (`server/index.ts`); Vite proxies `/api` to it (`vite.config.ts`). It appends every report to `server/reports.json`.

Write a list of *behaviours* (not implementation details) before writing any test. For example: "Continue is disabled until a noise type is chosen" and "an invalid email shows 'Enter a valid email address'". Each behaviour becomes an `it(...)` block.

---

## 1. Install Cypress

```bash
npm install -D cypress start-server-and-test
```

- `cypress` — the test runner (it also downloads a ~500 MB Electron binary to `~/Library/Caches/Cypress` the first time).
- `start-server-and-test` — starts your app, waits for it to be ready, runs the tests, then shuts the app down. Needed for one-command and CI runs.

Check it worked:

```bash
npx cypress --version
```

---

## 2. Configure Cypress

Create `cypress.config.ts` in the project root:

```ts
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    viewportWidth: 1280,
    viewportHeight: 800,
    video: false,
  },
});
```

`baseUrl` means you can write `cy.visit('/noise-type')` instead of the full URL, and `cy.request('/api/...')` goes through the same origin (and so through the Vite proxy).

Create the folder structure Cypress expects:

```
cypress/
  e2e/          ← your spec files (*.cy.ts)
  fixtures/     ← test data in JSON
  support/
    e2e.ts      ← runs before every spec
    commands.ts ← your custom commands
  tsconfig.json
```

`cypress/tsconfig.json` gives the editor and `tsc` the Cypress types. It's kept separate from the app's tsconfig so Cypress globals (`cy`, `describe`, `expect`) don't leak into app code:

```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "types": ["cypress", "node"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["**/*.ts", "../cypress.config.ts"]
}
```

`cypress/support/e2e.ts` just imports the commands file (we'll fill that in later):

```ts
import './commands';
```

Add Cypress output folders to `.gitignore`:

```
cypress/videos
cypress/screenshots
server/reports.e2e.json
```

---

## 3. Run the app for tests (without touching real data)

The full-journey test really submits a report. Without care, every test run would add rows to `server/reports.json`. Fix: let the server take its file path from an environment variable.

In `server/index.ts`:

```ts
const DB_PATH = resolve(process.env.REPORTS_DB_PATH ?? 'server/reports.json');
```

We also added a tiny health-check endpoint so tooling can tell when the server is up:

```ts
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});
```

Then add these scripts to `package.json`:

```json
"dev:e2e": "concurrently \"vite --port 5173 --strictPort\" \"REPORTS_DB_PATH=server/reports.e2e.json tsx server/index.ts\"",
"cy:open": "cypress open",
"cy:run": "cypress run",
"test:e2e": "start-server-and-test dev:e2e \"http://localhost:5173|http://localhost:3001/api/health\" cy:run"
```

| Command | Use it when |
|---|---|
| `npm run dev:e2e` + `npm run cy:open` (two terminals) | **Writing** tests. Interactive runner, time-travel debugging, auto re-runs on save. |
| `npm run test:e2e` | **Running** the whole suite headlessly with one command — same as CI. |

`--strictPort` makes Vite fail loudly instead of silently moving to 5174 (which would make every test hit the wrong URL).

---

## 4. Choosing selectors

This is the single most important habit in UI testing. A selector should survive a restyle or a refactor.

| ❌ Brittle | ✅ Robust | Why |
|---|---|---|
| `.bg-blue-600` | `cy.contains('button', 'Continue')` | Tailwind classes change whenever the design changes |
| `div > div:nth-child(2) input` | `[data-cy="email"]` | DOM structure changes all the time |
| `cy.get('select')` | `[data-cy="how-long"]` | Breaks as soon as a second dropdown is added |

Two strategies are used in this suite:

1. **What the user sees** — `cy.contains('button', 'Submit')`, `cy.contains('label', 'Loud music')`. If the text changes, the test *should* fail, because the user experience changed.
2. **Dedicated `data-cy` attributes** for things without stable visible text (inputs, the case reference). These exist only for tests, so nobody changes them by accident.

The `data-cy` attributes added to the app:

```tsx
// src/Pages/NoiseDetails.tsx
<select data-cy="how-long" ...>
<textarea data-cy="description" ...>

// src/components/YourDetailsField.tsx — one attribute covers all three inputs
<input data-cy={detailsToChange} ...>          // → data-cy="firstName" / "lastName" / "email"
<p data-cy={`${detailsToChange}-error`} ...>   // → data-cy="email-error" etc.

// src/Pages/Confirmation.tsx
<span data-cy="case-reference" ...>
```

> **Tip:** In `cy:open`, click the crosshair ("Selector Playground") icon and click any element. Cypress suggests a selector and prefers `data-cy` when one exists.

---

## 5. Your first spec

`cypress/e2e/01-start.cy.ts`:

```ts
describe('Start page', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('shows the heading and introduction', () => {
    cy.contains('h2', 'Report noise in your area').should('be.visible');
    cy.contains('It takes about two minutes').should('be.visible');
  });

  it('takes the user to the noise type page when they start a report', () => {
    cy.contains('button', 'Start report').click();

    cy.location('pathname').should('eq', '/noise-type');
    cy.contains('h2', 'What kind of noise is it?').should('be.visible');
  });
});
```

Concepts:

- `describe` groups tests; `it` is one test; `beforeEach` runs before every `it`.
- **Each test is isolated.** Cypress clears `localStorage`, cookies and the page between tests, so never rely on a previous test having run.
- **Arrange → Act → Assert.** Visit the page, click something, check the result. The blank line between act and assert makes this easy to see.
- **Cypress retries automatically.** `.should(...)` keeps retrying for up to 4 seconds until it passes. That's why there's no `cy.wait(1000)` anywhere. Never add fixed waits; assert on the thing you're waiting for.
- `cy.location('pathname')` is how you assert on routing.

Run it: `npm run dev:e2e` in one terminal, `npm run cy:open` in another → **E2E Testing** → **Chrome** → click `01-start.cy.ts`.

---

## 6. Testing one page thoroughly: noise type

`cypress/e2e/02-noise-type.cy.ts` shows how to turn each behaviour into a test. Key excerpts:

```ts
it('disables Continue until a noise type is chosen', () => {
  cy.contains('button', 'Continue').should('be.disabled');

  cy.chooseNoiseType('Construction');   // custom command, see section 9

  cy.contains('button', 'Continue').should('be.enabled');
});

it('goes back to the start page', () => {
  cy.contains('button', 'Back').click();

  cy.location('pathname').should('eq', '/');
});

it('remembers the chosen noise type after a page reload', () => {
  cy.chooseNoiseType('Shouting / arguing');
  cy.reload();

  cy.get('input[value="shouting"]').should('be.checked');
});
```

Notes:

- Test the **negative** case too (disabled *before*, enabled *after*). A test that only checks "enabled" would pass even if the button were never disabled.
- The reload test covers the Zustand `persist` middleware. If someone removes it, this test catches the regression.
- For radios and checkboxes use `.check()`; for `<select>` use `.select('Visible label')`; for text use `.type()`, and `.clear()` first if the field could already have a value.

> 🐛 **This test found a bug.** Originally `handleBackButton` in `NoiseType.tsx` navigated to `/noise-type`, i.e. the page you were already on, so Back did nothing. The "goes back to the start page" test fails against that code. It was fixed to `navigate("/")`.

---

## 7. Skip the UI for setup: seeding state

To test the *Your details* page, you could click through three pages first. That's slow, and when the noise-type page breaks, every later test fails too, which hides where the real problem is.

Better: **put the app straight into the state you need.** Because the store is persisted to `localStorage`, we can write it *before the app boots* using `onBeforeLoad`:

```ts
cy.visit('/your-details', {
  onBeforeLoad(win) {
    win.localStorage.setItem(
      'mini-noise-reporter-storage',
      JSON.stringify({
        state: { noiseType: 'construction', howLong: 'days', description: 'Drilling from 7am', /* ... */ },
        version: 0,
      }),
    );
  },
});
```

The shape `{ state, version }` is what Zustand's `persist` middleware stores. You can confirm it yourself: run the app, fill a page, open DevTools → Application → Local Storage.

This was wrapped in a custom command, `cy.visitWithState(path, partialState)`, so specs just say:

```ts
beforeEach(() => {
  cy.visitWithState('/noise-details', { noiseType: 'music' });
});
```

**Rule of thumb:** test each page *through its UI*, and *set up* each page by the fastest route available. Keep one or two full click-through journeys (section 11) to prove the pages connect.

---

## 8. Network requests: `cy.intercept`

`cypress/e2e/04-your-details.cy.ts` is the most instructive spec. `cy.intercept` lets you **stub** (fake), **spy on** (watch), or **delay** HTTP requests the page makes.

### 8a. Stub a response and assert on the request body

```ts
it('sends every answer to the API and shows the case reference', () => {
  cy.intercept('POST', '/api/submitCase', {
    statusCode: 201,
    body: { caseReference: 'NR-TEST1234' },
  }).as('submitCase');                         // give it an alias

  cy.fixture('reporter').then((reporter) => {
    cy.fillYourDetails(reporter);
    cy.contains('button', 'Submit').click();

    cy.wait('@submitCase').its('request.body').should('deep.equal', {
      ...reporter,
      ...earlierAnswers,
    });
  });

  cy.location('pathname').should('eq', '/confirmation');
  cy.get('[data-cy="case-reference"]').should('have.text', 'NR-TEST1234');
});
```

Because the response is fake, the case reference is predictable (`NR-TEST1234`), so we can assert on it exactly. The request-body check proves the frontend combines answers from *all three* pages into one payload, which is the most important thing this page does.

### 8b. Test error handling you can't easily trigger for real

```ts
it('stays on the page if the server returns an error', () => {
  cy.intercept('POST', '/api/submitCase', { statusCode: 500 }).as('submitCase');
  // ...fill and submit...
  cy.wait('@submitCase');

  cy.location('pathname').should('eq', '/your-details');
  cy.contains('button', 'Submit').should('be.enabled');
});
```

### 8c. Test loading states with `delay`

```ts
cy.intercept('POST', '/api/submitCase', {
  statusCode: 201,
  body: { caseReference: 'NR-SLOW0001' },
  delay: 1000,
}).as('submitCase');
// ...submit...
cy.contains('button', 'Submit').should('be.disabled');   // while in flight
```

### 8d. Prove something did *not* happen

```ts
cy.intercept('POST', '/api/submitCase', cy.spy().as('submitCase'));
cy.contains('button', 'Submit').click();                 // empty, invalid form
cy.get('@submitCase').should('not.have.been.called');
```

---

## 9. Custom commands and fixtures

When you notice the same three lines in several tests, make a command. `cypress/support/commands.ts`:

```ts
Cypress.Commands.add('chooseNoiseType', (label) => {
  return cy.contains('label', label).find('input[type="radio"]').check();
});

Cypress.Commands.add('fillNoiseDetails', (howLongLabel, description) => {
  cy.get('[data-cy="how-long"]').select(howLongLabel);
  return cy.get('[data-cy="description"]').clear().type(description);
});

Cypress.Commands.add('fillYourDetails', ({ firstName, lastName, email }) => {
  cy.get('[data-cy="firstName"]').clear().type(firstName);
  cy.get('[data-cy="lastName"]').clear().type(lastName);
  return cy.get('[data-cy="email"]').clear().type(email);
});
```

For TypeScript to accept `cy.chooseNoiseType(...)`, declare it in the same file:

```ts
declare global {
  namespace Cypress {
    interface Chainable {
      chooseNoiseType(label: string): Chainable<JQuery<HTMLElement>>;
      // ...one line per command
    }
  }
}
export {};   // makes this file a module so `declare global` is allowed
```

**Fixtures** hold test data. `cypress/fixtures/reporter.json`:

```json
{ "firstName": "Jane", "lastName": "Doe", "email": "jane.doe@example.com" }
```

Load it with `cy.fixture('reporter').then((reporter) => ...)`. Use obviously fake data and `example.com` emails, never real people's details.

---

## 10. Validation tests

Straight from the Zod schema in `src/schemas/YourDetails.ts`: every rule gets a test.

```ts
it('shows an error for every empty field', () => {
  cy.contains('button', 'Submit').click();

  cy.get('[data-cy="firstName-error"]').should('have.text', 'First name is required');
  cy.get('[data-cy="lastName-error"]').should('have.text', 'Last name is required');
  cy.get('[data-cy="email-error"]').should('have.text', 'Enter a valid email address');
});

it('clears a field error as soon as the user edits that field', () => {
  cy.contains('button', 'Submit').click();
  cy.get('[data-cy="firstName-error"]').should('be.visible');

  cy.get('[data-cy="firstName"]').type('J');

  cy.get('[data-cy="firstName-error"]').should('not.exist');
  cy.get('[data-cy="lastName-error"]').should('be.visible');   // other errors unaffected
});
```

Use `should('not.exist')` for elements that are removed from the DOM, and `should('not.be.visible')` for elements that are hidden but still there.

---

## 11. A true end-to-end test, and API tests

Stubs are fast and deterministic, but they can't tell you that the frontend and the real backend agree. `cypress/e2e/05-full-journey.cy.ts` covers that:

```ts
it('lets a user report a noise from start to finish', () => {
  cy.intercept('POST', '/api/submitCase').as('submitCase'); // no response given → spy only

  cy.visit('/');
  cy.contains('button', 'Start report').click();
  cy.chooseNoiseType('Loud music');
  cy.contains('button', 'Continue').click();
  cy.fillNoiseDetails('Weeks or longer', 'Bass music from the flat above, every night after 11pm');
  cy.contains('button', 'Continue').click();
  cy.fixture('reporter').then((reporter) => cy.fillYourDetails(reporter));
  cy.contains('button', 'Submit').click();

  cy.wait('@submitCase').its('response.statusCode').should('eq', 201);
  cy.location('pathname').should('eq', '/confirmation');
  cy.get('[data-cy="case-reference"]').invoke('text').should('match', /^NR-[0-9A-F]{8}$/);
});
```

The case reference is random now, so we assert on its **format** with a regex, not an exact value.

`cy.request` calls the API directly (no browser UI). It's great for testing the backend contract:

```ts
cy.request('POST', '/api/submitCase', { firstName: 'Api', /* ... */ }).then((response) => {
  expect(response.status).to.eq(201);
  expect(response.body.caseReference).to.match(/^NR-[0-9A-F]{8}$/);
});
```

---

## 12. When a test fails: read it, don't fight it

The first run of this suite had **4 failures**:

```
1) Noise type page
     disables Continue until a noise type is chosen:
   AssertionError: Timed out retrying after 4000ms:
   expected '<button.px-4.py-2...>' to be 'disabled'
```

The tempting move is to "fix" the test. Instead, ask *is the test wrong, or the app?* In the app, `src/components/Button.tsx` pulled `disabled` out of the props and then never passed it to the `<button>`:

```tsx
export default function Button({ variant = 'primary', className = '', disabled, children, ...rest }) {
  // ...
  return <button className={...} {...rest}>   // ← disabled is lost!
```

So **every** Continue/Submit button in the app was always clickable. The grey "disabled" styling never appeared, and users could click Continue with nothing selected. Fix:

```tsx
<button className={...} disabled={disabled} {...rest}>
```

All 4 failures (including the "Submit disabled while in flight" test) came from this one bug. After the fix: **25/25 passing**. (ESLint had flagged it too: `'disabled' is defined but never used`.)

Debugging checklist:

1. Read the assertion message and the line number it points to.
2. In `cy:open`, click the failing command in the left panel. Cypress **time-travels** the DOM to that moment. Open DevTools there.
3. Headless failures save a screenshot in `cypress/screenshots/`.
4. Decide: is the test's expectation right? If yes, the app is wrong.

---

## 13. Continuous integration

`.github/workflows/e2e.yml` runs the suite on every push and pull request:

```yaml
- name: Run Cypress
  uses: cypress-io/github-action@v6
  with:
    start: npm run dev:e2e
    wait-on: 'http://localhost:5173, http://localhost:3001/api/health'
    command: npm run cy:run
```

The official action installs dependencies, caches the Cypress binary, starts the app, waits for both servers, and runs the tests. On failure, screenshots are uploaded as a build artifact so you can see what went wrong.

Once it's green, add a status badge to the top of your README:

```md
![E2E tests](https://github.com/ASamad150821/Noise-Reporter-Application-End-To-End/actions/workflows/e2e.yml/badge.svg)
```

---

## 14. Exercises: write these yourself

Try each one before looking anything up. They're ordered roughly by difficulty.

1. **Confirmation page:** visit `/confirmation` with `cy.visitWithState` and `caseReference: 'NR-ABC12345'`, then assert the reference is shown. Then write a second test showing that with an empty `caseReference` the "Your case reference" line is *not* rendered.
2. **Each duration:** use `.forEach` over the four duration labels to check that selecting each one enables Continue (once a description is present).
3. **Whitespace names:** what happens if First name is `"   "`? Write the test and decide whether the app's behaviour is correct. (Hint: Zod's `min(1)` doesn't trim.) If it's wrong, fix the schema and keep the test.
4. **Browser back button:** use `cy.go('back')` after moving from noise type to noise details. Does the app behave well?
5. **Server validation:** `cy.request` a POST with an empty body. What does the server do? Should it return 400? Write the test you *want*, watch it fail, then add validation to `server/index.ts` (you could reuse the Zod schema) until it passes. That's test-driven development.
6. **Mobile viewport:** add `cy.viewport('iphone-x')` to a copy of the full journey and check that everything still works.
7. **Reset after submit:** after a successful submission, starting a new report still shows the old answers. Is that desired? If not, call the store's `reset()` at the right time and write a test that proves the form starts empty.

---

## Quick reference

```ts
// Navigation
cy.visit('/path');                       cy.reload();                cy.go('back');
cy.location('pathname').should('eq', '/x');

// Finding
cy.get('[data-cy="email"]');             cy.contains('button', 'Submit');
cy.contains('label', 'Loud music').find('input');

// Acting
.click()  .type('text')  .clear()  .check()  .select('Label')

// Asserting (all retry automatically)
.should('be.visible' | 'not.exist' | 'be.disabled' | 'be.enabled' | 'be.checked')
.should('have.text', 'x')  .should('have.value', 'x')  .should('have.length', 4)
.invoke('text').should('match', /regex/)

// Network
cy.intercept('POST', '/api/x', { statusCode: 201, body: {...}, delay: 500 }).as('x');
cy.wait('@x').its('request.body').should('deep.equal', {...});
cy.request('POST', '/api/x', body).then((res) => expect(res.status).to.eq(201));

// Data
cy.fixture('reporter').then((data) => ...);
```

Further reading: the official [Cypress best practices](https://docs.cypress.io/app/core-concepts/best-practices) page is worth reading end to end once you've done the exercises.
