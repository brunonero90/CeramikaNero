import { createClient } from '@/lib/supabase/server';
import { requireOwner } from '@/lib/admin/auth';

export const metadata = {
  title: 'Audyt | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  await requireOwner();
  const supabase = createClient();
  const { data: events } = await supabase
    .from('admin_audit_log')
    .select(
      'id, actor_user_id, actor_role, action, entity_type, entity_id, summary, changed_fields, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dziennik audytu</h1>
      <div className="rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-4 py-2">Czas</th>
              <th className="px-4 py-2">Aktor</th>
              <th className="px-4 py-2">Rola</th>
              <th className="px-4 py-2">Akcja</th>
              <th className="px-4 py-2">Encja</th>
              <th className="px-4 py-2">Podsumowanie</th>
            </tr>
          </thead>
          <tbody>
            {events && events.length > 0 ? (
              events.map((event) => (
                <tr key={event.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2">{event.created_at}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {event.actor_user_id}
                  </td>
                  <td className="px-4 py-2">{event.actor_role}</td>
                  <td className="px-4 py-2">{event.action}</td>
                  <td className="px-4 py-2">
                    {event.entity_type}
                    {event.entity_id ? ` / ${event.entity_id}` : ''}
                  </td>
                  <td className="px-4 py-2">{event.summary}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-gray-500">
                  Brak wpisów audytu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
