import { siteSettings } from './data';
import { mapPublicSiteSettings } from '@/lib/database/mappers';
import type { DbSiteSetting } from '@/lib/database/types';

export async function getPublicSettings() {
  return mapPublicSiteSettings(siteSettings as DbSiteSetting[]);
}
