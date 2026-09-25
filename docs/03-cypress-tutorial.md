# Part 3: Testing the Noise Reporter with Cypress

This is the last of three tutorials that rebuild the Noise Reporter from scratch:

1. [Front end](01-frontend-tutorial.md): the React pages the customer clicks through
2. [Back end](02-backend-tutorial.md): the Express server that stores each report
3. **Cypress tests** (this document): end-to-end tests for the whole thing

You have a working app. Now you'll prove it works, and keep proving it every time the code changes, with **25 Cypress end-to-end tests**. They cover every page: navigation, button enable/disable rules, answers that survive a reload, validation, the exact data sent to the API, loading and error states, and a full journey against the real server.

**What you'll learn**

1. Installing and configuring Cypress in a Vite + Express project
2. Running the app for tests without touching real data
3. Choosing selectors that don't break when the styling changes
4. Writing specs page by page
5. Skipping slow setup by seeding app state
6. Stubbing, spying on and asserting against network requests (`cy.intercept`)
7. Custom commands and fixtures to cut repetition
8. A true end-to-end test and API tests (`cy.request`)
9. Reading a failing test, and making sure your tests *can* fail
10. Running the suite in GitHub Actions

> **Convention:** a heading like 📄 **`cypress.config.ts`** followed by a code block means *create this file with exactly this content*. Short snippets without that heading are for explanation only.

---

## 0. Decide what to test before writing any tests

Tests describe **behaviour**, what a user can see and do, not implementation. Before writing any code, list the behaviours from Parts 1 and 2:

| Page | Behaviours worth a test |
|---|---|
| Start | Shows the intro. **Start report** goes to `/noise-type` |
| Noise type | Four options. Continue disabled until one is picked. Only one can be picked. Back → `/`. Choice survives a reload |
| Noise details | Placeholder plus four durations. Continue needs *both* fields. Spaces-only description doesn't count. Back keeps earlier answers. Survives a reload |
| Your details | Empty fields → three errors. Bad email → email error only. Errors clear as you type. Invalid form never calls the API. Valid form sends **all six** answers. Submit disabled while sending. Server error keeps you on the page |
| Confirmation | Shows the case reference from the API |
| API | Returns 201 and an `NR-XXXXXXXX` reference. References are unique |

Each row becomes a spec file, and each behaviour becomes an `it(...)`.

Two things from the earlier parts matter a lot for testing:

- **State is persisted to `localStorage`** under `mini-noise-reporter-storage` (Part 1, section 6). So tests can *pre-fill* answers and start on any page.
- **The server's storage file comes from `REPORTS_DB_PATH`** (Part 2, section 4). So test runs can write to their own file.

---

## 1. Install Cypress

```bash
npm install -D cypress start-server-and-test
```

- `cypress` is the test runner. The first install also downloads a ~500 MB app binary to `~/Library/Caches/Cypress` (macOS) or `~/.cache/Cypress` (Linux).
- `start-server-and-test` starts the app, waits until it responds, runs the tests and shuts the app down. It's used for one-command local runs.

Check it installed:

```bash
npx cypress --version
```

---

## 2. Configure Cypress

📄 **`cypress.config.ts`**

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

`baseUrl` lets you write `cy.visit('/noise-type')` instead of the full URL, and `cy.request('/api/...')` goes through the same origin, so it passes through the Vite proxy from Part 2. `video: false` keeps runs fast. Cypress still saves a screenshot when a test fails.

Create the folder layout Cypress expects:

```bash
mkdir -p cypress/e2e cypress/fixtures cypress/support
```

```
cypress/
  e2e/            ← spec files (*.cy.ts), run in filename order
  fixtures/       ← test data as JSON
  support/
    e2e.ts        ← loaded before every spec
    commands.ts   ← custom commands (section 9)
  tsconfig.json   ← TypeScript settings for the tests only
```

Tests get their own tsconfig, so Cypress globals (`cy`, `describe`, `expect`) are available in tests but can't leak into app code:

📄 **`cypress/tsconfig.json`**

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

