import * as React from 'react';
import { Section, Text } from '@/lib/email/react-email';
import { formatMoneyPln } from '@/lib/email/format';
import type { EmailAddressBlock, EmailLineItem } from '@/lib/email/types';
import { emailColors, emailFonts } from '@/lib/email/tokens';

type ProductDetailsProps = {
  items: EmailLineItem[];
  shippingAddress?: EmailAddressBlock | null;
  pickupNote?: string | null;
  trackingReference?: string | null;
};

function formatAddress(a: EmailAddressBlock): string {
  return [
    a.recipientName,
    a.streetLine1,
    a.streetLine2,
    `${a.postalCode} ${a.city}`.trim(),
    a.country && a.country !== 'PL' && a.country !== 'Polska'
      ? a.country
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function ProductDetails({
  items,
  shippingAddress,
  pickupNote,
  trackingReference,
}: ProductDetailsProps) {
  const products = items.filter((i) => i.kind !== 'workshop');
  if (
    products.length === 0 &&
    !shippingAddress &&
    !pickupNote &&
    !trackingReference
  ) {
    return null;
  }

  return (
    <Section style={{ margin: '0 0 20px' }}>
      {products.length > 0 ? (
        <>
          <Text
            style={{
              margin: '0 0 8px',
              fontFamily: emailFonts.heading,
              fontSize: '16px',
              color: emailColors.text,
            }}
          >
            Produkty
          </Text>
          {products.map((item, index) => (
            <Text
              key={`${item.title}-${index}`}
              style={{
                margin: '0 0 6px',
                fontSize: '14px',
                lineHeight: '20px',
                color: emailColors.text,
              }}
            >
              {item.title}
              {item.quantity > 1 ? ` × ${item.quantity}` : ''}
              {' — '}
              {formatMoneyPln(item.lineTotalGrosz)}
              {item.fulfillmentLabel ? ` (${item.fulfillmentLabel})` : ''}
            </Text>
          ))}
        </>
      ) : null}

      {shippingAddress ? (
        <Section style={{ marginTop: products.length ? '12px' : 0 }}>
          <Text
            style={{
              margin: '0 0 4px',
              fontSize: '13px',
              fontWeight: 600,
              color: emailColors.text,
            }}
          >
            Adres dostawy
          </Text>
          {formatAddress(shippingAddress)
            .split('\n')
            .map((line) => (
              <Text
                key={line}
                style={{
                  margin: 0,
                  fontSize: '13px',
                  lineHeight: '20px',
                  color: emailColors.muted,
                }}
              >
                {line}
              </Text>
            ))}
        </Section>
      ) : null}

      {pickupNote ? (
        <Text
          style={{
            margin: '12px 0 0',
            fontSize: '13px',
            lineHeight: '20px',
            color: emailColors.muted,
          }}
        >
          {pickupNote}
        </Text>
      ) : null}

      {trackingReference ? (
        <Text
          style={{
            margin: '12px 0 0',
            fontSize: '14px',
            lineHeight: '22px',
            color: emailColors.text,
          }}
        >
          Numer przesyłki: <strong>{trackingReference}</strong>
        </Text>
      ) : null}
    </Section>
  );
}
