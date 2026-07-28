import * as React from 'react';
import { Column, Hr, Row, Section, Text } from '@/lib/email/react-email';
import { formatMoneyPln } from '@/lib/email/format';
import { emailColors, emailFonts } from '@/lib/email/tokens';

type PriceSummaryProps = {
  subtotalGrosz: number;
  shippingGrosz?: number | null;
  totalGrosz: number;
  shippingPending?: boolean;
  shippingLabel?: string;
};

function RowLine({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <Row style={{ margin: '0 0 6px' }}>
      <Column>
        <Text
          style={{
            margin: 0,
            fontSize: strong ? '15px' : '14px',
            lineHeight: '22px',
            color: emailColors.text,
            fontWeight: strong ? 600 : 400,
            fontFamily: strong ? emailFonts.heading : emailFonts.body,
          }}
        >
          {label}
        </Text>
      </Column>
      <Column align="right" style={{ textAlign: 'right' as const }}>
        <Text
          style={{
            margin: 0,
            fontSize: strong ? '15px' : '14px',
            lineHeight: '22px',
            color: emailColors.text,
            fontWeight: strong ? 600 : 400,
            fontFamily: strong ? emailFonts.heading : emailFonts.body,
            textAlign: 'right' as const,
          }}
        >
          {value}
        </Text>
      </Column>
    </Row>
  );
}

export function PriceSummary({
  subtotalGrosz,
  shippingGrosz,
  totalGrosz,
  shippingPending,
  shippingLabel = 'Wysyłka',
}: PriceSummaryProps) {
  const shippingValue = shippingPending
    ? 'do potwierdzenia'
    : typeof shippingGrosz === 'number'
      ? formatMoneyPln(shippingGrosz)
      : null;

  return (
    <Section style={{ margin: '0 0 20px' }}>
      <Text
        style={{
          margin: '0 0 10px',
          fontFamily: emailFonts.heading,
          fontSize: '16px',
          color: emailColors.text,
        }}
      >
        Podsumowanie
      </Text>
      <RowLine label="Suma pozycji" value={formatMoneyPln(subtotalGrosz)} />
      {shippingValue !== null ? (
        <RowLine label={shippingLabel} value={shippingValue} />
      ) : null}
      <Hr
        style={{
          borderColor: emailColors.border,
          borderWidth: '1px 0 0',
          margin: '10px 0',
        }}
      />
      <RowLine
        label="Razem"
        value={
          shippingPending && shippingGrosz == null
            ? `${formatMoneyPln(totalGrosz)} + wysyłka`
            : formatMoneyPln(totalGrosz)
        }
        strong
      />
    </Section>
  );
}