📄 **`cypress/support/e2e.ts`**

```ts
// Loaded automatically before every spec file.
import './commands';
```

For now, create `cypress/support/commands.ts` as an empty file containing only `export {};`. You'll fill it in section 9.

Add Cypress output (and the test database from the next section) to `.gitignore`:

```
# Cypress
cypress/videos
cypress/screenshots
server/reports.e2e.json
```

---

## 3. Run the app for tests without touching real data

The full-journey test really submits a report. If it wrote to `server/reports.json`, every test run would add fake customers to your real data. Part 2 already made the file path configurable, so a test script just points it somewhere else.

Add these four scripts to `package.json`, below the ones from Part 2:

```json
"dev:e2e": "concurrently \"vite --port 5173 --strictPort\" \"REPORTS_DB_PATH=server/reports.e2e.json tsx server/index.ts\"",
"cy:open": "cypress open",
"cy:run": "cypress run",
"test:e2e": "start-server-and-test dev:e2e \"http://localhost:5173|http://localhost:3001/api/health\" cy:run"
```

| Script | What it does |
|---|---|
| `dev:e2e` | Both servers, with the API writing to `server/reports.e2e.json`. `--strictPort` makes Vite fail loudly rather than silently moving to 5174, which would make every test hit the wrong URL. The server uses `tsx` rather than `tsx watch`, so it doesn't restart halfway through a run |
| `cy:open` | The interactive runner. Use it while **writing** tests |
| `cy:run` | Runs every spec headlessly in the terminal |
| `test:e2e` | Starts `dev:e2e`, waits for **both** URLs (the `/api/health` endpoint from Part 2 exists for exactly this), runs `cy:run`, then stops everything. One command, same as CI |

> **Windows:** `VAR=value command` is Unix shell syntax. On Windows, install `cross-env` and write `cross-env REPORTS_DB_PATH=server/reports.e2e.json tsx server/index.ts`.

The day-to-day workflow while writing tests:

```bash
npm run dev:e2e    # terminal 1: leave running
npm run cy:open    # terminal 2: choose E2E Testing → Chrome → click a spec
```

The runner re-runs a spec every time you save it.

---

## 4. Choosing selectors

This is the most important habit in UI testing: **a selector should survive a restyle or a refactor.**

| ❌ Brittle | ✅ Robust | Why |
|---|---|---|
| `.bg-blue-600` | `cy.contains('button', 'Continue')` | Tailwind classes change whenever the design changes |
| `div > div:nth-child(2) input` | `[data-cy="email"]` | DOM structure changes all the time |
| `cy.get('select')` | `[data-cy="how-long"]` | Breaks as soon as a second dropdown is added |

This suite uses two strategies:

1. **What the user sees**, like `cy.contains('button', 'Submit')` or `cy.contains('label', 'Loud music')`. If the text changes, the test *should* fail, because the user experience changed.
2. **`data-cy` attributes** for things without stable visible text: inputs, error messages and the case reference. They exist only for tests, so nobody changes them by accident.

You already added every `data-cy` attribute while building the pages in Part 1:

| Attribute | Where |
|---|---|
| `data-cy="how-long"`, `data-cy="description"` | `src/Pages/NoiseDetails.tsx` |
| `data-cy="firstName"` / `"lastName"` / `"email"` | `src/components/YourDetailsField.tsx`, taken from the `field` prop |
| `data-cy="firstName-error"` etc. | The same component, on the error `<p>` |
| `data-cy="submit-error"` | `src/Pages/YourDetails.tsx` |
| `data-cy="case-reference"` | `src/Pages/Confirmation.tsx` |

> **Tip:** In `cy:open`, click the crosshair (**Selector Playground**) and then click any element. Cypress suggests a selector and prefers `data-cy` when there is one.

---

## 5. Your first spec: Start page

📄 **`cypress/e2e/01-start.cy.ts`**

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

