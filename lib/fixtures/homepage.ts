/**
 * TEMPORARY FIXTURE — Display content for the first-phase homepage. These
 * cards will be replaced by real workshop categories and featured content.
 */
export type FeatureCard = {
  title: string;
  description: string;
};

export const featureCards: FeatureCard[] = [
  {
    title: 'Warsztaty dla dzieci',
    description:
      'Bezpieczne, sensoryczne spotkania z gliną dla najmłodszych artystów.',
  },
  {
    title: 'Warsztaty dla dorosłych',
    description:
      'Wieczorne i weekendowe zajęcia dla początkujących i zaawansowanych.',
  },
  {
    title: 'Grupy i firmy',
    description:
      'Integracyjne warsztaty ceramiczne dla zespołów i okazje specjalne.',
  },
];
