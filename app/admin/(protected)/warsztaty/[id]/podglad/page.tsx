import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';

export const metadata = {
  title: 'Podgląd warsztatu | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function WorkshopPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAnyRole(['manager']);
  const supabase = await createClient();

  const { data: workshop } = await supabase
    .from('workshops')
    .select('slug')
    .eq('id', id)
    .single();
  if (!workshop) notFound();

  redirect(`/warsztaty/${workshop.slug}`);
}