- `describe` groups tests, `it` is one test and `beforeEach` runs before every `it`.
- **Each test is isolated.** Cypress clears `localStorage`, cookies and the page between tests. Never rely on an earlier test having run.
- **Arrange → act → assert.** Visit the page, click, check the result. The blank line between *act* and *assert* makes this easy to see.
- **Cypress retries automatically.** `.should(...)` keeps retrying for up to 4 seconds until it passes, so there's no `cy.wait(1000)` anywhere in this suite. Never add fixed waits. Assert on the thing you're waiting for.
- `cy.location('pathname')` is how you assert on routing.

Run it in `cy:open` and watch it pass. Click each step in the left panel and Cypress shows you the page as it was at that moment ("time travel").

---

## 6. Custom commands (write them before you need them twice)

The next specs repeatedly pick a noise type, fill the details and fill the Your details form. Wrap each of those in a **custom command**, and add one command that starts a test on any page with the store pre-filled (section 7 explains how that works).

📄 **`cypress/support/commands.ts`**

```ts
// Reusable steps shared by several specs.
// Each custom command is declared in the `Cypress.Chainable` interface below so
// TypeScript (and your editor's autocomplete) knows about it.

type NoiseState = {
  noiseType?: string;
  howLong?: string;
  description?: string;
  yourDetails?: { firstName: string; lastName: string; email: string };
  caseReference?: string;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Visit a page with the Zustand store pre-filled, skipping earlier steps of the form. */
      visitWithState(path: string, state: NoiseState): Chainable<AUTWindow>;
      /** Pick a noise type by its visible label, e.g. "Loud music". */
      chooseNoiseType(label: string): Chainable<JQuery<HTMLElement>>;
      /** Fill the "Tell us more about it" page. */
      fillNoiseDetails(howLongLabel: string, description: string): Chainable<JQuery<HTMLElement>>;
      /** Fill the "Your Details" page. */
      fillYourDetails(details: { firstName: string; lastName: string; email: string }): Chainable<JQuery<HTMLElement>>;
    }
  }
}

// The app persists its store to localStorage under this key (see src/store/useNoiseStore.ts).
const STORE_KEY = 'mini-noise-reporter-storage';

const emptyState: Required<NoiseState> = {
  noiseType: '',
  howLong: '',
  description: '',
  yourDetails: { firstName: '', lastName: '', email: '' },
  caseReference: '',
};

Cypress.Commands.add('visitWithState', (path, state) => {
  return cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ state: { ...emptyState, ...state }, version: 0 }),
      );
    },
  });
});

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

export {};
```

- `Cypress.Commands.add(name, fn)` registers `cy.name(...)`.
- The `declare global { namespace Cypress { interface Chainable { ... } } }` block tells TypeScript the new commands exist. Without it, `cy.chooseNoiseType` is a type error. `export {}` turns the file into a module, which `declare global` requires.
- Commands *return* the last chain, so callers can keep chaining: `cy.fillYourDetails(x).should(...)`.
- Interaction methods: `.check()` for radios and checkboxes, `.select('Visible label')` for `<select>`, `.type()` for text (with `.clear()` first if the field might already have a value).

**Fixtures** hold test data. Use obviously fake details and `example.com` emails, never a real person's:

📄 **`cypress/fixtures/reporter.json`**

```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane.doe@example.com"
}
```

Load it with `cy.fixture('reporter').then((reporter) => ...)`.

---

## 7. Noise type page, and why seeding state matters

📄 **`cypress/e2e/02-noise-type.cy.ts`**

```ts
describe('Noise type page', () => {
  beforeEach(() => {
    cy.visit('/noise-type');
  });

  it('lists every noise type option', () => {
    const labels = ['Loud music', 'Construction', 'Shouting / arguing', 'Something else'];

    cy.get('input[name="noiseType"]').should('have.length', labels.length);
    labels.forEach((label) => {
      cy.contains('label', label).should('be.visible');
    });
  });

  it('disables Continue until a noise type is chosen', () => {
    cy.contains('button', 'Continue').should('be.disabled');

    cy.chooseNoiseType('Construction');

    cy.contains('button', 'Continue').should('be.enabled');
  });

  it('only allows one noise type to be selected at a time', () => {
    cy.chooseNoiseType('Loud music');
    cy.chooseNoiseType('Something else');

    cy.get('input[value="music"]').should('not.be.checked');
    cy.get('input[value="other"]').should('be.checked');
  });

  it('continues to the noise details page', () => {
    cy.chooseNoiseType('Loud music');
    cy.contains('button', 'Continue').click();

    cy.location('pathname').should('eq', '/noise-details');
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
});
```

