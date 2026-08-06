import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import {
  mapCategory,
  mapInstructor,
  mapMediaAsset,
  mapWorkshop,
} from '@/lib/database/mappers';
import { groszToZloty } from '@/lib/utils/money';
import { WorkshopForm } from '../workshop-form';
import { updateWorkshopAction } from '../actions';

export const metadata = {
  title: 'Edytuj warsztat | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function EditWorkshopPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAnyRole(['manager']);
  const supabase = await createClient();

  const { data: workshop } = await supabase
    .from('workshops')
    .select('*')
    .eq('id', id)
    .single();
  if (!workshop) notFound();

  const { data: workshopInstructors } = await supabase
    .from('workshop_instructors')
    .select('instructor_id, display_order')
    .eq('workshop_id', id)
    .order('display_order');
  const { data: workshopMedia } = await supabase
    .from('workshop_media')
    .select('media_asset_id, role, display_order')
    .eq('workshop_id', id)
    .order('display_order');

  const [{ data: categories }, { data: instructors }, { data: mediaAssets }] =
    await Promise.all([
      supabase.from('workshop_categories').select('*').order('display_order'),
      supabase
        .from('instructors')
        .select('*')
        .eq('is_active', true)
        .order('display_order'),
      supabase
        .from('media_assets')
        .select('*')
        .is('archived_at', null)
        .order('created_at', { ascending: false }),
    ]);

  const { data } = supabase.storage.from('media').getPublicUrl('');
  const baseUrl = data.publicUrl.replace(/\/$/, '');

  const mapped = mapWorkshop(workshop);
  const operational = workshop as typeof workshop & {
    participant_audience?: 'adult' | 'child' | 'mixed';
    collect_participant_age?: boolean;
    workshop_type?: string | null;
    offers_followup_session?: boolean;
    requires_followup_session?: boolean;
    followup_workshop_type?: string | null;
    followup_min_days?: number | null;
    followup_max_days?: number | null;
  };
  const initialData = {
    ...mapped,
    shortDescription: mapped.shortDescription ?? '',
    description: mapped.description ?? '',
    practicalInformation: mapped.practicalInformation ?? '',
    minimumAge: mapped.minimumAge?.toString() ?? '',
    maximumAge: mapped.maximumAge?.toString() ?? '',
    participantAudience: operational.participant_audience ?? 'adult',
    collectParticipantAge: operational.collect_participant_age ?? false,
    workshopType: operational.workshop_type ?? mapped.slug,
    offersFollowupSession:
      operational.offers_followup_session ??
      operational.requires_followup_session ??
      false,
    requiresFollowupSession: operational.requires_followup_session ?? false,
    followupWorkshopType: operational.followup_workshop_type ?? '',
    followupMinDays: operational.followup_min_days?.toString() ?? '5',
    followupMaxDays: operational.followup_max_days?.toString() ?? '45',
    defaultPriceGrossPln: Number(groszToZloty(mapped.defaultPriceGrossGrosz)),
    externalBookingUrl: mapped.externalBookingUrl ?? '',
    seoTitle: mapped.seoTitle ?? '',
    seoDescription: mapped.seoDescription ?? '',
    instructorIds: (workshopInstructors ?? []).map((wi) => wi.instructor_id),
    galleryMedia: (workshopMedia ?? []).map((wm) => ({
      mediaAssetId: wm.media_asset_id,
      role: wm.role as 'gallery' | 'detail',
    })),
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edytuj warsztat</h1>
      <WorkshopForm
        action={updateWorkshopAction.bind(null, id)}
        initialData={initialData}
        categories={(categories ?? []).map(mapCategory)}
        instructors={(instructors ?? []).map(mapInstructor)}
        mediaAssets={(mediaAssets ?? []).map(mapMediaAsset)}
        baseUrl={baseUrl}
        submitLabel="Zapisz zmiany"
      />
    </div>
  );
}
