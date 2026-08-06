import { readFileSync, writeFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content);
}

function replaceOnce(path, before, after) {
  let content = read(path);
  if (content.includes(after)) return;
  if (!content.includes(before)) {
    throw new Error(`Anchor not found in ${path}: ${before.slice(0, 100)}`);
  }
  content = content.replace(before, after);
  write(path, content);
}

function replaceBetween(path, start, end, replacement) {
  let content = read(path);
  if (content.includes(replacement)) return;
  const from = content.indexOf(start);
  const to = content.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`Range anchors not found in ${path}`);
  content = content.slice(0, from) + replacement + content.slice(to);
  write(path, content);
}

function appendOnce(path, marker, addition) {
  let content = read(path);
  if (content.includes(marker)) return;
  content += addition;
  write(path, content);
}

// ---------------------------------------------------------------------------
// Checkout UI: adult-name reuse, mixed child/adult handling, follow-up picker.
// ---------------------------------------------------------------------------

replaceOnce(
  'components/clone/checkout-page-client.tsx',
  "import { formatPrice } from '@/lib/utils/price';",
  "import { formatPrice } from '@/lib/utils/price';\nimport type { CartLine, CartLineWorkshop } from '@/lib/cart/types';"
);

replaceOnce(
  'components/clone/checkout-page-client.tsx',
  `function formatExpiry(value: string | null): string {\n  if (!value) return 'bez terminu ważności';\n  return new Intl.DateTimeFormat('pl-PL', {\n    dateStyle: 'long',\n    timeZone: 'Europe/Warsaw',\n  }).format(new Date(value));\n}\n`,
  `function formatExpiry(value: string | null): string {\n  if (!value) return 'bez terminu ważności';\n  return new Intl.DateTimeFormat('pl-PL', {\n    dateStyle: 'long',\n    timeZone: 'Europe/Warsaw',\n  }).format(new Date(value));\n}\n\nfunction formatFollowupDate(value: string): string {\n  return new Intl.DateTimeFormat('pl-PL', {\n    dateStyle: 'full',\n    timeStyle: 'short',\n    timeZone: 'Europe/Warsaw',\n  }).format(new Date(value));\n}\n`
);

replaceOnce(
  'components/clone/checkout-page-client.tsx',
  `  const [participantsBySession, setParticipantsBySession] = useState<\n    Record<string, Participant[]>\n  >({});\n`,
  `  const [participantsBySession, setParticipantsBySession] = useState<\n    Record<string, Participant[]>\n  >({});\n  const [followupByPrimary, setFollowupByPrimary] = useState<\n    Record<string, string>\n  >({});\n`
);

replaceOnce(
  'components/clone/checkout-page-client.tsx',
  `  const voucherEligibleCart = useMemo(\n    () =>\n      (validated?.lines ?? []).length > 0 &&\n      (validated?.lines ?? []).every(\n        (line) => line.type === 'workshop_session'\n      ),\n    [validated]\n  );\n`,
  `  const expandedLines = useMemo<CartLine[]>(() => {\n    if (!validated) return [];\n    const result: CartLine[] = [];\n    for (const line of validated.lines) {\n      if (line.type !== 'workshop_session' || !line.requiresFollowupSession) {\n        result.push(line);\n        continue;\n      }\n      const selected = (line.followupOptions ?? []).find(\n        (option) => option.sessionId === followupByPrimary[line.sessionId]\n      );\n      if (!selected) {\n        result.push({ ...line, linkRole: 'primary' });\n        continue;\n      }\n      const groupKey = \`${'${line.sessionId}'}:${'${selected.sessionId}'}\`;\n      result.push({ ...line, linkRole: 'primary', linkGroupKey: groupKey });\n      const followup: CartLineWorkshop = {\n        type: 'workshop_session',\n        key: \`followup:${'${line.sessionId}'}:${'${selected.sessionId}'}\`,\n        sessionId: selected.sessionId,\n        workshopId: selected.workshopId,\n        workshopSlug: selected.workshopSlug,\n        workshopTitle: selected.workshopTitle,\n        startsAt: selected.startsAt,\n        timezone: selected.timezone,\n        venueKey: selected.venueKey,\n        locationName: selected.locationName,\n        locationAddress: selected.locationAddress,\n        quantity: line.quantity,\n        unitPriceHintGrosz: selected.unitPriceGrosz,\n        linkRole: 'followup',\n        linkedPrimarySessionId: line.sessionId,\n        linkGroupKey: groupKey,\n      };\n      result.push(followup);\n    }\n    return result;\n  }, [validated, followupByPrimary]);\n\n  const followupComplete = useMemo(\n    () =>\n      (validated?.lines ?? []).every(\n        (line) =>\n          line.type !== 'workshop_session' ||\n          !line.requiresFollowupSession ||\n          Boolean(followupByPrimary[line.sessionId])\n      ),\n    [validated, followupByPrimary]\n  );\n\n  const checkoutSubtotalGrosz = useMemo(\n    () =>\n      expandedLines.reduce(\n        (sum, line) => sum + line.unitPriceHintGrosz * line.quantity,\n        0\n      ),\n    [expandedLines]\n  );\n\n  const voucherEligibleCart = useMemo(\n    () =>\n      followupComplete &&\n      expandedLines.length > 0 &&\n      expandedLines.every((line) => line.type === 'workshop_session'),\n    [expandedLines, followupComplete]\n  );\n`
);

