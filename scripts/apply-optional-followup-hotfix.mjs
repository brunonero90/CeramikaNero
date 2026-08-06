import { readFileSync, writeFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content);
}

function replaceOnce(path, before, after) {
  const content = read(path);
  if (!content.includes(before)) {
    throw new Error(`Missing patch anchor in ${path}: ${before.slice(0, 120)}`);
  }
  write(path, content.replace(before, after));
}

const revalidate = 'lib/cart/revalidate.ts';
replaceOnce(
  revalidate,
  "  requiresFollowupSession?: boolean;\n  followupWorkshopType?: string | null;",
  "  offersFollowupSession?: boolean;\n  requiresFollowupSession?: boolean;\n  followupWorkshopType?: string | null;"
);
replaceOnce(
  revalidate,
  "  requires_followup_session?: boolean | null;\n  followup_workshop_id?: string | null;",
  "  offers_followup_session?: boolean | null;\n  requires_followup_session?: boolean | null;\n  followup_workshop_id?: string | null;"
);
replaceOnce(
  revalidate,
  'participant_audience, collect_participant_age, requires_followup_session, followup_workshop_id, followup_workshop_type, followup_min_days, followup_max_days)',
  'participant_audience, collect_participant_age, offers_followup_session, requires_followup_session, followup_workshop_id, followup_workshop_type, followup_min_days, followup_max_days)'
);
replaceOnce(
  revalidate,
  `      const requiresFollowupSession = Boolean(\n        workshop?.requires_followup_session && line.linkRole !== 'followup'\n      );\n      const followupOptions =\n        requiresFollowupSession && session && workshop\n          ? await loadFollowupOptions(\n              supabase,\n              workshop,\n              session.starts_at,\n              line.quantity,\n              now\n            )\n          : [];\n      if (requiresFollowupSession && followupOptions.length === 0) {`,
  `      const requiresFollowupSession = Boolean(\n        workshop?.requires_followup_session && line.linkRole !== 'followup'\n      );\n      const offersFollowupSession = Boolean(\n        (workshop?.offers_followup_session || requiresFollowupSession) &&\n          line.linkRole !== 'followup'\n      );\n      const followupOptions =\n        offersFollowupSession && session && workshop\n          ? await loadFollowupOptions(\n              supabase,\n              workshop,\n              session.starts_at,\n              line.quantity,\n              now\n            )\n          : [];\n      if (requiresFollowupSession && followupOptions.length === 0) {`
);
replaceOnce(
  revalidate,
  "        collectParticipantAge,\n        requiresFollowupSession,",
  "        collectParticipantAge,\n        offersFollowupSession,\n        requiresFollowupSession,"
);

const ui = 'components/clone/checkout-page-client.tsx';
replaceOnce(
  ui,
  "      if (line.type !== 'workshop_session' || !line.requiresFollowupSession) {",
  "      if (\n        line.type !== 'workshop_session' ||\n        (!line.offersFollowupSession && !line.requiresFollowupSession)\n      ) {"
);
replaceOnce(
  ui,
  "        if (line.type === 'workshop_session' && line.requiresFollowupSession) {",
  "        if (\n          line.type === 'workshop_session' &&\n          (line.offersFollowupSession || line.requiresFollowupSession)\n        ) {"
);
replaceOnce(
  ui,
  "              line.type === 'workshop_session' && line.requiresFollowupSession",
  "              line.type === 'workshop_session' &&\n              (line.offersFollowupSession || line.requiresFollowupSession)"
);
replaceOnce(
  ui,
  `                <h2 className="text-lg font-semibold">\n                  Drugi etap — szkliwienie\n                </h2>\n                <p className="text-sm text-text-muted">\n                  Ten warsztat wymaga drugiego spotkania. Zarezerwujemy tę samą\n                  liczbę miejsc w obu terminach w jednym zamówieniu.\n                </p>`,
  `                <h2 className="text-lg font-semibold">\n                  {line.requiresFollowupSession\n                    ? 'Drugi etap — szkliwienie'\n                    : 'Opcjonalne szkliwienie'}\n                </h2>\n                <p className="text-sm text-text-muted">\n                  {line.requiresFollowupSession\n                    ? 'Ten warsztat wymaga drugiego spotkania. Zarezerwujemy tę samą liczbę miejsc w obu terminach w jednym zamówieniu.'\n                    : 'Możesz od razu zarezerwować późniejszy termin szkliwienia albo wrócić do tego później.'}\n                </p>`
);
replaceOnce(
  ui,
  '                    <option value="">Wybierz termin</option>',
  `                    <option value="">\n                      {line.requiresFollowupSession\n                        ? 'Wybierz termin'\n                        : 'Nie rezerwuję teraz'}\n                    </option>`
);
replaceOnce(
  ui,
  `                  </select>\n                </label>\n              </section>`,
  `                  </select>\n                </label>\n                {!line.requiresFollowupSession &&\n                (line.followupOptions ?? []).length === 0 ? (\n                  <p className="text-sm text-text-muted">\n                    Obecnie nie ma dostępnych terminów szkliwienia. Możesz\n                    zarezerwować pierwszy etap bez drugiego spotkania.\n                  </p>\n                ) : null}\n              </section>`
);

