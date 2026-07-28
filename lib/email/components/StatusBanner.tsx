import * as React from 'react';
import { Section, Text } from '@/lib/email/react-email';
import { emailColors, emailFonts } from '@/lib/email/tokens';

export type StatusBannerTone =
  'success' | 'warning' | 'info' | 'danger' | 'neutral';

type StatusBannerProps = {
  title: string;
  children?: React.ReactNode;
  tone?: StatusBannerTone;
};

const toneStyles: Record<
  StatusBannerTone,
  { bg: string; border: string; title: string }
> = {
  success: {
    bg: emailColors.bannerSuccessBg,
    border: emailColors.sage,
    title: emailColors.text,
  },
  warning: {
    bg: emailColors.bannerWarningBg,
    border: emailColors.accent,
    title: emailColors.text,
  },
  info: {
    bg: emailColors.bannerInfoBg,
    border: emailColors.border,
    title: emailColors.text,
  },
  danger: {
    bg: emailColors.bannerDangerBg,
    border: emailColors.accent,
    title: emailColors.text,
  },
  neutral: {
    bg: emailColors.paper,
    border: emailColors.border,
    title: emailColors.text,
  },
};

export function StatusBanner({
  title,
  children,
  tone = 'info',
}: StatusBannerProps) {
  const t = toneStyles[tone];
  return (
    <Section
      style={{
        margin: '0 0 20px',
        padding: '16px 18px',
        backgroundColor: t.bg,
        borderLeft: `3px solid ${t.border}`,
        borderRadius: '2px',
      }}
    >
      <Text
        style={{
          margin: '0 0 6px',
          fontFamily: emailFonts.heading,
          fontSize: '18px',
          lineHeight: '24px',
          color: t.title,
        }}
      >
        {title}
      </Text>
      {children ? (
        <Text
          style={{
            margin: 0,
            fontSize: '14px',
            lineHeight: '22px',
            color: emailColors.muted,
          }}
        >
          {children}
        </Text>
      ) : null}
    </Section>
  );
}
