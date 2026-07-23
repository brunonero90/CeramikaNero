import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { mapInstructor, mapWorkshop } from '@/lib/database/mappers';
import { SessionForm } from '../session-form';
import { createSessionAction } from '../actions';

export const metadata = {
  title: 'Nowy termin | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function NewSessionPage() {
  await requireAnyRole(['manager']);
  const supabase = createClient();

  const [{ data: workshops }, { data: instructors }] = await Promise.all([
    supabase
      .from('workshops')
      .select('*')
      .neq('status', 'archived')
      .is('archived_at', null)
      .order('title'),
    supabase
      .from('instructors')
      .select('*')
      .eq('is_active', true)
      .order('display_order'),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Nowy termin</h1>
      <SessionForm
        action={createSessionAction}
        workshops={(workshops ?? []).map(mapWorkshop)}
        instructors={(instructors ?? []).map(mapInstructor)}
        submitLabel="Utwórz termin"
      />
    </div>
  );
}