const checkout = 'lib/cart/checkout.ts';
replaceOnce(
  checkout,
  `      primary.type !== 'workshop_session' ||\n      !primary.requiresFollowupSession`,
  `      primary.type !== 'workshop_session' ||\n      (!primary.offersFollowupSession && !primary.requiresFollowupSession)`
);
replaceOnce(
  checkout,
  `    if (!followup || followup.type !== 'workshop_session') {\n      return {\n        ok: false,\n        error: 'Wybierz obowiązkowy termin drugiego etapu warsztatu.',\n      };\n    }`,
  `    if (!followup || followup.type !== 'workshop_session') {\n      if (primary.requiresFollowupSession) {\n        return {\n          ok: false,\n          error: 'Wybierz obowiązkowy termin drugiego etapu warsztatu.',\n        };\n      }\n      continue;\n    }`
);

const schemas = 'lib/admin/schemas.ts';
replaceOnce(
  schemas,
  "    requiresFollowupSession: z.boolean().default(false),",
  "    offersFollowupSession: z.boolean().default(false),\n    requiresFollowupSession: z.boolean().default(false),"
);
replaceOnce(
  schemas,
  "      !data.requiresFollowupSession || Boolean(data.followupWorkshopType),",
  "      (!data.offersFollowupSession && !data.requiresFollowupSession) ||\n      Boolean(data.followupWorkshopType),"
);

const actions = 'app/admin/(protected)/warsztaty/actions.ts';
replaceOnce(
  actions,
  "  const parsed = workshopInputSchema.safeParse({",
  "  const followupMode = String(formData.get('followupMode') || 'none');\n\n  const parsed = workshopInputSchema.safeParse({"
);
replaceOnce(
  actions,
  "    requiresFollowupSession: formData.get('requiresFollowupSession') === 'on',",
  "    offersFollowupSession: followupMode !== 'none',\n    requiresFollowupSession: followupMode === 'required',"
);
write(
  actions,
  read(actions)
    .replaceAll(".rpc('set_workshop_operational_metadata', {", ".rpc('set_workshop_operational_metadata_v2', {")
    .replaceAll(
      '    p_requires_followup_session: data.requiresFollowupSession,',
      '    p_offers_followup_session: data.offersFollowupSession,\n    p_requires_followup_session: data.requiresFollowupSession,'
    )
);

const form = 'app/admin/(protected)/warsztaty/workshop-form.tsx';
replaceOnce(
  form,
  "  requiresFollowupSession: boolean;",
  "  offersFollowupSession: boolean;\n  requiresFollowupSession: boolean;"
);
replaceOnce(
  form,
  `  const [requiresFollowupSession, setRequiresFollowupSession] = useState(\n    initialData?.requiresFollowupSession ?? false\n  );`,
  `  const [followupMode, setFollowupMode] = useState<\n    'none' | 'optional' | 'required'\n  >(\n    initialData?.requiresFollowupSession\n      ? 'required'\n      : initialData?.offersFollowupSession\n        ? 'optional'\n        : 'none'\n  );`
);
replaceOnce(
  form,
  "    requiresFollowupSession: false,",
  "    offersFollowupSession: false,\n    requiresFollowupSession: false,"
);
replaceOnce(
  form,
  `          <label className="flex items-center gap-2 text-sm">\n            <input\n              name="requiresFollowupSession"\n              type="checkbox"\n              checked={requiresFollowupSession}\n              onChange={(event) =>\n                setRequiresFollowupSession(event.target.checked)\n              }\n            />\n            Wymaga drugiego terminu\n          </label>\n          {requiresFollowupSession ? (`,
  `          <div>\n            <label htmlFor="followupMode" className="block text-sm font-medium">\n              Drugi etap\n            </label>\n            <select\n              id="followupMode"\n              name="followupMode"\n              value={followupMode}\n              onChange={(event) =>\n                setFollowupMode(\n                  event.target.value as 'none' | 'optional' | 'required'\n                )\n              }\n              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"\n            >\n              <option value="none">Brak</option>\n              <option value="optional">Opcjonalny — klient może wybrać</option>\n              <option value="required">Obowiązkowy</option>\n            </select>\n          </div>\n          {followupMode !== 'none' ? (`
);