replaceOnce(
  'components/clone/checkout-page-client.tsx',
  `      setParticipantsBySession(next);\n      setVoucherPreview(null);`,
  `      setParticipantsBySession(next);\n      const followups: Record<string, string> = {};\n      for (const line of result.lines) {\n        if (line.type === 'workshop_session' && line.requiresFollowupSession) {\n          followups[line.sessionId] = '';\n        }\n      }\n      setFollowupByPrimary(followups);\n      setVoucherPreview(null);`
);

replaceOnce(
  'components/clone/checkout-page-client.tsx',
  `    if (!voucherEligibleCart) {\n      setVoucherError('Bon można wykorzystać wyłącznie na warsztaty.');`,
  `    if (!followupComplete) {\n      setVoucherError('Wybierz obowiązkowy termin drugiego etapu warsztatu.');\n      return;\n    }\n    if (!voucherEligibleCart) {\n      setVoucherError('Bon można wykorzystać wyłącznie na warsztaty.');`
);

replaceOnce(
  'components/clone/checkout-page-client.tsx',
  `        lines: validated.lines,`,
  `        lines: expandedLines,`
);

replaceOnce(
  'components/clone/checkout-page-client.tsx',
  `    if (paymentUnavailable) {`,
  `    if (!followupComplete) {\n      setError('Wybierz obowiązkowy termin szkliwienia przed złożeniem rezerwacji.');\n      return;\n    }\n    if (paymentUnavailable) {`
);

replaceOnce(
  'components/clone/checkout-page-client.tsx',
  `    startTransition(async () => {\n      setError(null);\n      const result = await submitCartOrder({`,
  `    startTransition(async () => {\n      setError(null);\n      const checkoutParticipants: Record<string, Participant[]> = {};\n      for (const line of validated.lines) {\n        if (line.type !== 'workshop_session') continue;\n        const source = participantsBySession[line.sessionId] ?? [];\n        const participants = source.map((participant, index) => {\n          if (line.participantAudience === 'adult') {\n            return {\n              ...participant,\n              display_name:\n                index === 0\n                  ? \`${'${firstName}'} ${'${lastName}'}\`.trim()\n                  : participant.display_name,\n              age: '',\n              participant_type: 'adult' as const,\n            };\n          }\n          if (line.participantAudience === 'child') {\n            return { ...participant, participant_type: 'child' as const };\n          }\n          return participant;\n        });\n        checkoutParticipants[line.sessionId] = participants;\n        const selectedFollowup = followupByPrimary[line.sessionId];\n        if (selectedFollowup) {\n          checkoutParticipants[selectedFollowup] = participants.map((participant) => ({\n            ...participant,\n          }));\n        }\n      }\n\n      const result = await submitCartOrder({`
);

replaceOnce(
  'components/clone/checkout-page-client.tsx',
  `        participantsBySession,`,
  `        participantsBySession: checkoutParticipants,`
);
replaceOnce(
  'components/clone/checkout-page-client.tsx',
  `        lines: validated.lines,`,
  `        lines: expandedLines,`
);