- **Test the negative case too.** "Disabled *before*, enabled *after*." A test that only checked "enabled" would pass even if the button were never disabled.
- The reload test protects the `persist` middleware. If someone removes it, this test fails.

### Seeding state: skip the clicking

To test the noise details page you *could* click through the Start and Noise type pages first. That's slow, and if the noise type page breaks, every later spec fails too, which hides where the real problem is.

Instead, **put the app straight into the state you need.** The store is persisted to `localStorage`, so `visitWithState` writes it in `onBeforeLoad`, *before* the app boots and reads it:

```ts
cy.visit('/noise-details', {
  onBeforeLoad(win) {
    win.localStorage.setItem(
      'mini-noise-reporter-storage',
      JSON.stringify({ state: { noiseType: 'music', /* ...other fields empty... */ }, version: 0 }),
    );
  },
});
```

`{ state, version }` is the shape Zustand's `persist` saves. You saw it in DevTools in Part 1, section 13. The command merges your partial state over `emptyState`, so specs only mention what matters:

```ts
cy.visitWithState('/noise-details', { noiseType: 'music' });
```

**Rule of thumb:** test each page *through its UI*, but *set up* each page by the fastest route. Keep one full click-through journey (section 10) to prove the pages connect.

---

## 8. Noise details page

📄 **`cypress/e2e/03-noise-details.cy.ts`**

```ts
describe('Noise details page', () => {
  beforeEach(() => {
    // Start as if the user already picked a noise type on the previous page.
    cy.visitWithState('/noise-details', { noiseType: 'music' });
  });

  it('offers a placeholder plus four durations', () => {
    cy.get('[data-cy="how-long"] option').then(($options) => {
      const labels = [...$options].map((option) => option.textContent);
      expect(labels).to.deep.equal([
        'Choose An Option',
        'Less than an hour',
        'A few hours',
        'Several days',
        'Weeks or longer',
      ]);
    });
  });

  it('disables Continue until both fields are filled in', () => {
    cy.contains('button', 'Continue').should('be.disabled');

    cy.get('[data-cy="how-long"]').select('A few hours');
    cy.contains('button', 'Continue').should('be.disabled');

    cy.get('[data-cy="description"]').type('Drilling next door');
    cy.contains('button', 'Continue').should('be.enabled');
  });

  it('treats a whitespace-only description as empty', () => {
    cy.fillNoiseDetails('Several days', '     ');

    cy.contains('button', 'Continue').should('be.disabled');
  });

  it('continues to the your details page', () => {
    cy.fillNoiseDetails('Weeks or longer', 'Bass music every night after 11pm');
    cy.contains('button', 'Continue').click();

    cy.location('pathname').should('eq', '/your-details');
  });

  it('goes back to the noise type page and keeps the earlier answer', () => {
    cy.contains('button', 'Back').click();

    cy.location('pathname').should('eq', '/noise-type');
    cy.get('input[value="music"]').should('be.checked');
  });

  it('keeps what the user typed after a page reload', () => {
    cy.fillNoiseDetails('Less than an hour', 'Car alarm');
    cy.reload();

    cy.get('[data-cy="how-long"]').should('have.value', 'under-hour');
    cy.get('[data-cy="description"]').should('have.value', 'Car alarm');
  });
});
```