const page = 'app/admin/(protected)/warsztaty/[id]/page.tsx';
replaceOnce(
  page,
  "    requires_followup_session?: boolean;",
  "    offers_followup_session?: boolean;\n    requires_followup_session?: boolean;"
);
replaceOnce(
  page,
  "    requiresFollowupSession: operational.requires_followup_session ?? false,",
  "    offersFollowupSession: operational.offers_followup_session ??\n      operational.requires_followup_session ??\n      false,\n    requiresFollowupSession: operational.requires_followup_session ?? false,"
);

const contract = 'lib/cart/__tests__/linked-workshop-ux-contract.test.ts';
replaceOnce(
  contract,
  `  const migration = source(\n    'supabase/migrations/00000000000026_linked_workshops_and_reminders.sql'\n  );`,
  `  const migration = source(\n    'supabase/migrations/00000000000026_linked_workshops_and_reminders.sql'\n  );\n  const optionalMigration = source(\n    'supabase/migrations/00000000000029_optional_followup_sessions.sql'\n  );`
);
replaceOnce(
  contract,
  "  it('requires and revalidates a second session in the unified order', () => {",
  "  it('offers optional follow-up sessions and still supports required stages', () => {"
);
replaceOnce(
  contract,
  "    expect(checkoutUi).toContain('Wybierz termin szkliwienia');",
  "    expect(checkoutUi).toContain('Wybierz termin szkliwienia');\n    expect(checkoutUi).toContain('Nie rezerwuję teraz');\n    expect(checkoutUi).toContain('offersFollowupSession');"
);
replaceOnce(
  contract,
  "    expect(migration).toContain(\n      'create table if not exists public.booking_links'\n    );",
  "    expect(migration).toContain(\n      'create table if not exists public.booking_links'\n    );\n    expect(optionalMigration).toContain('offers_followup_session');\n    expect(optionalMigration).toContain(\n      \"not v_primary_workshop.requires_followup_session\"\n    );"
);

const lifecycle = 'scripts/test-linked-workshops-pglite.mjs';
replaceOnce(
  lifecycle,
  `function linkedLines(primarySessionId, followupSessionId) {`,
  `function primaryOnlyLines(primarySessionId) {\n  return JSON.stringify([\n    {\n      type: 'workshop_session',\n      session_id: primarySessionId,\n      quantity: 1,\n      participants: [\n        {\n          display_name: 'Bruno Nero',\n          age: null,\n          participant_type: 'adult',\n          accessibility_notes: null,\n        },\n      ],\n    },\n  ]);\n}\n\nfunction linkedLines(primarySessionId, followupSessionId) {`
);
replaceOnce(
  lifecycle,
  `  await db.query(\n    \`update public.workshop_sessions set reserved_count = 0 where id = $1\`,\n    [fixture.followup_session_id]\n  );\n}`,
  `  await db.query(\n    \`update public.workshop_sessions set reserved_count = 0 where id = $1\`,\n    [fixture.followup_session_id]\n  );\n\n  await db.query(\n    \`update public.workshops\n     set offers_followup_session = true, requires_followup_session = false\n     where id = $1\`,\n    [fixture.primary_workshop_id]\n  );\n  const optional = await db.query(\n    \`select public.submit_cart_order_v5(\n      $1, $2, $3, $4, $5, $6, false,\n      timezone('utc'::text, now()), 'test', $7::jsonb,\n      null, 'website', 'stripe', null\n    ) as result\`,\n    [\n      'linked-workshops-optional-skip',\n      'optional@example.com',\n      'Bruno',\n      'Nero',\n      '500600700',\n      '',\n      primaryOnlyLines(fixture.primary_session_id),\n    ]\n  );\n  assert(\n    optional.rows[0].result.booking_references.length === 1,\n    'Optional follow-up could not be skipped'\n  );\n  assert(\n    optional.rows[0].result.total_gross_grosz === 10000,\n    'Skipped optional follow-up changed the primary price'\n  );\n}`
);
replaceOnce(
  lifecycle,
  "LINKED WORKSHOPS PASS adult-name/atomic-capacity/idempotency/cancellation/reminder invariants",
  "LINKED WORKSHOPS PASS adult-name/optional-followup/atomic-capacity/idempotency/cancellation/reminder invariants"
);

const migration28 = read(
  'supabase/migrations/00000000000028_linked_checkout_database_guard.sql'
);
const functionStart = migration28.indexOf(
  'create or replace function public.submit_cart_order_v5('
);
if (functionStart < 0) throw new Error('Could not find submit_cart_order_v5');
let guardedFunction = migration28.slice(functionStart);
guardedFunction = guardedFunction
  .replace(
    'if not v_primary_workshop.requires_followup_session then',
    'if not (v_primary_workshop.offers_followup_session or v_primary_workshop.requires_followup_session) then'
  )
  .replace(
    `    if v_followup_count <> 1 then\n      raise exception 'Follow-up session is required exactly once';\n    end if;`,
    `    if v_followup_count > 1 then\n      raise exception 'Follow-up session may be selected at most once';\n    end if;\n\n    if v_followup_count = 0 then\n      if v_primary_workshop.requires_followup_session then\n        raise exception 'Follow-up session is required exactly once';\n      end if;\n      continue;\n    end if;`
  )
  .replace(
    '      and primary_workshop.requires_followup_session;',
    '      and (primary_workshop.offers_followup_session or primary_workshop.requires_followup_session);'
  )
  .replaceAll('mandatory follow-up', 'configured follow-up')
  .replaceAll('mandatory follow-up sessions', 'optional or required follow-up sessions');

