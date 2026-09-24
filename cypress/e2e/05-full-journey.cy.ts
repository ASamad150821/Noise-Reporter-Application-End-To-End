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