- `.then(($options) => ...)` hands you the matched jQuery elements, so you can run ordinary JavaScript and a Chai `expect` on them. Checking the *whole list* in order catches a missing, extra or reordered option in one assertion.
- `should('have.value', 'under-hour')` checks the stored **code**, not the label. That's what gets sent to the API.
- The "goes back" test proves the seeded `noiseType` really flowed into the previous page. That's a cross-page check without clicking through from the start.

---

## 9. Your details page: validation and network requests

This is the most instructive spec. `cy.intercept` lets you **stub** (fake), **spy on** (watch) or **delay** HTTP requests the page makes.

📄 **`cypress/e2e/04-your-details.cy.ts`**

```ts
describe('Your details page', () => {
  const earlierAnswers = {
    noiseType: 'construction',
    howLong: 'days',
    description: 'Drilling from 7am',
  };

  beforeEach(() => {
    cy.visitWithState('/your-details', earlierAnswers);
  });

  describe('validation', () => {
    it('shows an error for every empty field', () => {
      cy.contains('button', 'Submit').click();

      cy.get('[data-cy="firstName-error"]').should('have.text', 'First name is required');
      cy.get('[data-cy="lastName-error"]').should('have.text', 'Last name is required');
      cy.get('[data-cy="email-error"]').should('have.text', 'Enter a valid email address');
      cy.location('pathname').should('eq', '/your-details');
    });

    it('rejects an invalid email address', () => {
      cy.fillYourDetails({ firstName: 'Jane', lastName: 'Doe', email: 'not-an-email' });
      cy.contains('button', 'Submit').click();

      cy.get('[data-cy="email-error"]').should('have.text', 'Enter a valid email address');
      cy.get('[data-cy="firstName-error"]').should('not.exist');
      cy.get('[data-cy="lastName-error"]').should('not.exist');
    });

    it('clears a field error as soon as the user edits that field', () => {
      cy.contains('button', 'Submit').click();
      cy.get('[data-cy="firstName-error"]').should('be.visible');

      cy.get('[data-cy="firstName"]').type('J');

      cy.get('[data-cy="firstName-error"]').should('not.exist');
      cy.get('[data-cy="lastName-error"]').should('be.visible');
    });

    it('does not call the API when the form is invalid', () => {
      cy.intercept('POST', '/api/submitCase', cy.spy().as('submitCase'));

      cy.contains('button', 'Submit').click();

      cy.get('@submitCase').should('not.have.been.called');
    });
  });

  describe('submitting', () => {
    it('sends every answer to the API and shows the case reference', () => {
      cy.intercept('POST', '/api/submitCase', {
        statusCode: 201,
        body: { caseReference: 'NR-TEST1234' },
      }).as('submitCase');

      cy.fixture('reporter').then((reporter) => {
        cy.fillYourDetails(reporter);
        cy.contains('button', 'Submit').click();

        cy.wait('@submitCase').its('request.body').should('deep.equal', {
          ...reporter,
          ...earlierAnswers,
        });
      });

      cy.location('pathname').should('eq', '/confirmation');
      cy.contains('h2', 'Report Submitted').should('be.visible');
      cy.get('[data-cy="case-reference"]').should('have.text', 'NR-TEST1234');
    });

    it('disables Submit while the request is in flight', () => {
      cy.intercept('POST', '/api/submitCase', {
        statusCode: 201,
        body: { caseReference: 'NR-SLOW0001' },
        delay: 1000,
      }).as('submitCase');

      cy.fixture('reporter').then((reporter) => cy.fillYourDetails(reporter));
      cy.contains('button', 'Submit').click();

      cy.contains('button', 'Submit').should('be.disabled');
      cy.wait('@submitCase');
      cy.location('pathname').should('eq', '/confirmation');
    });

    it('stays on the page and shows an error if the server fails', () => {
      cy.intercept('POST', '/api/submitCase', { statusCode: 500 }).as('submitCase');

      cy.fixture('reporter').then((reporter) => cy.fillYourDetails(reporter));
      cy.contains('button', 'Submit').click();
      cy.wait('@submitCase');

      cy.location('pathname').should('eq', '/your-details');
      cy.get('[data-cy="submit-error"]').should('be.visible');
      cy.contains('button', 'Submit').should('be.enabled');
    });
  });

  it('goes back to the noise details page', () => {
    cy.contains('button', 'Back').click();

    cy.location('pathname').should('eq', '/noise-details');
    cy.get('[data-cy="description"]').should('have.value', earlierAnswers.description);
  });
});
```

