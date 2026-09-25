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
