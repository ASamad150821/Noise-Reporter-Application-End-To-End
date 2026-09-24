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
