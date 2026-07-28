import * as React from 'react';
import { Section, Text } from '@/lib/email/react-email';
import { formatMoneyPln, formatWarsawDate } from '@/lib/email/format';
import type { WorkshopDetail } from '@/lib/email/types';
import { emailColors, emailFonts } from '@/lib/email/tokens';

type WorkshopDetailsProps = {
  workshop: WorkshopDetail;
};

export function WorkshopDetails({ workshop }: WorkshopDetailsProps) {
  const date = formatWarsawDate(workshop.startsAt);
  const participants = workshop.participants ?? [];

  return (
    <Section style={{ margin: '0 0 20px' }}>
      <Text
        style={{
          margin: '0 0 8px',
          fontFamily: emailFonts.heading,
          fontSize: '16px',
          color: emailColors.text,
        }}
      >
        Szczegóły warsztatu
      </Text>
      <Text
        style={{
          margin: '0 0 4px',
          fontSize: '15px',
          lineHeight: '22px',
          color: emailColors.text,
          fontWeight: 600,
        }}
      >
        {workshop.title}
      </Text>
      <Text
        style={{
          margin: '0 0 2px',
          fontSize: '14px',
          lineHeight: '22px',
          color: emailColors.muted,
        }}
      >
        {date}
      </Text>
      {workshop.location ? (
        <Text
          style={{
            margin: '0 0 2px',
            fontSize: '14px',
            lineHeight: '22px',
            color: emailColors.muted,
          }}
        >
          Miejsce: {workshop.location}
        </Text>
      ) : null}
      <Text
        style={{
          margin: '0 0 2px',
          fontSize: '14px',
          lineHeight: '22px',
          color: emailColors.muted,
        }}
      >
        Liczba miejsc: {workshop.quantity}
        {typeof workshop.unitPriceGrosz === 'number'
          ? ` · ${formatMoneyPln(workshop.unitPriceGrosz)} / miejsce`
          : ''}
      </Text>
      {participants.length > 0 ? (
        <Section style={{ marginTop: '10px' }}>
          <Text
            style={{
              margin: '0 0 4px',
              fontSize: '13px',
              color: emailColors.text,
              fontWeight: 600,
            }}
          >
            Uczestnicy
          </Text>
          {participants.map((p, i) => (
            <Text
              key={`${p.displayName ?? 'p'}-${i}`}
              style={{
                margin: '0 0 2px',
                fontSize: '13px',
                lineHeight: '20px',
                color: emailColors.muted,
              }}
            >
              {i + 1}. {p.displayName?.trim() || 'Uczestnik'}
              {p.age != null ? ` (${p.age} l.)` : ''}
            </Text>
          ))}
        </Section>
      ) : null}
    </Section>
  );
}