const migration29 = `-- Ceramika Nero — optional follow-up booking mode hotfix.\n-- Apply after migration 28.\n\nalter table public.workshops\n  add column if not exists offers_followup_session boolean not null default false;\n\nupdate public.workshops\nset offers_followup_session = true\nwhere requires_followup_session = true;\n\n-- Glina do Wina offers glazing, but the customer may book only the first stage.\nupdate public.workshops\nset offers_followup_session = true,\n    requires_followup_session = false,\n    updated_at = timezone('utc'::text, now())\nwhere (slug in ('glina-do-wina', 'glinadowina') or lower(title) = 'glina do wina')\n  and (followup_workshop_id is not null\n       or nullif(trim(coalesce(followup_workshop_type, '')), '') is not null);\n\nalter table public.workshops\n  drop constraint if exists workshops_followup_configuration_check;\nalter table public.workshops\n  add constraint workshops_followup_configuration_check\n  check (\n    (not offers_followup_session and not requires_followup_session)\n    or followup_workshop_id is not null\n    or nullif(trim(followup_workshop_type), '') is not null\n  );\n\nalter table public.workshops\n  drop constraint if exists workshops_required_followup_is_offered_check;\nalter table public.workshops\n  add constraint workshops_required_followup_is_offered_check\n  check (not requires_followup_session or offers_followup_session);\n\ncomment on column public.workshops.offers_followup_session is\n  'Shows eligible follow-up sessions during checkout. Selection may remain optional unless requires_followup_session is true.';\n\ncreate or replace function public.set_workshop_operational_metadata_v2(\n  p_workshop_id uuid,\n  p_participant_audience text,\n  p_collect_participant_age boolean,\n  p_workshop_type text,\n  p_offers_followup_session boolean,\n  p_requires_followup_session boolean,\n  p_followup_workshop_type text,\n  p_followup_min_days integer,\n  p_followup_max_days integer\n)\nreturns void\nlanguage plpgsql\nsecurity invoker\nset search_path = public\nas $$\ndeclare\n  v_offers boolean := coalesce(p_offers_followup_session, false)\n    or coalesce(p_requires_followup_session, false);\nbegin\n  update public.workshops\n  set participant_audience = p_participant_audience,\n      collect_participant_age = coalesce(p_collect_participant_age, false),\n      workshop_type = nullif(trim(p_workshop_type), ''),\n      offers_followup_session = v_offers,\n      requires_followup_session = coalesce(p_requires_followup_session, false),\n      followup_workshop_id = case\n        when not v_offers then null\n        when nullif(trim(coalesce(p_followup_workshop_type, '')), '')\n             is distinct from followup_workshop_type then null\n        else followup_workshop_id\n      end,\n      followup_workshop_type = case\n        when v_offers then nullif(trim(coalesce(p_followup_workshop_type, '')), '')\n        else null\n      end,\n      followup_min_days = case when v_offers then p_followup_min_days else null end,\n      followup_max_days = case when v_offers then p_followup_max_days else null end,\n      updated_at = timezone('utc'::text, now())\n  where id = p_workshop_id;\n\n  if not found then raise exception 'Workshop not found'; end if;\nend;\n$$;\n\nrevoke all on function public.set_workshop_operational_metadata_v2(\n  uuid, text, boolean, text, boolean, boolean, text, integer, integer\n) from public, anon;\ngrant execute on function public.set_workshop_operational_metadata_v2(\n  uuid, text, boolean, text, boolean, boolean, text, integer, integer\n) to authenticated, service_role;\n\n${guardedFunction}`;
write(
  'supabase/migrations/00000000000029_optional_followup_sessions.sql',
  migration29
);

const docs = 'docs/LINKED_WORKSHOPS_AND_REMINDERS.md';
write(
  docs,
  read(docs) +
    `\n\n## Optional follow-up stages\n\nMigration 29 adds an explicit offered-but-optional mode. Glina do Wina uses this mode: checkout displays available glazing sessions and a **Nie rezerwuję teraz** choice. Leaving the choice empty creates only the first booking; selecting a date creates and links both bookings in the same order. Required multi-stage courses remain supported separately.\n`
);
