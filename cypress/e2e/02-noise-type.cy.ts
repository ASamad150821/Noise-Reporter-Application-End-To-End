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
