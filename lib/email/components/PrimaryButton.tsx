import * as React from 'react';
import { Button, Section } from '@/lib/email/react-email';
import { emailColors, emailFonts } from '@/lib/email/tokens';

type PrimaryButtonProps = {
  href: string;
  children: React.ReactNode;
};

export function PrimaryButton({ href, children }: PrimaryButtonProps) {
  return (
    <Section style={{ margin: '8px 0 4px', textAlign: 'center' as const }}>
      <Button
        href={href}
        style={{
          display: 'inline-block',
          backgroundColor: emailColors.accent,
          color: emailColors.white,
          fontFamily: emailFonts.body,
          fontSize: '15px',
          fontWeight: 600,
          lineHeight: '20px',
          textDecoration: 'none',
          padding: '14px 28px',
          borderRadius: '2px',
          border: `1px solid ${emailColors.accent}`,
        }}
      >
        {children}
      </Button>
    </Section>
  );
}
