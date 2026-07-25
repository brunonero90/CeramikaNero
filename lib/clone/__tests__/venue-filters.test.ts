import { describe, expect, it } from 'vitest';
import { homepageServices } from '@/lib/clone/content/landings';
import { inferHomepageVenueKey } from '@/lib/clone/venue';

describe('homepage venue filters', () => {
  it('marks Ptasie Radio with its own venue and reservation route', () => {
    const ptasie = homepageServices.find((s) =>
      s.href.includes('ptasim-radiu')
    );
    expect(ptasie).toBeTruthy();
    expect(ptasie?.venueKey).toBe('ptasie-radio');
    expect(ptasie?.href).toBe(
      '/warsztaty/glina-do-wina-w-poznaniu-w-ptasim-radiu/rezerwacja'
    );
    expect(ptasie?.href).not.toContain('/warsztaty/glina-do-wina/rezerwacja');
  });

  it('keeps Suchy Las offers on suchy-las venue key', () => {
    const suchy = homepageServices.filter((s) => s.venueKey === 'suchy-las');
    expect(suchy.length).toBeGreaterThan(3);
    expect(
      homepageServices.filter((s) => s.venueKey === 'ptasie-radio')
    ).toHaveLength(1);
  });

  it('infers venue from route identity, not title substrings alone', () => {
    expect(
      inferHomepageVenueKey({
        href: '/warsztaty/glina-do-wina-w-poznaniu-w-ptasim-radiu/rezerwacja',
        moreHref: '/service-page/glina-do-wina-w-poznaniu-w-ptasim-radiu',
        title: 'Something else entirely',
      })
    ).toBe('ptasie-radio');
    expect(
      inferHomepageVenueKey({
        href: '/kontakt?oferta=x',
        title: 'PTASIE RADIO FAKE',
      })
    ).toBe('enquiry');
  });
});
