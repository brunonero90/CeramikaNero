import Image from 'next/image';
import type { Metadata } from 'next';
import {
  ImageTextSplit,
  MarketingHero,
  type SplitBlock,
} from '@/components/clone/marketing';

type MarketingPageProps = {
  title: string;
  metaDescription: string;
  hero: {
    title: string;
    imageSrc: string;
    imageAlt: string;
    logoSrc?: string;
    logoAlt?: string;
    intro?: string[];
  };
  blocks: SplitBlock[];
  beforeBlocks?: React.ReactNode;
  afterHero?: React.ReactNode;
};

export function buildMarketingMetadata(
  title: string,
  description: string
): Metadata {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      locale: 'pl_PL',
      type: 'website',
    },
  };
}

export function MarketingPageView({
  hero,
  blocks,
  beforeBlocks,
  afterHero,
}: Omit<MarketingPageProps, 'title' | 'metaDescription'>) {
  return (
    <div className="bg-surface-bg">
      <MarketingHero {...hero} />
      {afterHero}
      {beforeBlocks}
      {blocks.map((block) => (
        <ImageTextSplit key={block.id} block={block} />
      ))}
    </div>
  );
}

export function PartnerBadge({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="flex justify-center px-4 py-8">
      <Image
        src={src}
        alt={alt}
        width={84}
        height={62}
        className="h-auto w-20"
      />
    </div>
  );
}