What each network technique is for:

| Test | Technique | Why |
|---|---|---|
| *sends every answer…* | **Stub** with a fixed body, then `cy.wait('@alias').its('request.body')` | A fake response gives a predictable case reference to assert on exactly. The request-body check proves the page combines answers from **all three pages** into one payload, which is the most important thing it does |
| *disables Submit…* | Stub with **`delay: 1000`** | Holds the request open long enough to see the loading state |
| *stays on the page…* | Stub **`statusCode: 500`** | Error handling you can't easily trigger against a real, healthy server |
| *does not call the API…* | **`cy.spy()`** as the handler, then `should('not.have.been.called')` | Proves something *didn't* happen |

- `.as('submitCase')` names an intercept, and `cy.wait('@submitCase')` pauses until it fires, then yields the request and response.
- Nested `describe` blocks (`validation`, `submitting`) share the outer `beforeEach`, and make the test report easier to read.
- The validation tests mirror the Zod schema from Part 1: one test per rule. Use `should('not.exist')` for elements removed from the DOM, and `should('not.be.visible')` for elements that are hidden but still there.

---

## 10. The real thing: full journey and API tests

Stubs are fast and predictable, but they can't prove the front end and the *real* back end agree. The last spec uses no stubs and talks to the Express server from Part 2, which is writing to `server/reports.e2e.json` thanks to `dev:e2e`.

📄 **`cypress/e2e/05-full-journey.cy.ts`**

```ts
// These tests talk to the real Express server (no cy.intercept stubs).
// When run via `npm run test:e2e` the server writes to server/reports.e2e.json,
// so your real server/reports.json is left untouched.

const CASE_REFERENCE_PATTERN = /^NR-[0-9A-F]{8}$/;

describe('Full journey (real backend)', () => {
  it('lets a user report a noise from start to finish', () => {
    cy.intercept('POST', '/api/submitCase').as('submitCase'); // spy only, request still goes to the server

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
    cy.get('[data-cy="case-reference"]').invoke('text').should('match', CASE_REFERENCE_PATTERN);
  });
});

describe('API: POST /api/submitCase', () => {
  it('returns 201 and a case reference', () => {
    cy.request('POST', '/api/submitCase', {
      firstName: 'Api',
      lastName: 'Test',
      email: 'api.test@example.com',
      noiseType: 'other',
      howLong: 'hours',
      description: 'Created by cy.request',
    }).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body.caseReference).to.match(CASE_REFERENCE_PATTERN);
    });
  });

  it('gives every report a unique case reference', () => {
    const body = { firstName: 'A', lastName: 'B', email: 'a@b.com', noiseType: 'music', howLong: 'days', description: 'x' };

    cy.request('POST', '/api/submitCase', body).then((first) => {
      cy.request('POST', '/api/submitCase', body).then((second) => {
        expect(first.body.caseReference).not.to.eq(second.body.caseReference);
      });
    });
  });
});
```

- `cy.intercept(method, url)` **with no response** is a pure spy. The request still reaches the server, but you can `cy.wait` on it and inspect the real response.
- The case reference is random now, so assert on its **format** with a regex, not an exact value.
- **`cy.request`** calls the API directly, with no browser page involved. It's ideal for checking the back end's contract from Part 2, section 0, and it's much faster than going through the UI.

After a run, open `server/reports.e2e.json` to see the reports the tests created. `server/reports.json` is untouched.

---

## 11. Run the whole suite

```bash
npm run test:e2e
```

Expected result:

```
  ✔  01-start.cy.ts           2 passing
  ✔  02-noise-type.cy.ts      6 passing
  ✔  03-noise-details.cy.ts   6 passing
  ✔  04-your-details.cy.ts    8 passing
  ✔  05-full-journey.cy.ts    3 passing
  ✔  All specs passed!       25 passing
```