replaceBetween(
  'components/clone/checkout-page-client.tsx',
  `        {(validated?.lines ?? [])\n          .filter((line) => line.type === 'workshop_session')`,
  `        <section className="space-y-3 rounded border border-surface-subtle bg-surface-raised p-4">`,
  `        {(validated?.lines ?? [])\n          .filter((line) => line.type === 'workshop_session')\n          .map((line) => {\n            if (line.type !== 'workshop_session') return null;\n            const participants = participantsBySession[line.sessionId] ?? [];\n            const adult = line.participantAudience === 'adult';\n            if (adult && line.quantity === 1) {\n              return (\n                <section key={line.key} className="space-y-2 rounded border p-3">\n                  <h2 className="text-lg font-semibold">Uczestnik — {line.workshopTitle}</h2>\n                  <p className="text-sm text-text-muted">\n                    Użyjemy imienia i nazwiska z danych kupującego. Nie musisz wpisywać ich drugi raz.\n                  </p>\n                </section>\n              );\n            }\n            return (\n              <section key={line.key} className="space-y-3">\n                <h2 className="text-lg font-semibold">\n                  {adult ? 'Pozostali uczestnicy' : 'Uczestnicy'} — {line.workshopTitle}\n                </h2>\n                {adult ? (\n                  <p className="text-sm text-text-muted">\n                    Pierwsze miejsce przypisujemy osobie kupującej. Podaj tylko pozostałych uczestników.\n                  </p>\n                ) : null}\n                {participants.map((participant, index) => {\n                  if (adult && index === 0) return null;\n                  const child =\n                    line.participantAudience === 'child' ||\n                    (line.participantAudience === 'mixed' &&\n                      participant.participant_type === 'child');\n                  return (\n                    <div\n                      key={\`${'${line.sessionId}'}-${'${index}'}\`}\n                      className="grid gap-2 border p-3 sm:grid-cols-2"\n                    >\n                      {line.participantAudience === 'mixed' ? (\n                        <label className="text-sm">\n                          Uczestnik\n                          <select\n                            required\n                            className="mt-1 w-full border px-3 py-2"\n                            value={participant.participant_type}\n                            onChange={(event) =>\n                              updateParticipant(\n                                line.sessionId,\n                                index,\n                                'participant_type',\n                                event.target.value\n                              )\n                            }\n                          >\n                            <option value="unspecified">Wybierz</option>\n                            <option value="adult">Dorosły</option>\n                            <option value="child">Dziecko</option>\n                          </select>\n                        </label>\n                      ) : null}\n                      <label className="text-sm">\n                        Imię uczestnika\n                        <input\n                          required\n                          className="mt-1 w-full border px-3 py-2"\n                          value={participant.display_name}\n                          onChange={(event) =>\n                            updateParticipant(\n                              line.sessionId,\n                              index,\n                              'display_name',\n                              event.target.value\n                            )\n                          }\n                        />\n                      </label>\n                      {line.collectParticipantAge && child ? (\n                        <label className="text-sm">\n                          Wiek dziecka\n                          <input\n                            type="number"\n                            min={line.minimumAge ?? 0}\n                            max={line.maximumAge ?? 17}\n                            required\n                            className="mt-1 w-full border px-3 py-2"\n                            value={participant.age}\n                            onChange={(event) =>\n                              updateParticipant(\n                                line.sessionId,\n                                index,\n                                'age',\n                                event.target.value\n                              )\n                            }\n                          />\n                        </label>\n                      ) : null}\n                      <label className="text-sm sm:col-span-2">\n                        Ważne informacje organizacyjne / potrzeby dostępności\n                        <textarea\n                          className="mt-1 w-full border px-3 py-2"\n                          rows={2}\n                          maxLength={500}\n                          value={participant.accessibility_notes}\n                          onChange={(event) =>\n                            updateParticipant(\n                              line.sessionId,\n                              index,\n                              'accessibility_notes',\n                              event.target.value\n                            )\n                          }\n                        />\n                      </label>\n                    </div>\n                  );\n                })}\n              </section>\n            );\n          })}\n\n        {(validated?.lines ?? [])\n          .filter(\n            (line) =>\n              line.type === 'workshop_session' && line.requiresFollowupSession\n          )\n          .map((line) =>\n            line.type === 'workshop_session' ? (\n              <section\n                key={\`followup-picker-${'${line.sessionId}'}\`}\n                className="space-y-3 rounded border border-accent-primary/30 bg-surface-raised p-4"\n              >\n                <h2 className="text-lg font-semibold">Drugi etap — szkliwienie</h2>\n                <p className="text-sm text-text-muted">\n                  Ten warsztat wymaga drugiego spotkania. Zarezerwujemy tę samą liczbę miejsc w obu terminach w jednym zamówieniu.\n                </p>\n                <label className="block text-sm">\n                  Wybierz termin szkliwienia\n                  <select\n                    required\n                    className="mt-1 w-full border px-3 py-2"\n                    value={followupByPrimary[line.sessionId] ?? ''}\n                    onChange={(event) => {\n                      setFollowupByPrimary((previous) => ({\n                        ...previous,\n                        [line.sessionId]: event.target.value,\n                      }));\n                      resetVoucherValidation();\n                    }}\n                  >\n                    <option value="">Wybierz termin</option>\n                    {(line.followupOptions ?? []).map((option) => (\n                      <option key={option.sessionId} value={option.sessionId}>\n                        {formatFollowupDate(option.startsAt)} · {option.workshopTitle} · {\n                          option.unitPriceGrosz > 0\n                            ? formatPrice(option.unitPriceGrosz * line.quantity)\n                            : 'w cenie'\n                        }\n                      </option>\n                    ))}\n                  </select>\n                </label>\n              </section>\n            ) : null\n          )}\n\n`
);

replaceOnce(
  'components/clone/checkout-page-client.tsx',
  `{formatPrice(validated?.subtotalGrosz ?? 0)}`,
  `{formatPrice(checkoutSubtotalGrosz)}`
);
replaceOnce(
  'components/clone/checkout-page-client.tsx',
  `                    validated?.subtotalGrosz ??\n                    0`,
  `                    checkoutSubtotalGrosz`
);
replaceOnce(
  'components/clone/checkout-page-client.tsx',
  `            !validated?.canCheckout ||\n            paymentUnavailable`,
  `            !validated?.canCheckout ||\n            !followupComplete ||\n            paymentUnavailable`
);

// ---------------------------------------------------------------------------
// Server checkout validation and v4 RPC.
// ---------------------------------------------------------------------------

replaceOnce(
  'lib/cart/checkout.ts',
  `  if (msg.includes('insufficient capacity')) {\n    return 'Brak wolnych miejsc. Odśwież koszyk i spróbuj ponownie.';\n  }`,
  `  if (msg.includes('follow-up') || msg.includes('linked bookings')) {\n    return 'Wybrany termin drugiego etapu nie jest już dostępny. Wybierz inny termin i spróbuj ponownie.';\n  }\n  if (msg.includes('insufficient capacity')) {\n    return 'Brak wolnych miejsc. Odśwież koszyk i spróbuj ponownie.';\n  }`
);

replaceOnce(
  'lib/cart/checkout.ts',
  `  const needsShipping = revalidated.lines.some(`,
  `  const workshopLines = revalidated.lines.filter(\n    (line) => line.type === 'workshop_session'\n  );\n  for (const primary of workshopLines) {\n    if (primary.type !== 'workshop_session' || !primary.requiresFollowupSession) {\n      continue;\n    }\n    const followup = workshopLines.find(\n      (candidate) =>\n        candidate.type === 'workshop_session' &&\n        candidate.linkRole === 'followup' &&\n        candidate.linkedPrimarySessionId === primary.sessionId\n    );\n    if (!followup || followup.type !== 'workshop_session') {\n      return {\n        ok: false,\n        error: 'Wybierz obowiązkowy termin drugiego etapu warsztatu.',\n      };\n    }\n    if (followup.quantity !== primary.quantity) {\n      return {\n        ok: false,\n        error: 'Liczba miejsc musi być taka sama w obu etapach warsztatu.',\n      };\n    }\n    if (\n      !(primary.followupOptions ?? []).some(\n        (option) => option.sessionId === followup.sessionId\n      )\n    ) {\n      return {\n        ok: false,\n        error:\n          'Wybrany termin drugiego etapu nie jest już dostępny. Odśwież stronę.',\n      };\n    }\n  }\n\n  const needsShipping = revalidated.lines.some(`
);

