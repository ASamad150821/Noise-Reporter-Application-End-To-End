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
