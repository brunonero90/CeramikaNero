import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
} from '@/lib/email/react-email';
import { emailColors, emailFonts, emailLayout } from '@/lib/email/tokens';

type EmailShellProps = {
  preview: string;
  children: React.ReactNode;
};

export function EmailShell({ preview, children }: EmailShellProps) {
  return (
    <Html lang="pl">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: emailColors.cream,
          fontFamily: emailFonts.body,
          color: emailColors.text,
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <Section
          style={{
            padding: `${emailLayout.outerPadding}px 12px`,
            backgroundColor: emailColors.cream,
          }}
        >
          <Container
            style={{
              maxWidth: `${emailLayout.maxWidth}px`,
              margin: '0 auto',
              backgroundColor: emailColors.paper,
              border: `1px solid ${emailColors.border}`,
              borderRadius: `${emailLayout.radius}px`,
              overflow: 'hidden',
            }}
          >
            {children}
          </Container>
        </Section>
      </Body>
    </Html>
  );
}
