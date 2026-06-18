import { matchesRegisteredOwner } from '../src/identity/ownership-matching';

describe('Ejer-matchning (MitID vs. register)', () => {
  it('matcher når identiteten står i registret', () => {
    expect(matchesRegisteredOwner('owner-of-BFE-1', ['owner-of-BFE-1'])).toBe(true);
  });
  it('matcher IKKE en fremmed identitet', () => {
    expect(matchesRegisteredOwner('fremmed', ['owner-of-BFE-1'])).toBe(false);
  });
  it('matcher IKKE når registret er tomt', () => {
    expect(matchesRegisteredOwner('owner-of-BFE-1', [])).toBe(false);
  });
});
