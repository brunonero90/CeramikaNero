import * as React from 'react';
import { Hr, Link, Section, Text } from '@/lib/email/react-email';
import { absoluteEmailUrl, getEmailSiteUrl } from '@/lib/email/format';
import { siteContact } from '@/lib/fixtures/navigation';
import {
  EMAIL_BRAND_FULL,
  emailColors,
  emailFonts,
  emailLayout,
} from '@/lib/email/tokens';

type EmailFooterProps = {
  siteUrl?: string | null;
};

export function EmailFooter({ siteUrl }: EmailFooterProps) {
  const base = getEmailSiteUrl(siteUrl);
  const regulamin = absoluteEmailUrl('/regulamin', siteUrl);
  const privacy = absoluteEmailUrl('/polityka-prywatnosci', siteUrl);

  return (
    <Section
      style={{
        padding: `8px ${emailLayout.cardPadding}px ${emailLayout.cardPadding}px`,
      }}
    >
      <Hr
        style={{
          borderColor: emailColors.border,
          borderWidth: '1px 0 0',
          margin: '8px 0 16px',
        }}
      />
      <Text
        style={{
          margin: '0 0 6px',
          fontFamily: emailFonts.heading,
          fontSize: '14px',
          color: emailColors.text,
        }}
      >
        {EMAIL_BRAND_FULL}
      </Text>
      <Text
        style={{
          margin: '0 0 4px',
          fontSize: '12px',
          lineHeight: '18px',
          color: emailColors.muted,
        }}
      >
        {siteContact.addressLine}, {siteContact.cityLine}
      </Text>
      <Text
        style={{
          margin: '0 0 12px',
          fontSize: '12px',
          lineHeight: '18px',
          color: emailColors.muted,
        }}
      >
        <Link href={base} style={{ color: emailColors.accent }}>
          ceramikanero.pl
        </Link>
        {' · '}
        <Link href={regulamin} style={{ color: emailColors.accent }}>
          Regulamin
        </Link>
        {' · '}
        <Link href={privacy} style={{ color: emailColors.accent }}>
          Polityka prywatności
        </Link>
      </Text>
      <Text
        style={{
          margin: 0,
          fontSize: '11px',
          lineHeight: '16px',
          color: emailColors.muted,
        }}
      >
        Ta wiadomość dotyczy Twojego zamówienia lub rezerwacji w Ceramika Nero.
        Nie zawiera pikseli śledzących.
      </Text>
    </Section>
  );
}