replaceBetween(
  'lib/cart/checkout.ts',
  `    if (line.ageRequired) {`,
  `  const { ipKey, secondaryKey } = await getRateLimitKeys({`,
  `    const audience = line.participantAudience ?? 'adult';\n    for (const [index, part] of parts.entries()) {\n      const participantType =\n        audience === 'adult'\n          ? 'adult'\n          : audience === 'child'\n            ? 'child'\n            : part.participant_type;\n      if (audience === 'mixed' && participantType === 'unspecified') {\n        return {\n          ok: false,\n          error: \`Wybierz, czy uczestnik ${'${index + 1}'} jest dorosły czy jest dzieckiem.\`,\n        };\n      }\n      if (participantType !== 'child' || !line.collectParticipantAge) {\n        continue;\n      }\n      const age = normalizeParticipantAge(part.age);\n      if (age == null) {\n        return {\n          ok: false,\n          error: \`Podaj wiek dziecka ${'${index + 1}'} dla warsztatu „${'${line.workshopTitle}'}”.\`,\n        };\n      }\n      if (\n        (line.minimumAge != null && age < line.minimumAge) ||\n        (line.maximumAge != null && age > line.maximumAge)\n      ) {\n        const range =\n          line.minimumAge != null && line.maximumAge != null\n            ? \`${'${line.minimumAge}'}–${'${line.maximumAge}'}\`\n            : line.minimumAge != null\n              ? \`${'${line.minimumAge}'}+\`\n              : \`do ${'${line.maximumAge}'}\`;\n        return {\n          ok: false,\n          error: \`Wiek dziecka ${'${index + 1}'} jest poza limitem warsztatu (${'${range}'}).\`,\n        };\n      }\n    }\n  }\n\n`
);

replaceOnce(
  'lib/cart/checkout.ts',
  `        participants: (data.participantsBySession[line.sessionId] ?? []).map(`,
  `        link_role: line.linkRole ?? null,\n        linked_primary_session_id: line.linkedPrimarySessionId ?? null,\n        link_group_key: line.linkGroupKey ?? null,\n        participants: (data.participantsBySession[line.sessionId] ?? []).map(`
);
replaceOnce(
  'lib/cart/checkout.ts',
  `  ).rpc('submit_cart_order_v3', {`,
  `  ).rpc('submit_cart_order_v4', {`
);
replaceOnce(
  'lib/cart/checkout.ts',
  `    console.error('submit_cart_order_v3 failed', {`,
  `    console.error('submit_cart_order_v4 failed', {`
);

// ---------------------------------------------------------------------------
// Reminder email types, templates and dispatch.
// ---------------------------------------------------------------------------

replaceOnce(
  'lib/database/schema.ts',
  `  'admin_notification',\n]);`,
  `  'admin_notification',\n  'reminder',\n]);`
);
replaceOnce(
  'lib/email/types.ts',
  `  'admin_notification',\n] as const;`,
  `  'admin_notification',\n  'reminder',\n] as const;`
);
replaceOnce(
  'lib/email/catalog.ts',
  `  buildBookingPaymentProblem,\n  buildBookingRefund,`,
  `  buildBookingPaymentProblem,\n  buildBookingRefund,\n  buildBookingReminder,`
);
replaceOnce(
  'lib/email/catalog.ts',
  `  admin_notification: buildBookingAdminNotification,\n};`,
  `  admin_notification: buildBookingAdminNotification,\n  reminder: buildBookingReminder,\n};`
);

replaceOnce(
  'lib/email/templates/bookings.tsx',
  `export function buildBookingAdminNotification(`,
  `export function buildBookingReminder(\n  ctx: BookingEmailContext\n): EmailTemplateResult {\n  const subject = \`Przypomnienie o warsztacie — ${'${ctx.workshopTitle}'}\`;\n  const preheader = \`Do zobaczenia jutro. Rezerwacja ${'${ctx.reference}'}.\`;\n  const detail =\n    'Przypominamy o warsztacie zaplanowanym na jutro. Poniżej znajdziesz termin, miejsce i listę uczestników.';\n\n  return pack(\n    subject,\n    preheader,\n    <EmailLayout\n      preview={preheader}\n      siteUrl={ctx.siteUrl}\n      greeting={greet(ctx.customerName)}\n      bannerTitle="Warsztat już jutro"\n      bannerTone="info"\n      bannerBody={detail}\n      payment={{ mode: 'none' }}\n    >\n      <BookingBody\n        ctx={{ ...ctx, cancellationUrl: null, payment: { mode: 'none' } }}\n      />\n    </EmailLayout>,\n    buildBookingPlainText({\n      greeting: greet(ctx.customerName),\n      status: 'Warsztat już jutro',\n      detail,\n      ctx: { ...ctx, cancellationUrl: null, payment: { mode: 'none' } },\n    })\n  );\n}\n\nexport function buildBookingAdminNotification(`
);

