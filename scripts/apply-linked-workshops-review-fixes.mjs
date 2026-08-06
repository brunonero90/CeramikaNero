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
    throw new Error(`Anchor not found in ${path}: ${before.slice(0, 120)}`);
  }
  content = content.replace(before, after);
  write(path, content);
}

// Preserve accessibility/organizational notes for the purchaser while keeping
// their adult participant name deduplicated.
replaceOnce(
  'components/clone/checkout-page-client.tsx',
  `                  <p className="text-sm text-text-muted">\n                    Użyjemy imienia i nazwiska z danych kupującego. Nie musisz\n                    wpisywać ich drugi raz.\n                  </p>\n                </section>`,
  `                  <p className="text-sm text-text-muted">\n                    Użyjemy imienia i nazwiska z danych kupującego. Nie musisz\n                    wpisywać ich drugi raz.\n                  </p>\n                  <label className="block text-sm">\n                    Ważne informacje organizacyjne / potrzeby dostępności\n                    <textarea\n                      className="mt-1 w-full border px-3 py-2"\n                      rows={2}\n                      maxLength={500}\n                      value={participants[0]?.accessibility_notes ?? ''}\n                      onChange={(event) =>\n                        updateParticipant(\n                          line.sessionId,\n                          0,\n                          'accessibility_notes',\n                          event.target.value\n                        )\n                      }\n                    />\n                    <span className="mt-1 block text-xs text-text-muted">\n                      Podaj tylko informacje potrzebne do organizacji warsztatu.\n                      Nie wysyłaj diagnoz ani numerów dokumentów.\n                    </span>\n                  </label>\n                </section>`
);

replaceOnce(
  'components/clone/checkout-page-client.tsx',
  `                {adult ? (\n                  <p className="text-sm text-text-muted">\n                    Pierwsze miejsce przypisujemy osobie kupującej. Podaj tylko\n                    pozostałych uczestników.\n                  </p>\n                ) : null}\n                {participants.map((participant, index) => {`,
  `                {adult ? (\n                  <>\n                    <p className="text-sm text-text-muted">\n                      Pierwsze miejsce przypisujemy osobie kupującej. Podaj tylko\n                      pozostałych uczestników.\n                    </p>\n                    <div className="rounded border p-3">\n                      <p className="mb-2 text-sm font-medium">\n                        Osoba kupująca: {firstName || '—'} {lastName || ''}\n                      </p>\n                      <label className="block text-sm">\n                        Ważne informacje organizacyjne / potrzeby dostępności\n                        <textarea\n                          className="mt-1 w-full border px-3 py-2"\n                          rows={2}\n                          maxLength={500}\n                          value={participants[0]?.accessibility_notes ?? ''}\n                          onChange={(event) =>\n                            updateParticipant(\n                              line.sessionId,\n                              0,\n                              'accessibility_notes',\n                              event.target.value\n                            )\n                          }\n                        />\n                        <span className="mt-1 block text-xs text-text-muted">\n                          Podaj tylko informacje potrzebne do organizacji\n                          warsztatu. Nie wysyłaj diagnoz ani numerów dokumentów.\n                        </span>\n                      </label>\n                    </div>\n                  </>\n                ) : null}\n                {participants.map((participant, index) => {`
);

replaceOnce(
  'components/clone/checkout-page-client.tsx',
  `                        />\n                      </label>\n                    </div>`,
  `                        />\n                        <span className="mt-1 block text-xs text-text-muted">\n                          Podaj tylko informacje potrzebne do organizacji\n                          warsztatu. Nie wysyłaj diagnoz ani numerów dokumentów.\n                        </span>\n                      </label>\n                    </div>`
);

// Use the authoritative database guard added in migration 28.
replaceOnce(
  'lib/cart/checkout.ts',
  ").rpc('submit_cart_order_v4', {",
  ").rpc('submit_cart_order_v5', {"
);
replaceOnce(
  'lib/cart/checkout.ts',
  "console.error('submit_cart_order_v4 failed', {",
  "console.error('submit_cart_order_v5 failed', {"
);

// The operational type falls back to the workshop slug server-side; do not
// force a second manual slug entry when creating a workshop.
replaceOnce(
  'app/admin/(protected)/warsztaty/workshop-form.tsx',
  `              defaultValue={defaultData.workshopType || slug}\n              required\n              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"`,
  `              defaultValue={defaultData.workshopType || slug}\n              placeholder={slug || 'np. glina-do-wina'}\n              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"`
);

// Update focused source contracts for v5 and retained adult notes.
replaceOnce(
  'lib/cart/__tests__/linked-workshop-ux-contract.test.ts',
  `    expect(checkoutUi).toContain("age: ''");\n    expect(checkoutServer).toContain("participantType !== 'child'");`,
  `    expect(checkoutUi).toContain("age: ''");\n    expect(checkoutUi).toContain(\n      'Ważne informacje organizacyjne / potrzeby dostępności'\n    );\n    expect(checkoutServer).toContain("participantType !== 'child'");`
);
replaceOnce(
  'lib/cart/__tests__/linked-workshop-ux-contract.test.ts',
  `    expect(checkoutServer).toContain(".rpc('submit_cart_order_v4'");`,
  `    expect(checkoutServer).toContain(".rpc('submit_cart_order_v5'");`
);

