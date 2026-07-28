import * as React from 'react';
import { Section, Text } from '@/lib/email/react-email';
import { formatBankAccountGrouped, formatMoneyPln } from '@/lib/email/format';
import type { PaymentInstructionsMode } from '@/lib/email/types';
import { emailColors, emailFonts } from '@/lib/email/tokens';
import { PrimaryButton } from './PrimaryButton';

type PaymentInstructionsProps = {
  payment?: PaymentInstructionsMode | null;
};

export function PaymentInstructions({ payment }: PaymentInstructionsProps) {
  if (!payment || payment.mode === 'none') return null;

  if (payment.mode === 'shipping_pending') {
    return (
      <Section
        style={{
          margin: '0 0 20px',
          padding: '16px 18px',
          backgroundColor: emailColors.bannerInfoBg,
          border: `1px solid ${emailColors.border}`,
          borderRadius: '2px',
        }}
      >
        <Text
          style={{
            margin: '0 0 6px',
            fontFamily: emailFonts.heading,
            fontSize: '16px',
            color: emailColors.text,
          }}
        >
          Płatność po wycenie wysyłki
        </Text>
        <Text
          style={{
            margin: 0,
            fontSize: '14px',
            lineHeight: '22px',
            color: emailColors.muted,
          }}
        >
          {payment.message ??
            'Koszt wysyłki potwierdzimy osobno. Prosimy nie przelewać środków, dopóki nie otrzymasz finalnej kwoty.'}
        </Text>
      </Section>
    );
  }

  if (payment.mode === 'processing') {
    return (
      <Section
        style={{
          margin: '0 0 20px',
          padding: '16px 18px',
          backgroundColor: emailColors.bannerInfoBg,
          border: `1px solid ${emailColors.border}`,
          borderRadius: '2px',
        }}
      >
        <Text
          style={{
            margin: '0 0 6px',
            fontFamily: emailFonts.heading,
            fontSize: '16px',
            color: emailColors.text,
          }}
        >
          Płatność w trakcie realizacji
        </Text>
        <Text
          style={{
            margin: 0,
            fontSize: '14px',
            lineHeight: '22px',
            color: emailColors.muted,
          }}
        >
          {payment.message ??
            'Oczekujemy na potwierdzenie płatności. Nie musisz nic robić — damy znać, gdy wszystko będzie gotowe.'}
        </Text>
      </Section>
    );
  }

  if (payment.mode === 'stripe_pay_cta') {
    const amount =
      typeof payment.amountGrosz === 'number'
        ? formatMoneyPln(payment.amountGrosz)
        : null;
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
          Płatność online
        </Text>
        <Text
          style={{
            margin: '0 0 14px',
            fontSize: '14px',
            lineHeight: '22px',
            color: emailColors.muted,
          }}
        >
          {amount
            ? `Aby dokończyć zamówienie, opłać kwotę ${amount} bezpieczną płatnością online.`
            : 'Aby dokończyć zamówienie, opłać je bezpieczną płatnością online.'}
        </Text>
        <PrimaryButton href={payment.payUrl}>
          {payment.buttonLabel ?? 'Opłać zamówienie'}
        </PrimaryButton>
      </Section>
    );
  }

  // bank_transfer
  const d = payment.details;
  const account = formatBankAccountGrouped(d.accountNumber);
  const amount = formatMoneyPln(d.amountGrosz);

  return (
    <Section
      style={{
        margin: '0 0 20px',
        padding: '16px 18px',
        backgroundColor: emailColors.bannerWarningBg,
        border: `1px solid ${emailColors.border}`,
        borderRadius: '2px',
      }}
    >
      <Text
        style={{
          margin: '0 0 10px',
          fontFamily: emailFonts.heading,
          fontSize: '16px',
          color: emailColors.text,
        }}
      >
        Dane do przelewu
      </Text>
      <Text style={labelStyle}>Odbiorca</Text>
      <Text style={valueStyle}>{d.recipient}</Text>
      <Text style={labelStyle}>Numer konta</Text>
      <Text style={{ ...valueStyle, letterSpacing: '0.02em' }}>{account}</Text>
      {d.bankName ? (
        <>
          <Text style={labelStyle}>Bank</Text>
          <Text style={valueStyle}>{d.bankName}</Text>
        </>
      ) : null}
      <Text style={labelStyle}>Tytuł przelewu</Text>
      <Text style={valueStyle}>{d.title}</Text>
      <Text style={labelStyle}>Kwota</Text>
      <Text style={{ ...valueStyle, fontWeight: 600 }}>{amount}</Text>
      {d.deadlineNote ? (
        <Text
          style={{
            margin: '12px 0 0',
            fontSize: '13px',
            lineHeight: '20px',
            color: emailColors.muted,
          }}
        >
          {d.deadlineNote}
        </Text>
      ) : null}
      {d.extraInstructions ? (
        <Text
          style={{
            margin: '8px 0 0',
            fontSize: '13px',
            lineHeight: '20px',
            color: emailColors.muted,
          }}
        >
          {d.extraInstructions}
        </Text>
      ) : null}
    </Section>
  );
}

const labelStyle: React.CSSProperties = {
  margin: '10px 0 2px',
  fontSize: '11px',
  lineHeight: '16px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: emailColors.muted,
};

const valueStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '14px',
  lineHeight: '22px',
  color: emailColors.text,
};