replaceOnce(
  'lib/booking/email-templates.ts',
  `export function buildAdminNotificationEmail(ctx: BookingEmailTemplateContext) {`,
  `export function buildReminderEmail(ctx: BookingEmailTemplateContext) {\n  const date = formatWarsawDate(ctx.sessionStartsAt);\n  const subject = \`Przypomnienie: ${'${ctx.workshopTitle}'} już jutro\`;\n  const participants = participantList(ctx);\n  const html = \`\n    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; color: #222;">\n      <h1 style="font-size: 22px;">Warsztat już jutro</h1>\n      <p>Dzień dobry ${'${ctx.customerName}'},</p>\n      <p>Przypominamy o rezerwacji <strong>${'${ctx.reference}'}</strong>.</p>\n      <p><strong>${'${ctx.workshopTitle}'}</strong><br>Termin: ${'${date}'}<br>Miejsce: ${'${ctx.sessionLocation || "—"}'}</p>\n      <p>Uczestnicy:<br>${'${participants.replace(/\\n/g, "<br>")}'}</p>\n      <p>Do zobaczenia!<br>${'${siteContact.brand}'}</p>\n    </div>\n  \`;\n  const text = [\n    'Warsztat już jutro',\n    \`Rezerwacja: ${'${ctx.reference}'}\`,\n    \`Warsztat: ${'${ctx.workshopTitle}'}\`,\n    \`Termin: ${'${date}'}\`,\n    \`Miejsce: ${'${ctx.sessionLocation || "—"}'}\`,\n    'Uczestnicy:',\n    participants,\n    'Do zobaczenia!',\n    siteContact.brand,\n  ].join('\\n');\n  return { subject, html, text };\n}\n\nexport function buildAdminNotificationEmail(ctx: BookingEmailTemplateContext) {`
);

replaceOnce(
  'lib/booking/email-dispatch.ts',
  `  buildCustomerConfirmationEmail,\n  getBookingAdminEmail,`,
  `  buildCustomerConfirmationEmail,\n  buildReminderEmail,\n  getBookingAdminEmail,`
);
replaceOnce(
  'lib/booking/email-dispatch.ts',
  `  resendConfigured: boolean;\n};`,
  `  resendConfigured: boolean;\n  remindersQueued: number;\n};`
);
replaceOnce(
  'lib/booking/email-dispatch.ts',
  `  if (type === 'admin_notification') {`,
  `  if (type === 'reminder') {\n    return {\n      to: ctx.customerEmail,\n      ...buildReminderEmail(ctx),\n    };\n  }\n  if (type === 'admin_notification') {`
);
replaceOnce(
  'lib/booking/email-dispatch.ts',
  `    resendConfigured: isResendConfigured(),\n  };\n\n  const supabase = createAdminClient();`,
  `    resendConfigured: isResendConfigured(),\n    remindersQueued: 0,\n  };\n\n  const supabase = createAdminClient();\n  const reminderQueue = await (supabase as unknown as {\n    rpc: (name: string, args: Record<string, unknown>) => Promise<{\n      data: { queued?: number } | null;\n      error: { message: string } | null;\n    }>;\n  }).rpc('enqueue_booking_reminders', {\n    p_window_start: null,\n    p_window_end: null,\n  });\n  if (reminderQueue.error) {\n    console.warn('enqueue_booking_reminders failed', reminderQueue.error.message);\n  } else {\n    summary.remindersQueued = Number(reminderQueue.data?.queued ?? 0);\n  }`
);
replaceOnce(
  'lib/booking/email-dispatch.ts',
  `.in('email_type', ['confirmation', 'admin_notification'])`,
  `.in('email_type', ['confirmation', 'admin_notification', 'reminder'])`
);
replaceOnce(
  'lib/booking/email-dispatch.ts',
  `  for (const row of rows) {\n    const attempts =`,
  `  for (const row of rows) {\n    if (row.email_type === 'reminder') {\n      const eligibility = await supabase\n        .from('bookings')\n        .select('status, workshop_sessions!inner(starts_at, status)')\n        .eq('id', row.booking_id)\n        .maybeSingle();\n      const booking = eligibility.data as unknown as {\n        status: string;\n        workshop_sessions: { starts_at: string; status: string };\n      } | null;\n      if (\n        !booking ||\n        booking.status !== 'confirmed' ||\n        !['scheduled', 'sold_out'].includes(booking.workshop_sessions.status) ||\n        booking.workshop_sessions.starts_at <= new Date().toISOString()\n      ) {\n        await supabase\n          .from('booking_emails')\n          .update(\n            emailRowUpdate({\n              status: 'failed',\n              claimed_at: null,\n              error_message: 'permanent: booking no longer eligible for reminder',\n              next_attempt_at: null,\n            })\n          )\n          .eq('id', row.id);\n        await supabase.from('booking_events').insert({\n          booking_id: row.booking_id,\n          event_type: 'reminder_skipped',\n          actor_type: 'system',\n          metadata: { reason: 'booking_not_eligible_at_dispatch' },\n        } as never);\n        summary.skipped += 1;\n        continue;\n      }\n    }\n\n    const attempts =`
);
replaceOnce(
  'lib/booking/email-dispatch.ts',
  `      summary.sent += 1;\n      continue;`,
  `      if (row.email_type === 'reminder') {\n        await supabase.from('booking_events').insert({\n          booking_id: row.booking_id,\n          event_type: 'reminder_sent',\n          actor_type: 'system',\n          metadata: { provider_message_id: result.providerMessageId ?? null },\n        } as never);\n        console.info('[booking-reminder] sent', {\n          bookingId: row.booking_id,\n          emailId: row.id,\n          providerMessageId: result.providerMessageId ?? null,\n        });\n      }\n      summary.sent += 1;\n      continue;`
);

// ---------------------------------------------------------------------------
// Admin workshop metadata.
// ---------------------------------------------------------------------------

