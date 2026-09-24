# Noise Reporter

![E2E tests](https://github.com/ASamad150821/Noise-Reporter-Application-End-To-End/actions/workflows/e2e.yml/badge.svg)

A multi-step form for reporting noise complaints, tested end to end with Cypress.

**Stack:** React 19 · TypeScript · Vite · React Router · Zustand (persisted state) · TanStack Query · Zod · Tailwind CSS · Express · Cypress

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. The API runs on port 3001 and saves reports to `server/reports.json`.

## Tests

25 Cypress end-to-end tests cover every page of the journey: navigation, button enable/disable rules, persisted state across reloads, form validation, API payloads, loading and error states (stubbed with `cy.intercept`), plus a full journey and API tests against the real Express server.

```bash
npm run test:e2e   # start the app, run all specs headlessly, shut down
```

To write or debug tests interactively:

```bash
npm run dev:e2e    # terminal 1
npm run cy:open    # terminal 2
```

Test runs write to `server/reports.e2e.json` (git-ignored), so real data is untouched. The suite runs on every push via GitHub Actions.

Writing the tests exposed two bugs, both now fixed: the Back button on the noise type page didn't navigate anywhere, and the shared `Button` component dropped its `disabled` prop, so Continue and Submit could always be clicked.

See [docs/cypress-tutorial.md](docs/cypress-tutorial.md) for a step-by-step guide to how the suite was built.
