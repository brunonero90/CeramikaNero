import * as React from 'react';
import { Link, Section, Text } from '@/lib/email/react-email';
import { absoluteEmailUrl } from '@/lib/email/format';
import { siteContact } from '@/lib/fixtures/navigation';
import { emailColors } from '@/lib/email/tokens';

type ContactHelpProps = {
  siteUrl?: string | null;
  intro?: string;
};

export function ContactHelp({
  siteUrl,
  intro = 'Pytania? Napisz lub zadzwoń — chętnie pomożemy.',
}: ContactHelpProps) {
  const contactUrl = absoluteEmailUrl('/kontakt', siteUrl);

  return (
    <Section style={{ margin: '0 0 8px' }}>
      <Text
        style={{
          margin: '0 0 6px',
          fontSize: '14px',
          lineHeight: '22px',
          color: emailColors.muted,
        }}
      >
        {intro}
      </Text>
      <Text
        style={{
          margin: 0,
          fontSize: '14px',
          lineHeight: '22px',
          color: emailColors.text,
        }}
      >
        <Link
          href={`mailto:${siteContact.email}`}
          style={{ color: emailColors.accent, textDecoration: 'underline' }}
        >
          {siteContact.email}
        </Link>
        {' · '}
        <Link
          href={siteContact.phoneHref}
          style={{ color: emailColors.accent, textDecoration: 'underline' }}
        >
          {siteContact.phoneDisplay}
        </Link>
        {' · '}
        <Link
          href={contactUrl}
          style={{ color: emailColors.accent, textDecoration: 'underline' }}
        >
          ceramikanero.pl/kontakt
        </Link>
      </Text>
    </Section>
  );
}
