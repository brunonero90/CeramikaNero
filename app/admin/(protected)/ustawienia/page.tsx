import { createClient } from '@/lib/supabase/server';
import { requireOwner } from '@/lib/admin/auth';
import { mapPublicSiteSettings } from '@/lib/database/mappers';
import { SettingsForm } from './settings-form';
import { updateSettingsAction } from './actions';

export const metadata = {
  title: 'Ustawienia | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await requireOwner();
  const supabase = createClient();
  const { data: rows } = await supabase
    .from('site_settings')
    .select('key, value, description, updated_at');

  const settings = mapPublicSiteSettings(rows ?? []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Ustawienia</h1>
      <SettingsForm action={updateSettingsAction} initialData={settings} />
    </div>
  );
}
