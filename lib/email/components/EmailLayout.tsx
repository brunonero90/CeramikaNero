import * as React from 'react';
import { Section, Text } from '@/lib/email/react-email';
import {
  ContactHelp,
  EmailFooter,
  EmailHeader,
  EmailShell,
  PaymentInstructions,
  PriceSummary,
  StatusBanner,
  type StatusBannerTone,
} from '@/lib/email/components';
import { emailColors, emailFonts, emailLayout } from '@/lib/email/tokens';
import type { PaymentInstructionsMode } from '@/lib/email/types';

type EmailLayoutProps = {
  preview: string;
  siteUrl?: string | null;
  greeting?: string;
  bannerTitle: string;
  bannerBody?: React.ReactNode;
  bannerTone?: StatusBannerTone;
  payment?: PaymentInstructionsMode | null;
  children?: React.ReactNode;
  contactIntro?: string;
};

export function EmailLayout({
  preview,
  siteUrl,
  greeting,
  bannerTitle,
  bannerBody,
  bannerTone = 'info',
  payment,
  children,
  contactIntro,
}: EmailLayoutProps) {
  return (
    <EmailShell preview={preview}>
      <EmailHeader siteUrl={siteUrl} />
      <Section
        style={{
          padding: `${emailLayout.cardPadding - 4}px ${emailLayout.cardPadding}px 8px`,
        }}
      >
        {greeting ? (
          <Text
            style={{
              margin: '0 0 14px',
              fontSize: '15px',
              lineHeight: '24px',
              color: emailColors.text,
            }}
          >
            {greeting}
          </Text>
        ) : null}
        <StatusBanner title={bannerTitle} tone={bannerTone}>
          {bannerBody}
        </StatusBanner>
        {children}
        <PaymentInstructions payment={payment} />
        <ContactHelp siteUrl={siteUrl} intro={contactIntro} />
      </Section>
      <EmailFooter siteUrl={siteUrl} />
    </EmailShell>
  );
}

export function BodyText({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        margin: '0 0 14px',
        fontSize: '14px',
        lineHeight: '22px',
        color: emailColors.muted,
        fontFamily: emailFonts.body,
      }}
    >
      {children}
    </Text>
  );
}

export function AdminMeta({ children }: { children: React.ReactNode }) {
  return (
    <Section
      style={{
        margin: '0 0 16px',
        padding: '12px 14px',
        backgroundColor: emailColors.cream,
        border: `1px solid ${emailColors.border}`,
      }}
    >
      <Text
        style={{
          margin: 0,
          fontSize: '13px',
          lineHeight: '20px',
          color: emailColors.text,
          whiteSpace: 'pre-wrap' as const,
        }}
      >
        {children}
      </Text>
    </Section>
  );
}

export { PriceSummary };
