import { describe, expect, it } from 'vitest';
import { getAll, getByCategorySlug, getBySlug } from '../workshops';

describe('fixture workshops', () => {
  it('returns all published workshops', async () => {
    const workshops = await getAll();
    expect(workshops.length).toBeGreaterThan(0);
    expect(workshops.every((w) => w.status === 'published')).toBe(true);
  });

  it('looks up a workshop by slug', async () => {
    const workshop = await getBySlug('ceramika-dla-doroslych');
    expect(workshop).not.toBeNull();
    expect(workshop?.title).toBe('Ceramika dla dorosłych');
    expect(workshop?.category?.slug).toBe('dla-doroslych');
  });

  it('returns null for an unknown slug', async () => {
    const workshop = await getBySlug('nieistniejacy-warsztat');
    expect(workshop).toBeNull();
  });

  it('filters workshops by category slug', async () => {
    const children = await getByCategorySlug('dla-dzieci');
    expect(children.length).toBeGreaterThan(0);
    expect(children.every((w) => w.category?.slug === 'dla-dzieci')).toBe(true);
  });

  it('includes upcoming sessions for a scheduled workshop', async () => {
    const workshop = await getBySlug('ceramika-dla-doroslych');
    expect(workshop?.sessions.length).toBeGreaterThan(0);
    expect(workshop?.sessions.every((s) => s.status === 'scheduled')).toBe(
      true
    );
  });

  it('returns an enquiry workshop without sessions', async () => {
    const workshop = await getBySlug('urodziny-ceramiczne');
    expect(workshop?.bookingMode).toBe('enquiry');
  });
});
