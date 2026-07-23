import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Pulpit | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const supabase = createClient();
  const now = new Date().toISOString();

  const [
    { count: publishedWorkshops },
    { count: draftWorkshops },
    { count: archivedWorkshops },
    { count: upcomingSessions },
    { count: draftPages },
    { count: draftBlogPosts },
    { count: visibleGalleryItems },
    { data: upcomingSessionsList },
  ] = await Promise.all([
    supabase
      .from('workshops')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .is('archived_at', null),
    supabase
      .from('workshops')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'draft'),
    supabase
      .from('workshops')
      .select('*', { count: 'exact', head: true })
      .not('archived_at', 'is', null),
    supabase
      .from('workshop_sessions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['scheduled', 'sold_out'])
      .gt('starts_at', now),
    supabase
      .from('content_pages')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'draft'),
    supabase
      .from('blog_posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'draft'),
    supabase
      .from('gallery_items')
      .select('*', { count: 'exact', head: true })
      .eq('is_visible', true),
    supabase
      .from('workshop_sessions')
      .select('id, starts_at, ends_at, timezone, capacity, reserved_count')
      .in('status', ['scheduled', 'sold_out'])
      .gt('starts_at', now)
      .order('starts_at', { ascending: true })
      .limit(5),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Pulpit</h1>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Opublikowane warsztaty"
          value={publishedWorkshops ?? 0}
        />
        <SummaryCard
          label="Wersje robocze warsztatów"
          value={draftWorkshops ?? 0}
        />
        <SummaryCard
          label="Nadchodzące terminy"
          value={upcomingSessions ?? 0}
        />
        <SummaryCard
          label="Widoczne pozycje galerii"
          value={visibleGalleryItems ?? 0}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 text-lg font-medium">Nadchodzące terminy</h2>
          {upcomingSessionsList && upcomingSessionsList.length > 0 ? (
            <ul className="divide-y">
              {upcomingSessionsList.map((session) => (
                <li key={session.id} className="py-2 text-sm">
                  <span>{session.starts_at}</span>
                  <span className="ml-2 text-gray-500">
                    ({session.timezone})
                  </span>
                  <span className="ml-2 text-gray-500">
                    {session.reserved_count}/{session.capacity}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">
              Brak nadchodzących terminów.
            </p>
          )}
        </section>

        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 text-lg font-medium">Wersje robocze</h2>
          <div className="space-y-2 text-sm">
            <p>Strony: {draftPages ?? 0}</p>
            <p>Blog: {draftBlogPosts ?? 0}</p>
            <p>Zarchiwizowane warsztaty: {archivedWorkshops ?? 0}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
