import * as React from 'react';
import { Section, Text } from '@/lib/email/react-email';
import { formatMoneyPln } from '@/lib/email/format';
import type { EmailLineItem } from '@/lib/email/types';
import { emailColors, emailFonts } from '@/lib/email/tokens';

type OrderSummaryProps = {
  orderReference: string;
  items: EmailLineItem[];
  bookingReferences?: string[];
};

export function OrderSummary({
  orderReference,
  items,
  bookingReferences,
}: OrderSummaryProps) {
  if (!items.length && !bookingReferences?.length) return null;

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
        Zamówienie {orderReference}
      </Text>
      {bookingReferences && bookingReferences.length > 0 ? (
        <Text
          style={{
            margin: '0 0 12px',
            fontSize: '13px',
            lineHeight: '20px',
            color: emailColors.muted,
          }}
        >
          Rezerwacje warsztatów: {bookingReferences.join(', ')}
        </Text>
      ) : null}
      {items.map((item, index) => (
        <Section
          key={`${item.title}-${index}`}
          style={{
            margin: '0 0 10px',
            paddingBottom: '10px',
            borderBottom:
              index < items.length - 1
                ? `1px solid ${emailColors.border}`
                : 'none',
          }}
        >
          <Text
            style={{
              margin: '0 0 2px',
              fontSize: '14px',
              lineHeight: '20px',
              color: emailColors.text,
            }}
          >
            {item.title}
            {item.quantity > 1 ? ` × ${item.quantity}` : ''}
          </Text>
          {(item.fulfillmentLabel || item.meta) && (
            <Text
              style={{
                margin: '0 0 2px',
                fontSize: '12px',
                lineHeight: '18px',
                color: emailColors.muted,
              }}
            >
              {[item.fulfillmentLabel, item.meta].filter(Boolean).join(' · ')}
            </Text>
          )}
          <Text
            style={{
              margin: 0,
              fontSize: '14px',
              lineHeight: '20px',
              color: emailColors.text,
            }}
          >
            {formatMoneyPln(item.lineTotalGrosz)}
          </Text>
        </Section>
      ))}
    </Section>
  );
}
