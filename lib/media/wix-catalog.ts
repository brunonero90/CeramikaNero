import {
  wixMediaAssets,
  wixMediaById,
  getWixMediaByCategory,
} from '@/lib/database/fixtures/media-assets';
import { getMediaUrl } from '@/lib/media';
import type { MediaAsset } from '@/lib/database/types';

export type SiteImage = {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  category: string;
};

function toSiteImage(asset: MediaAsset): SiteImage | null {
  const src = getMediaUrl(asset);
  if (!src) return null;
  return {
    id: asset.id,
    src,
    alt: asset.altText ?? '',
    width: asset.width ?? 1200,
    height: asset.height ?? 800,
    category: 'wix',
  };
}

/** All migrated Wix assets available locally. */
export function getAllMigratedImages(): SiteImage[] {
  return wixMediaAssets
    .map(toSiteImage)
    .filter((img): img is SiteImage => img !== null);
}

export function getMigratedImageById(id: string): SiteImage | null {
  const asset = wixMediaById.get(id);
  return asset ? toSiteImage(asset) : null;
}

export function getGalleryImages(): SiteImage[] {
  // Include large photographic assets even when the crawl tagged them as
  // social/OG metadata — they are still part of the original site collection.
  // Only exclude true social *icons* (tiny square assets with Facebook/Instagram
  // as the sole alt), not gallery graphics whose alt merely mentions social media.
  return wixMediaAssets
    .map(toSiteImage)
    .filter((img): img is SiteImage => img !== null)
    .filter((img) => img.width * img.height >= 40000)
    .filter((img) => {
      const alt = (img.alt || '').trim().toLowerCase();
      const isSocialIconOnly =
        /^(facebook|instagram)\s*$/i.test(alt) ||
        (img.width <= 256 &&
          img.height <= 256 &&
          /facebook|instagram/i.test(alt));
      return !isSocialIconOnly;
    })
    .filter(
      (img, index, arr) =>
        arr.findIndex((other) => other.src === img.src) === index
    );
}

export function getBrandingImages(): SiteImage[] {
  return getWixMediaByCategory('social')
    .map(toSiteImage)
    .filter((img): img is SiteImage => img !== null);
}

export function getSocialIcon(
  name: 'facebook' | 'instagram'
): SiteImage | null {
  // Prefer exact alt + small assets so FB/IG share a consistent visual box.
  const exact = wixMediaAssets.find((asset) => {
    const alt = (asset.altText || '').trim().toLowerCase();
    const isExact = alt === name;
    const isTiny = (asset.width ?? 0) <= 256 && (asset.height ?? 0) <= 256;
    return isExact && isTiny;
  });
  if (exact) return toSiteImage(exact);

  const match = wixMediaAssets.find((asset) => {
    const alt = (asset.altText || '').trim().toLowerCase();
    const isExact = alt === name || new RegExp(`^${name}\\s*$`).test(alt);
    const isTiny = (asset.width ?? 0) <= 256 && (asset.height ?? 0) <= 256;
    return isExact || (isTiny && alt.includes(name));
  });
  return match ? toSiteImage(match) : null;
}

export function getLogoImage(): SiteImage | null {
  const match = wixMediaAssets.find(
    (asset) =>
      /logo|pracownia ceramika nero/i.test(asset.altText || '') ||
      /64bcccd9911949e7895d7325e88a5a75/.test(asset.id)
  );
  return match ? toSiteImage(match) : null;
}

/** Stable hero for homepage — large atelier photograph. */
export function getHomeHeroImage(): SiteImage | null {
  const preferredIds = [
    'wix-747d6f_64bcccd9911949e7895d7325e88a5a75',
    'wix-747d6f_85e6210e2fd54cd6885c6833e198c58d',
    'wix-747d6f_bd50a8f7389540819fdfd73395d3b559',
  ];
  for (const id of preferredIds) {
    const image = getMigratedImageById(id);
    if (image) return image;
  }
  return (
    getWixMediaByCategory('home')
      .map(toSiteImage)
      .find((img): img is SiteImage => !!img) ?? null
  );
}

export function getPracowniaImages(): SiteImage[] {
  return getWixMediaByCategory('home')
    .concat(getWixMediaByCategory('about'))
    .map(toSiteImage)
    .filter((img): img is SiteImage => img !== null)
    .filter((img) => img.width >= 800)
    .slice(0, 6);
}

const workshopImageMap: Record<string, string> = {
  'ceramika-dla-doroslych': 'wix-747d6f_85e6210e2fd54cd6885c6833e198c58d',
  'glina-do-wina': 'wix-747d6f_2edf75f3f9fd45b4bc7f120d2f64b85b',
  'glina-do-wina-w-poznaniu-w-ptasim-radiu':
    'wix-747d6f_b5e3aff7de8743c88922dac0ed1c8629',
  'ceramika-dla-dzieci': 'wix-747d6f_af946e4dbc8d40208b3d1c05be4cebbe',
  'kurs-rysunku-dla-mlodziezy': 'wix-747d6f_2234cc741bd5422eb5d92705a021219a',
  'kurs-rysunku-i-architektury': 'wix-747d6f_da600fb92cac4d629b7833190b681fa2',
  'glina-i-rodzina': 'wix-747d6f_565523d2b38546f582a8ddb7f0a5dd67',
  'urodziny-ceramiczne': 'wix-747d6f_27032db4ff7642f185f09f10408c5e0f',
  'warsztaty-dla-firm': 'wix-747d6f_8e0a38114728487bade7b52335892f5a',
};

export function getWorkshopImage(
  slug: string,
  featuredMediaId?: string | null
): SiteImage | null {
  if (featuredMediaId) {
    const fromFeatured = getMigratedImageById(featuredMediaId);
    if (fromFeatured) return fromFeatured;
  }
  const mapped = workshopImageMap[slug];
  if (mapped) return getMigratedImageById(mapped);
  return null;
}

const categoryImageMap: Record<string, string> = {
  'dla-dzieci': 'wix-747d6f_fca882c3dece4a5fab6a55a0b49998a5',
  'dla-doroslych': 'wix-747d6f_6fc6a003b39840b58b4c14fa6e386e28',
  'glina-do-wina': 'wix-747d6f_045e89a3529f4e2491a7742e1da14497',
  urodziny: 'wix-747d6f_27032db4ff7642f185f09f10408c5e0f',
  'grupy-i-firmy': 'wix-747d6f_8e0a38114728487bade7b52335892f5a',
  'wieczory-panienskie': 'wix-747d6f_b5e3aff7de8743c88922dac0ed1c8629',
  rodzinne: 'wix-747d6f_565523d2b38546f582a8ddb7f0a5dd67',
};

export function getCategoryImage(slug: string): SiteImage | null {
  const id = categoryImageMap[slug];
  return id ? getMigratedImageById(id) : null;
}

export function getHomepageFeatureImages(): SiteImage[] {
  return [
    getCategoryImage('dla-dzieci'),
    getCategoryImage('dla-doroslych'),
    getCategoryImage('grupy-i-firmy'),
  ].filter((img): img is SiteImage => img !== null);
}