---

## 12. Make sure your tests can fail

A test that has never failed might not be testing anything. Break the app on purpose and check the right tests catch it.

**Experiment 1.** In `src/components/Button.tsx`, delete `disabled={disabled}` from the `<button>` and run the suite again. You should see **4 failures**, starting with:

```
1) Noise type page
     disables Continue until a noise type is chosen:
   AssertionError: Timed out retrying after 4000ms:
   expected '<button.px-4.py-2...>' to be 'disabled'
```

This exact bug happened in the original build of this app (see Part 1, section 5). Every Continue and Submit button was always clickable, and these tests are how it was found. Put the line back.

**Experiment 2.** In `src/Pages/NoiseType.tsx`, change the Back button to `navigate("/noise-type")`. The *goes back to the start page* test fails. This was the other real bug these tests found. Put it back.

**Experiment 3.** Remove `persist(...)` from the store (keep the inner function). The reload tests fail, and so does every test that uses `visitWithState`. That's a reminder that seeding state depends on the persistence.

When a test fails, the question is always **"is the test wrong, or the app?"** Don't change the assertion until you've answered it. Debugging checklist:

1. Read the assertion message and the line number it points to.
2. In `cy:open`, click the failing command in the left panel. Cypress time-travels the page to that moment. Open DevTools there.
3. Headless failures save a screenshot to `cypress/screenshots/`.
4. Decide whether the test's expectation is right. If it is, fix the app.

---

## 13. Continuous integration with GitHub Actions

Run the suite on every push and pull request, so a broken change can't reach `main` unnoticed.

📄 **`.github/workflows/e2e.yml`**

```yaml
name: E2E tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  cypress:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version: 24
          cache: npm

      - name: Run Cypress
        uses: cypress-io/github-action@v7
        with:
          start: npm run dev:e2e
          wait-on: 'http://localhost:5173, http://localhost:3001/api/health'
          command: npm run cy:run

      - name: Upload screenshots of failed tests
        if: failure()
        uses: actions/upload-artifact@v7
        with:
          name: cypress-screenshots
          path: cypress/screenshots
```

The official Cypress action runs `npm ci`, caches the Cypress binary, starts `dev:e2e`, waits for both servers and runs the specs. If anything fails, the screenshots are uploaded as a downloadable artifact on the run's page.

Once it's green, add a status badge to the top of `README.md` (replace `<user>/<repo>` with yours):

```md
![E2E tests](https://github.com/<user>/<repo>/actions/workflows/e2e.yml/badge.svg)
```

---

## Exercises

Try each one before looking anything up. They're roughly in order of difficulty.

1. **Confirmation page.** Write `06-confirmation.cy.ts`: `visitWithState('/confirmation', { caseReference: 'NR-ABC12345' })` shows the reference. A second test shows that with no `caseReference`, the "Your case reference" line is *not* rendered.
2. **Every duration.** Loop over the four duration labels with `.forEach` and check each one enables Continue (with a description present).
3. **Whitespace names.** What happens when First name is `"   "`? Write the test you *want*, watch it fail, then fix the schema (Part 1, exercise 3).
4. **Browser back button.** Use `cy.go('back')` after moving from noise type to noise details. Does the app behave well?
5. **Server validation (test-driven).** `cy.request({ method: 'POST', url: '/api/submitCase', body: {}, failOnStatusCode: false })` and expect `400`. It fails today. Implement Part 2, exercise 1 until it passes.
6. **Mobile.** Copy the full journey, add `cy.viewport('iphone-x')` and check everything still works.
7. **Reset after submit.** After implementing Part 1, exercise 2, write a test proving a second report starts with an empty form.

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

Further reading: the official [Cypress best practices](https://docs.cypress.io/app/core-concepts/best-practices) page is worth reading once you've done the exercises.

🎉 **That's the whole app:** a React front end, an Express back end and an end-to-end test suite running in CI.