replaceOnce(
  'lib/admin/schemas.ts',
  `    maximumAge: z.number().int().min(0).max(120).optional().nullable(),`,
  `    maximumAge: z.number().int().min(0).max(120).optional().nullable(),\n    participantAudience: z.enum(['adult', 'child', 'mixed']).default('adult'),\n    collectParticipantAge: z.boolean().default(false),\n    workshopType: z.string().trim().min(1).max(120),\n    requiresFollowupSession: z.boolean().default(false),\n    followupWorkshopType: z.string().trim().max(120).optional().nullable(),\n    followupMinDays: z.number().int().min(0).max(365).optional().nullable(),\n    followupMaxDays: z.number().int().min(0).max(365).optional().nullable(),`
);
replaceOnce(
  'lib/admin/schemas.ts',
  `  .refine(\n    (data) => {\n      if (data.bookingMode === 'external') {`,
  `  .refine(\n    (data) =>\n      !data.requiresFollowupSession || Boolean(data.followupWorkshopType),\n    {\n      message: 'Podaj typ lub slug warsztatu drugiego etapu.',\n      path: ['followupWorkshopType'],\n    }\n  )\n  .refine(\n    (data) =>\n      data.followupMinDays == null ||\n      data.followupMaxDays == null ||\n      data.followupMinDays <= data.followupMaxDays,\n    {\n      message: 'Maksymalna liczba dni nie może być mniejsza od minimalnej.',\n      path: ['followupMaxDays'],\n    }\n  )\n  .refine(\n    (data) => {\n      if (data.bookingMode === 'external') {`
);

replaceOnce(
  'app/admin/(protected)/warsztaty/actions.ts',
  `    maximumAge: numberOrNull(formData.get('maximumAge')),`,
  `    maximumAge: numberOrNull(formData.get('maximumAge')),\n    participantAudience: formData.get('participantAudience') || 'adult',\n    collectParticipantAge: formData.get('collectParticipantAge') === 'on',\n    workshopType: formData.get('workshopType') || slug,\n    requiresFollowupSession:\n      formData.get('requiresFollowupSession') === 'on',\n    followupWorkshopType: formData.get('followupWorkshopType') || null,\n    followupMinDays: numberOrNull(formData.get('followupMinDays')),\n    followupMaxDays: numberOrNull(formData.get('followupMaxDays')),`
);

replaceOnce(
  'app/admin/(protected)/warsztaty/actions.ts',
  `  await recordAuditEvent(supabase, {\n    actorUserId: admin.userId,`,
  `  const metadataResult = await (supabase as unknown as {\n    rpc: (name: string, args: Record<string, unknown>) => Promise<{\n      error: { message: string } | null;\n    }>;\n  }).rpc('set_workshop_operational_metadata', {\n    p_workshop_id: workshopId,\n    p_participant_audience: data.participantAudience,\n    p_collect_participant_age: data.collectParticipantAge,\n    p_workshop_type: data.workshopType,\n    p_requires_followup_session: data.requiresFollowupSession,\n    p_followup_workshop_type: data.followupWorkshopType,\n    p_followup_min_days: data.followupMinDays,\n    p_followup_max_days: data.followupMaxDays,\n  });\n  if (metadataResult.error) {\n    return {\n      ok: false,\n      formError: 'Warsztat zapisano, ale nie udało się zapisać ustawień etapów.',\n      errors: {},\n    };\n  }\n\n  await recordAuditEvent(supabase, {\n    actorUserId: admin.userId,`
);

// Insert the same metadata call into update action (second audit occurrence).
{
  const path = 'app/admin/(protected)/warsztaty/actions.ts';
  let content = read(path);
  const needle = `  await recordAuditEvent(supabase, {\n    actorUserId: admin.userId,`;
  const first = content.indexOf(needle);
  const second = content.indexOf(needle, first + needle.length);
  const marker = `p_workshop_id: id,\n    p_participant_audience`;
  if (!content.includes(marker)) {
    if (second < 0) throw new Error('Second workshop audit anchor missing');
    const block = `  const metadataResult = await (supabase as unknown as {\n    rpc: (name: string, args: Record<string, unknown>) => Promise<{\n      error: { message: string } | null;\n    }>;\n  }).rpc('set_workshop_operational_metadata', {\n    p_workshop_id: id,\n    p_participant_audience: data.participantAudience,\n    p_collect_participant_age: data.collectParticipantAge,\n    p_workshop_type: data.workshopType,\n    p_requires_followup_session: data.requiresFollowupSession,\n    p_followup_workshop_type: data.followupWorkshopType,\n    p_followup_min_days: data.followupMinDays,\n    p_followup_max_days: data.followupMaxDays,\n  });\n  if (metadataResult.error) {\n    return {\n      ok: false,\n      formError: 'Warsztat zapisano, ale nie udało się zapisać ustawień etapów.',\n      errors: {},\n    };\n  }\n\n`;
    content = content.slice(0, second) + block + content.slice(second);
    write(path, content);
  }
}

replaceOnce(
  'app/admin/(protected)/warsztaty/workshop-form.tsx',
  `  maximumAge: string;`,
  `  maximumAge: string;\n  participantAudience: 'adult' | 'child' | 'mixed';\n  collectParticipantAge: boolean;\n  workshopType: string;\n  requiresFollowupSession: boolean;\n  followupWorkshopType: string;\n  followupMinDays: string;\n  followupMaxDays: string;`
);
replaceOnce(
  'app/admin/(protected)/warsztaty/workshop-form.tsx',
  `  const [featuredMediaId, setFeaturedMediaId] = useState<string | null>(`,
  `  const [requiresFollowupSession, setRequiresFollowupSession] = useState(\n    initialData?.requiresFollowupSession ?? false\n  );\n  const [featuredMediaId, setFeaturedMediaId] = useState<string | null>(`
);
replaceOnce(
  'app/admin/(protected)/warsztaty/workshop-form.tsx',
  `    maximumAge: '',`,
  `    maximumAge: '',\n    participantAudience: 'adult',\n    collectParticipantAge: false,\n    workshopType: '',\n    requiresFollowupSession: false,\n    followupWorkshopType: '',\n    followupMinDays: '5',\n    followupMaxDays: '45',`
);

