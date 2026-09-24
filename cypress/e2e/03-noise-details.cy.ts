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
