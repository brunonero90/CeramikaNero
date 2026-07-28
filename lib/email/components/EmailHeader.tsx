import * as React from 'react';
import { Img, Link, Section, Text } from '@/lib/email/react-email';
import { emailLogoUrl, getEmailSiteUrl } from '@/lib/email/format';
import {
  EMAIL_BRAND_NAME,
  emailColors,
  emailFonts,
  emailLayout,
} from '@/lib/email/tokens';

type EmailHeaderProps = {
  siteUrl?: string | null;
};

export function EmailHeader({ siteUrl }: EmailHeaderProps) {
  const base = getEmailSiteUrl(siteUrl);
  const logo = emailLogoUrl(siteUrl);

  return (
    <Section
      style={{
        padding: `${emailLayout.cardPadding}px ${emailLayout.cardPadding}px 16px`,
        borderBottom: `1px solid ${emailColors.border}`,
        textAlign: 'center' as const,
      }}
    >
      <Link
        href={base}
        style={{ textDecoration: 'none', color: emailColors.text }}
      >
        <Img
          src={logo}
          alt={EMAIL_BRAND_NAME}
          width={72}
          height={72}
          style={{
            display: 'block',
            margin: '0 auto 12px',
            border: 0,
            outline: 'none',
          }}
        />
        <Text
          style={{
            margin: 0,
            fontFamily: emailFonts.heading,
            fontSize: '22px',
            lineHeight: '28px',
            letterSpacing: '0.04em',
            color: emailColors.text,
            fontWeight: 400,
          }}
        >
          {EMAIL_BRAND_NAME}
        </Text>
      </Link>
    </Section>
  );
}