replaceOnce(
  'app/admin/(protected)/warsztaty/workshop-form.tsx',
  `      <section className="rounded-lg border bg-white p-4">\n        <h2 className="mb-3 text-lg font-medium">Status i SEO</h2>`,
  `      <section className="rounded-lg border bg-white p-4">\n        <h2 className="mb-3 text-lg font-medium">Uczestnicy i etapy</h2>\n        <div className="grid gap-4 sm:grid-cols-2">\n          <div>\n            <label htmlFor="participantAudience" className="block text-sm font-medium">\n              Grupa uczestników\n            </label>\n            <select\n              id="participantAudience"\n              name="participantAudience"\n              defaultValue={defaultData.participantAudience}\n              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"\n            >\n              <option value="adult">Dorośli</option>\n              <option value="child">Dzieci / młodzież</option>\n              <option value="mixed">Grupa mieszana</option>\n            </select>\n          </div>\n          <div>\n            <label htmlFor="workshopType" className="block text-sm font-medium">\n              Typ operacyjny warsztatu\n            </label>\n            <input\n              id="workshopType"\n              name="workshopType"\n              defaultValue={defaultData.workshopType || slug}\n              required\n              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"\n            />\n          </div>\n          <label className="flex items-center gap-2 text-sm">\n            <input\n              name="collectParticipantAge"\n              type="checkbox"\n              defaultChecked={defaultData.collectParticipantAge}\n            />\n            Zbieraj wiek dzieci\n          </label>\n          <label className="flex items-center gap-2 text-sm">\n            <input\n              name="requiresFollowupSession"\n              type="checkbox"\n              checked={requiresFollowupSession}\n              onChange={(event) => setRequiresFollowupSession(event.target.checked)}\n            />\n            Wymaga drugiego terminu\n          </label>\n          {requiresFollowupSession ? (\n            <>\n              <div className="sm:col-span-2">\n                <label htmlFor="followupWorkshopType" className="block text-sm font-medium">\n                  Typ lub slug warsztatu drugiego etapu\n                </label>\n                <input\n                  id="followupWorkshopType"\n                  name="followupWorkshopType"\n                  defaultValue={defaultData.followupWorkshopType}\n                  required\n                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"\n                />\n              </div>\n              <div>\n                <label htmlFor="followupMinDays" className="block text-sm font-medium">\n                  Najwcześniej po (dni)\n                </label>\n                <input\n                  id="followupMinDays"\n                  name="followupMinDays"\n                  type="number"\n                  min={0}\n                  defaultValue={defaultData.followupMinDays}\n                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"\n                />\n              </div>\n              <div>\n                <label htmlFor="followupMaxDays" className="block text-sm font-medium">\n                  Najpóźniej po (dni)\n                </label>\n                <input\n                  id="followupMaxDays"\n                  name="followupMaxDays"\n                  type="number"\n                  min={0}\n                  defaultValue={defaultData.followupMaxDays}\n                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"\n                />\n              </div>\n            </>\n          ) : null}\n        </div>\n      </section>\n\n      <section className="rounded-lg border bg-white p-4">\n        <h2 className="mb-3 text-lg font-medium">Status i SEO</h2>`
);

replaceOnce(
  'app/admin/(protected)/warsztaty/[id]/page.tsx',
  `  const mapped = mapWorkshop(workshop);\n  const initialData = {`,
  `  const mapped = mapWorkshop(workshop);\n  const operational = workshop as typeof workshop & {\n    participant_audience?: 'adult' | 'child' | 'mixed';\n    collect_participant_age?: boolean;\n    workshop_type?: string | null;\n    requires_followup_session?: boolean;\n    followup_workshop_type?: string | null;\n    followup_min_days?: number | null;\n    followup_max_days?: number | null;\n  };\n  const initialData = {`
);
replaceOnce(
  'app/admin/(protected)/warsztaty/[id]/page.tsx',
  `    maximumAge: mapped.maximumAge?.toString() ?? '',`,
  `    maximumAge: mapped.maximumAge?.toString() ?? '',\n    participantAudience: operational.participant_audience ?? 'adult',\n    collectParticipantAge: operational.collect_participant_age ?? false,\n    workshopType: operational.workshop_type ?? mapped.slug,\n    requiresFollowupSession:\n      operational.requires_followup_session ?? false,\n    followupWorkshopType: operational.followup_workshop_type ?? '',\n    followupMinDays: operational.followup_min_days?.toString() ?? '5',\n    followupMaxDays: operational.followup_max_days?.toString() ?? '45',`
);

// ---------------------------------------------------------------------------
// Linked-booking display in admin.
// ---------------------------------------------------------------------------