// Exercise the authoritative v5 database guard and compatibility details.
{
  const path = 'scripts/test-linked-workshops-pglite.mjs';
  let content = read(path).replaceAll(
    'public.submit_cart_order_v4(',
    'public.submit_cart_order_v5('
  );
  content = content.replace(
    `    select\n      primary_session.id as primary_session_id,\n      followup_session.id as followup_session_id\n    from primary_session cross join followup_session`,
    `    select\n      primary_workshop.id as primary_workshop_id,\n      followup.id as followup_workshop_id,\n      primary_session.id as primary_session_id,\n      followup_session.id as followup_session_id\n    from primary_workshop\n    cross join followup\n    cross join primary_session\n    cross join followup_session`
  );
  const anchor = `  assert(\n    cancelled.rows[0].followup_reserved === 0,\n    'Follow-up capacity was not released'\n  );\n}`;
  const replacement = `  assert(\n    cancelled.rows[0].followup_reserved === 0,\n    'Follow-up capacity was not released'\n  );\n\n  await db.query(\n    \`insert into public.booking_events (\n       booking_id, event_type, actor_type, metadata\n     ) values ($1, 'attendance_updated', 'system', '{}'::jsonb)\`,\n    [bookings.rows[0].id]\n  );\n\n  let selfLinkRejected = false;\n  try {\n    await db.query(\n      \`update public.workshops\n       set followup_workshop_id = id\n       where id = $1\`,\n      [fixture.primary_workshop_id]\n    );\n  } catch (error) {\n    selfLinkRejected = String(error).includes(\n      'workshops_followup_not_self_check'\n    );\n  }\n  assert(selfLinkRejected, 'A workshop was allowed to follow itself');\n\n  await db.query(\n    \`update public.workshop_sessions\n     set reserved_count = capacity\n     where id = $1\`,\n    [fixture.followup_session_id]\n  );\n  let unavailableRejected = false;\n  try {\n    await db.query(\n      \`select public.submit_cart_order_v5(\n        $1, $2, $3, $4, $5, $6, false,\n        timezone('utc'::text, now()), 'test', $7::jsonb,\n        null, 'website', 'stripe', null\n      ) as result\`,\n      [\n        'linked-workshops-unavailable-followup',\n        'unavailable@example.com',\n        'Bruno',\n        'Nero',\n        '500600700',\n        '',\n        lines,\n      ]\n    );\n  } catch (error) {\n    unavailableRejected = String(error)\n      .toLowerCase()\n      .includes('follow-up session is no longer available');\n  }\n  assert(\n    unavailableRejected,\n    'Full follow-up capacity did not produce the dedicated error'\n  );\n  await db.query(\n    \`update public.workshop_sessions set reserved_count = 0 where id = $1\`,\n    [fixture.followup_session_id]\n  );\n}`;
  if (!content.includes(replacement)) {
    if (!content.includes(anchor)) throw new Error('Linked test anchor missing');
    content = content.replace(anchor, replacement);
  }

  const reminderAnchor = `  assert(\n    String(cancelledRow.rows[0].error_message).includes('permanent'),\n    'Cancelled reminder was not permanently closed'\n  );\n}`;
  const reminderReplacement = `  assert(\n    String(cancelledRow.rows[0].error_message).includes('permanent'),\n    'Cancelled reminder was not permanently closed'\n  );\n\n  const repeatedCleanup = await db.query(\n    \`select public.enqueue_booking_reminders(null, null) as result\`\n  );\n  assert(\n    repeatedCleanup.rows[0].result.skipped === 0,\n    'Permanent reminder skip was logged more than once'\n  );\n  const skipEvents = await db.query(\n    \`select count(*)::int as count\n     from public.booking_events\n     where booking_id = $1 and event_type = 'reminder_skipped'\`,\n    [stripeBooking]\n  );\n  assert(\n    skipEvents.rows[0].count === 1,\n    'Expected exactly one reminder_skipped audit event'\n  );\n}`;
  if (!content.includes(reminderReplacement)) {
    if (!content.includes(reminderAnchor)) {
      throw new Error('Reminder test anchor missing');
    }
    content = content.replace(reminderAnchor, reminderReplacement);
  }
  write(path, content);
}

// Document the final database guard migration and exact reminder scheduling.
replaceOnce(
  'docs/LINKED_WORKSHOPS_AND_REMINDERS.md',
  `3. Apply \`00000000000026_linked_workshops_and_reminders.sql\`.\n4. Apply \`00000000000027_linked_workshop_hardening.sql\`.\n5. Deploy the application commit.`,
  `3. Apply \`00000000000026_linked_workshops_and_reminders.sql\`.\n4. Apply \`00000000000027_linked_workshop_hardening.sql\`.\n5. Apply \`00000000000028_linked_checkout_database_guard.sql\`.\n6. Deploy the application commit.`
);
replaceOnce(
  'docs/LINKED_WORKSHOPS_AND_REMINDERS.md',
  `6. Confirm \`BOOKING_CRON_SECRET\` exists in Netlify and the scheduled function is\n   enabled.\n7. Review adult/child/mixed settings in the workshop admin.\n8. Configure the real glazing workshop and Glina do Wina relationship.\n9. Perform one disposable two-stage Stripe booking and one manual booking.\n10. Check \`booking_emails\`, \`booking_events\`, both capacities and the admin linked\n    booking display.`,
  `7. Confirm \`BOOKING_CRON_SECRET\` exists in Netlify and the scheduled function is\n   enabled.\n8. Review adult/child/mixed settings in the workshop admin.\n9. Configure the real glazing workshop and Glina do Wina relationship.\n10. Perform one disposable two-stage Stripe booking and one manual booking.\n11. Check \`booking_emails\`, \`booking_events\`, both capacities and the admin linked\n    booking display.`
);
replaceOnce(
  'docs/LINKED_WORKSHOPS_AND_REMINDERS.md',
  `The five-minute schedule therefore sends them\napproximately one day before the workshop.`,
  `The five-minute schedule discovers them in a recovery window, while\n\`next_attempt_at\` holds delivery until the precise 24-hour point.`
);

console.log('Linked workshop review fixes applied.');
