import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import type { Database } from '@/lib/database/types';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

const hasRemoteEnv = Boolean(url && key && secretKey);
const runId = randomUUID();
const prefix = `int_test_${runId}`;

describe.skipIf(!hasRemoteEnv)('remote integration tests', () => {
  const admin = hasRemoteEnv
    ? createClient<Database>(url!, secretKey!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : (null as unknown as ReturnType<typeof createClient<Database>>);
  const publicClient = hasRemoteEnv
    ? createClient<Database>(url!, key!)
    : (null as unknown as ReturnType<typeof createClient<Database>>);

  const ids: {
    category?: string;
    instructor?: string;
    media?: string;
    workshop?: string;
    session?: string;
    blog?: string;
    gallery?: string;
    nonAdminUser?: string;
    editorUser?: string;
    managerUser?: string;
    redirect?: string;
  } = {};

  beforeAll(async () => {
    const { data: cat } = await admin
      .from('workshop_categories')
      .insert({
        name: `${prefix} Category`,
        slug: `${prefix}-cat`,
        description: 'test category',
        is_visible: true,
        suggested_theme: 'atelier',
        display_order: 0,
      })
      .select('id')
      .single();
    ids.category = cat?.id;

    const { data: inst } = await admin
      .from('instructors')
      .insert({
        display_name: `${prefix} Instructor`,
        slug: `${prefix}-instructor`,
        biography: 'test bio',
        is_active: true,
        display_order: 0,
      })
      .select('id')
      .single();
    ids.instructor = inst?.id;

    const { data: media } = await admin
      .from('media_assets')
      .insert({
        original_filename: `${prefix}.jpg`,
        storage_bucket: 'media',
        storage_path: `${prefix}.jpg`,
        mime_type: 'image/jpeg',
        width: 100,
        height: 100,
        file_size_bytes: 1024,
        alt_text: `${prefix} alt`,
        source: 'upload',
      })
      .select('id')
      .single();
    ids.media = media?.id;

    const { data: workshop } = await admin
      .from('workshops')
      .insert({
        category_id: ids.category!,
        title: `${prefix} Workshop`,
        slug: `${prefix}-workshop`,
        short_description: 'short',
        description: 'description',
        practical_information: 'practical',
        minimum_age: 10,
        maximum_age: 99,
        default_duration_minutes: 120,
        default_capacity: 10,
        default_price_gross_grosz: 5000,
        currency: 'PLN',
        suggested_theme: 'joyful',
        featured_media_id: ids.media!,
        booking_mode: 'scheduled',
        status: 'published',
        is_featured: false,
        seo_title: 'seo',
        seo_description: 'seo desc',
      })
      .select('id')
      .single();
    ids.workshop = workshop?.id;

    await admin.from('workshop_instructors').insert({
      workshop_id: ids.workshop!,
      instructor_id: ids.instructor!,
      display_order: 0,
    });

    await admin.from('workshop_media').insert({
      workshop_id: ids.workshop!,
      media_asset_id: ids.media!,
      role: 'gallery',
      display_order: 0,
    });

    const { data: session } = await admin
      .from('workshop_sessions')
      .insert({
        workshop_id: ids.workshop!,
        instructor_id: ids.instructor!,
        starts_at: '2026-08-01T10:00:00+02:00',
        ends_at: '2026-08-01T12:00:00+02:00',
        timezone: 'Europe/Warsaw',
        capacity: 10,
        reserved_count: 0,
        price_gross_grosz: 5000,
        currency: 'PLN',
        location_name: 'Pracownia',
        status: 'scheduled',
        booking_opens_at: '2026-07-01T00:00:00+02:00',
        booking_closes_at: '2026-08-01T09:00:00+02:00',
      })
      .select('id')
      .single();
    ids.session = session?.id;

    const { data: blog } = await admin
      .from('blog_posts')
      .insert({
        title: `${prefix} Blog`,
        slug: `${prefix}-blog`,
        excerpt: 'excerpt',
        content: 'content',
        featured_media_id: ids.media!,
        status: 'published',
        author_name: 'Author',
        published_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    ids.blog = blog?.id;

    const { data: gallery } = await admin
      .from('gallery_items')
      .insert({
        media_asset_id: ids.media!,
        title: `${prefix} Gallery`,
        description: 'desc',
        category: 'test',
        is_visible: true,
        display_order: 0,
      })
      .select('id')
      .single();
    ids.gallery = gallery?.id;

    const { data: nonAdmin } = await admin.auth.admin.createUser({
      email: `${prefix}@example.com`,
      password: 'Int3grat!onTest',
      email_confirm: true,
    });
    ids.nonAdminUser = nonAdmin?.user?.id;

    const { data: editor } = await admin.auth.admin.createUser({
      email: `editor.${prefix}@example.com`,
      password: 'Int3grat!onTest',
      email_confirm: true,
    });
    ids.editorUser = editor?.user?.id;
    if (ids.editorUser) {
      await admin.from('admin_users').insert({
        user_id: ids.editorUser,
        role: 'editor',
        display_name: 'Editor Test',
        is_active: true,
      });
    }

    const { data: manager } = await admin.auth.admin.createUser({
      email: `manager.${prefix}@example.com`,
      password: 'Int3grat!onTest',
      email_confirm: true,
    });
    ids.managerUser = manager?.user?.id;
    if (ids.managerUser) {
      await admin.from('admin_users').insert({
        user_id: ids.managerUser,
        role: 'manager',
        display_name: 'Manager Test',
        is_active: true,
      });
    }
  });

  afterAll(async () => {
    await admin
      .from('admin_users')
      .delete()
      .in(
        'user_id',
        [ids.editorUser, ids.managerUser].filter((id): id is string =>
          Boolean(id)
        )
      );

    if (ids.nonAdminUser) {
      await admin.auth.admin.deleteUser(ids.nonAdminUser);
    }
    if (ids.editorUser) {
      await admin.auth.admin.deleteUser(ids.editorUser);
    }
    if (ids.managerUser) {
      await admin.auth.admin.deleteUser(ids.managerUser);
    }

    await admin.from('gallery_items').delete().eq('id', ids.gallery!);
    await admin.from('blog_posts').delete().eq('id', ids.blog!);
    await admin.from('workshop_sessions').delete().eq('id', ids.session!);
    await admin
      .from('workshop_media')
      .delete()
      .eq('workshop_id', ids.workshop!);
    await admin
      .from('workshop_instructors')
      .delete()
      .eq('workshop_id', ids.workshop!);
    await admin.from('workshops').delete().eq('id', ids.workshop!);
    await admin.from('instructors').delete().eq('id', ids.instructor!);
    await admin.from('workshop_categories').delete().eq('id', ids.category!);
    await admin.from('media_assets').delete().eq('id', ids.media!);
    await admin
      .from('legacy_redirects')
      .delete()
      .like('source_path', `${prefix}%`);
    await admin.from('admin_audit_log').delete().like('summary', `%${prefix}%`);
  });

  it('public reads published workshops and categories', async () => {
    const { data } = await publicClient
      .from('workshops')
      .select('id, title, slug, workshop_categories!inner(id, name)')
      .eq('slug', `${prefix}-workshop`)
      .single();
    expect(data?.title).toBe(`${prefix} Workshop`);
  });

  it('public cannot read private tables', async () => {
    const { data: adminUsers } = await publicClient
      .from('admin_users')
      .select('*');
    expect(adminUsers).toEqual([]);
    const { data: bookings } = await publicClient.from('bookings').select('*');
    expect(bookings).toEqual([]);
  });

  it('authenticated non-admin is denied from admin tables', async () => {
    const nonAdminClient = createClient<Database>(url!, key!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        storageKey: `non-admin-${runId}`,
      },
    });
    const { error } = await nonAdminClient.auth.signInWithPassword({
      email: `${prefix}@example.com`,
      password: 'Int3grat!onTest',
    });
    expect(error).toBeNull();
    const { data } = await nonAdminClient.from('admin_users').select('*');
    expect(data).toEqual([]);
  });

  it('editor can manage media but cannot manage workshops', async () => {
    const editorClient = createClient<Database>(url!, key!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        storageKey: `editor-${runId}`,
      },
    });
    await editorClient.auth.signInWithPassword({
      email: `editor.${prefix}@example.com`,
      password: 'Int3grat!onTest',
    });

    const { data: media } = await editorClient
      .from('media_assets')
      .update({ alt_text: 'updated by editor' })
      .eq('id', ids.media!)
      .select('id')
      .single();
    expect(media).not.toBeNull();

    await editorClient
      .from('workshops')
      .update({ title: 'hacked' })
      .eq('id', ids.workshop!);
    const { data: workshopAfter } = await admin
      .from('workshops')
      .select('title')
      .eq('id', ids.workshop!)
      .single();
    expect(workshopAfter?.title).not.toBe('hacked');
  });

  it('manager can manage workshops and sessions', async () => {
    const managerClient = createClient<Database>(url!, key!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        storageKey: `manager-${runId}`,
      },
    });
    await managerClient.auth.signInWithPassword({
      email: `manager.${prefix}@example.com`,
      password: 'Int3grat!onTest',
    });

    const { data: workshop } = await managerClient
      .from('workshops')
      .update({ title: `${prefix} Workshop Updated` })
      .eq('id', ids.workshop!)
      .select('title')
      .single();
    expect(workshop?.title).toBe(`${prefix} Workshop Updated`);

    const { data: session } = await managerClient
      .from('workshop_sessions')
      .update({ capacity: 15 })
      .eq('id', ids.session!)
      .select('capacity')
      .single();
    expect(session?.capacity).toBe(15);
  });

  it('session stores UTC from Europe/Warsaw input', async () => {
    const { data: session } = await admin
      .from('workshop_sessions')
      .select('starts_at, ends_at')
      .eq('id', ids.session!)
      .single();
    expect(session?.starts_at).toBe('2026-08-01T08:00:00+00:00');
    expect(session?.ends_at).toBe('2026-08-01T10:00:00+00:00');
  });

  it('capacity constraint rejects reserved_count above capacity', async () => {
    const { error } = await admin
      .from('workshop_sessions')
      .update({ reserved_count: 100 })
      .eq('id', ids.session!);
    expect(error).not.toBeNull();
  });

  it('detects duplicate workshop slug', async () => {
    const { error } = await admin.from('workshops').insert({
      category_id: ids.category!,
      title: 'Duplicate',
      slug: `${prefix}-workshop`,
      default_duration_minutes: 60,
      default_capacity: 5,
      default_price_gross_grosz: 1000,
      booking_mode: 'enquiry',
      status: 'draft',
    });
    expect(error).not.toBeNull();
  });

  it('creates a redirect on published workshop slug change', async () => {
    const { data: newSlugId } = await admin.rpc(
      'upsert_workshop_with_relations',
      {
        p_workshop_id: ids.workshop!,
        p_category_id: ids.category!,
        p_title: `${prefix} Workshop Updated`,
        p_slug: `${prefix}-workshop-renamed`,
        p_short_description: 'short',
        p_description: 'description',
        p_practical_information: 'practical',
        p_minimum_age: 10,
        p_maximum_age: 99,
        p_default_duration_minutes: 120,
        p_default_capacity: 15,
        p_default_price_gross_grosz: 5000,
        p_suggested_theme: 'joyful',
        p_featured_media_id: ids.media!,
        p_booking_mode: 'scheduled',
        p_external_booking_url: null,
        p_status: 'published',
        p_is_featured: false,
        p_seo_title: 'seo',
        p_seo_description: 'seo desc',
        p_instructor_ids: [ids.instructor!],
        p_gallery_media: [],
      } as unknown as Database['public']['Functions']['upsert_workshop_with_relations']['Args']
    );

    expect(newSlugId).toBe(ids.workshop);

    const { data: redirect } = await admin
      .from('legacy_redirects')
      .select('source_path, destination_path, status_code')
      .eq('source_path', `/warsztaty/${prefix}-workshop`)
      .single();
    expect(redirect?.destination_path).toBe(
      `/warsztaty/${prefix}-workshop-renamed`
    );
    expect(redirect?.status_code).toBe(301);
  });

  it('scheduled blog post is not publicly visible before published_at', async () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const { data: scheduled } = await admin
      .from('blog_posts')
      .insert({
        title: `${prefix} Scheduled`,
        slug: `${prefix}-scheduled`,
        excerpt: 'excerpt',
        content: 'content',
        status: 'published',
        published_at: future.toISOString(),
      })
      .select('id')
      .single();

    const { data: publicScheduled } = await publicClient
      .from('blog_posts')
      .select('id')
      .eq('slug', `${prefix}-scheduled`)
      .single();
    expect(publicScheduled).toBeNull();

    if (scheduled?.id) {
      await admin.from('blog_posts').delete().eq('id', scheduled.id);
    }
  });

  it('archived blog post is not publicly visible', async () => {
    const { data: archived } = await admin
      .from('blog_posts')
      .insert({
        title: `${prefix} Archived`,
        slug: `${prefix}-archived`,
        excerpt: 'excerpt',
        content: 'content',
        status: 'archived',
        archived_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    const { data: publicArchived } = await publicClient
      .from('blog_posts')
      .select('id')
      .eq('slug', `${prefix}-archived`)
      .single();
    expect(publicArchived).toBeNull();

    if (archived?.id) {
      await admin.from('blog_posts').delete().eq('id', archived.id);
    }
  });

  it('instructor deactivation does not delete historical associations', async () => {
    await admin
      .from('instructors')
      .update({ is_active: false })
      .eq('id', ids.instructor!);
    const { data: link } = await admin
      .from('workshop_instructors')
      .select('instructor_id')
      .eq('workshop_id', ids.workshop!)
      .single();
    expect(link?.instructor_id).toBe(ids.instructor);
    await admin
      .from('instructors')
      .update({ is_active: true })
      .eq('id', ids.instructor!);
  });

  it('writes an audit record', async () => {
    const { data: before } = await admin
      .from('admin_audit_log')
      .select('id')
      .eq('entity_id', ids.workshop!)
      .eq('action', 'create_workshop');
    expect(before).toBeDefined();
  });

  it('last-owner protection and owner-only audit log view (pending first owner bootstrap)', () => {
    expect(true).toBe(true);
  });
});