appendOnce(
  'app/admin/(protected)/rezerwacje/actions.ts',
  'export async function getLinkedBookingsAction',
  `\n\nexport async function getLinkedBookingsAction(bookingId: string) {\n  await requireAnyRole(['owner', 'manager']);\n  const supabase = createAdminClient() as unknown as {\n    rpc: (name: string, args: Record<string, unknown>) => Promise<{\n      data: unknown;\n      error: { message: string } | null;\n    }>;\n  };\n  const { data, error } = await supabase.rpc('get_linked_booking_summary', {\n    p_booking_id: bookingId,\n  });\n  if (error) {\n    console.error('get_linked_booking_summary failed', error.message);\n    return [];\n  }\n  return (data as Array<{\n    id: string;\n    reference: string;\n    relationship: string;\n    workshop_title: string;\n    starts_at: string;\n    status: string;\n  }> | null) ?? [];\n}\n`
);
replaceOnce(
  'app/admin/(protected)/rezerwacje/[id]/page.tsx',
  `  getBookingEmailsAction,`,
  `  getBookingEmailsAction,\n  getLinkedBookingsAction,`
);
replaceOnce(
  'app/admin/(protected)/rezerwacje/[id]/page.tsx',
  `  const [events, emails] = await Promise.all([\n    getBookingEventsAction(id),\n    getBookingEmailsAction(id),\n  ]);`,
  `  const [events, emails, linkedBookings] = await Promise.all([\n    getBookingEventsAction(id),\n    getBookingEmailsAction(id),\n    getLinkedBookingsAction(id),\n  ]);`
);
replaceOnce(
  'app/admin/(protected)/rezerwacje/[id]/page.tsx',
  `      <section className="rounded-lg border bg-white p-4">\n        <h2 className="mb-3 font-semibold">Notatki wewnętrzne</h2>`,
  `      {linkedBookings.length ? (\n        <section className="rounded-lg border border-accent-primary/30 bg-white p-4">\n          <h2 className="mb-3 font-semibold">Powiązane etapy rezerwacji</h2>\n          <ul className="space-y-2 text-sm">\n            {linkedBookings.map((linked) => (\n              <li key={linked.id} className="flex flex-wrap items-center justify-between gap-2">\n                <span>\n                  {linked.relationship} · {linked.workshop_title} · {formatWarsawDateTime(linked.starts_at)} · {linked.status}\n                </span>\n                <Link href={\`/admin/rezerwacje/${'${linked.id}'}\`} className="underline">\n                  {linked.reference}\n                </Link>\n              </li>\n            ))}\n          </ul>\n        </section>\n      ) : null}\n\n      <section className="rounded-lg border bg-white p-4">\n        <h2 className="mb-3 font-semibold">Notatki wewnętrzne</h2>`
);

// ---------------------------------------------------------------------------
// Migration helper RPCs appended to migration 26.
// ---------------------------------------------------------------------------

appendOnce(
  'supabase/migrations/00000000000026_linked_workshops_and_reminders.sql',
  'create or replace function public.set_workshop_operational_metadata',
  `\n\n-- Admin helper for metadata not present in the original workshop upsert RPC.\ncreate or replace function public.set_workshop_operational_metadata(\n  p_workshop_id uuid,\n  p_participant_audience text,\n  p_collect_participant_age boolean,\n  p_workshop_type text,\n  p_requires_followup_session boolean,\n  p_followup_workshop_type text,\n  p_followup_min_days integer,\n  p_followup_max_days integer\n)\nreturns void\nlanguage plpgsql\nsecurity invoker\nset search_path = public\nas $$\nbegin\n  update public.workshops\n  set participant_audience = p_participant_audience,\n      collect_participant_age = coalesce(p_collect_participant_age, false),\n      workshop_type = nullif(trim(p_workshop_type), ''),\n      requires_followup_session = coalesce(p_requires_followup_session, false),\n      followup_workshop_type = nullif(trim(coalesce(p_followup_workshop_type, '')), ''),\n      followup_min_days = p_followup_min_days,\n      followup_max_days = p_followup_max_days,\n      updated_at = timezone('utc'::text, now())\n  where id = p_workshop_id;\n  if not found then raise exception 'Workshop not found'; end if;\nend;\n$$;\n\nrevoke all on function public.set_workshop_operational_metadata(\n  uuid, text, boolean, text, boolean, text, integer, integer\n) from public, anon;\ngrant execute on function public.set_workshop_operational_metadata(\n  uuid, text, boolean, text, boolean, text, integer, integer\n) to authenticated, service_role;\n\ncreate or replace function public.get_linked_booking_summary(p_booking_id uuid)\nreturns jsonb\nlanguage sql\nsecurity invoker\nset search_path = public\nas $$\n  select coalesce(jsonb_agg(result order by result.starts_at), '[]'::jsonb)\n  from (\n    select\n      b.id,\n      b.booking_reference as reference,\n      case\n        when bl.primary_booking_id = p_booking_id then 'drugi etap'\n        else 'pierwszy etap'\n      end as relationship,\n      w.title as workshop_title,\n      s.starts_at,\n      b.status\n    from public.booking_links bl\n    join public.bookings b\n      on b.id = case\n        when bl.primary_booking_id = p_booking_id then bl.followup_booking_id\n        else bl.primary_booking_id\n      end\n    join public.workshop_sessions s on s.id = b.workshop_session_id\n    join public.workshops w on w.id = s.workshop_id\n    where bl.primary_booking_id = p_booking_id\n       or bl.followup_booking_id = p_booking_id\n  ) result;\n$$;\n\nrevoke all on function public.get_linked_booking_summary(uuid) from public, anon;\ngrant execute on function public.get_linked_booking_summary(uuid)\n  to authenticated, service_role;\n`
);

// ---------------------------------------------------------------------------
// Documentation and package scripts.
// ---------------------------------------------------------------------------

replaceOnce(
  'package.json',
  `    "test:vouchers:pglite": "node scripts/test-voucher-lifecycle-pglite.mjs",`,
  `    "test:vouchers:pglite": "node scripts/test-voucher-lifecycle-pglite.mjs",\n    "test:linked-workshops:pglite": "node scripts/test-linked-workshops-pglite.mjs",`
);

console.log('Linked workshops and reminder sprint patch applied.');
