import { isFixtureMode } from '@/lib/supabase/fixture-mode';
import * as supabaseCategories from './services/categories';
import * as fixtureCategories from './fixtures/categories';
import * as supabaseWorkshops from './services/workshops';
import * as fixtureWorkshops from './fixtures/workshops';
import * as supabaseSessions from './services/sessions';
import * as fixtureSessions from './fixtures/sessions';
import * as supabaseContentPages from './services/content-pages';
import * as fixtureContentPages from './fixtures/content-pages';
import * as supabaseBlogPosts from './services/blog-posts';
import * as fixtureBlogPosts from './fixtures/blog-posts';
import * as supabaseGalleryItems from './services/gallery-items';
import * as fixtureGalleryItems from './fixtures/gallery-items';
import * as supabaseSiteSettings from './services/site-settings';
import * as fixtureSiteSettings from './fixtures/site-settings';
import * as supabaseRedirects from './services/redirects';
import * as fixtureRedirects from './fixtures/redirects';

/**
 * Domain-specific service factory. In development without Supabase credentials
 * it returns fixture implementations; otherwise it returns Supabase-backed
 * services. Production never silently falls back to fixtures.
 */
const useFixtures = isFixtureMode();

export const services = {
  categories: useFixtures ? fixtureCategories : supabaseCategories,
  workshops: useFixtures ? fixtureWorkshops : supabaseWorkshops,
  sessions: useFixtures ? fixtureSessions : supabaseSessions,
  contentPages: useFixtures ? fixtureContentPages : supabaseContentPages,
  blogPosts: useFixtures ? fixtureBlogPosts : supabaseBlogPosts,
  galleryItems: useFixtures ? fixtureGalleryItems : supabaseGalleryItems,
  siteSettings: useFixtures ? fixtureSiteSettings : supabaseSiteSettings,
  redirects: useFixtures ? fixtureRedirects : supabaseRedirects,
};

export function getAdapterName(): 'fixtures' | 'supabase' {
  return isFixtureMode() ? 'fixtures' : 'supabase';
}
