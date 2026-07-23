import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { requireAnyRole } from '@/lib/admin/auth';
import { UploadMediaForm } from './upload-form';
import { uploadMediaAction, archiveMediaAction } from './actions';

export const metadata = {
  title: 'Media | Ceramika Nero Admin',
};

export const dynamic = 'force-dynamic';

export default async function MediaAdminPage() {
  await requireAnyRole(['editor', 'manager']);
  const supabase = createClient();
  const { data: assets } = await supabase
    .from('media_assets')
    .select(
      'id, original_filename, storage_path, mime_type, width, height, alt_text, archived_at'
    )
    .order('created_at', { ascending: false });

  const { data } = supabase.storage.from('media').getPublicUrl('');
  const baseUrl = data.publicUrl.replace(/\/$/, '');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Media</h1>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Prześlij nowy plik</h2>
        <UploadMediaForm action={uploadMediaAction} />
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-lg font-medium">Biblioteka</h2>
        {assets && assets.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => {
              const url = `${baseUrl}/${asset.storage_path}`;
              return (
                <div key={asset.id} className="rounded-md border p-3">
                  <div className="relative aspect-square w-full overflow-hidden rounded-md bg-gray-100">
                    <Image
                      src={url}
                      alt={asset.alt_text}
                      fill
                      className="object-cover"
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    />
                  </div>
                  <p className="mt-2 truncate text-sm font-medium">
                    {asset.original_filename}
                  </p>
                  <p className="text-xs text-gray-500">
                    {asset.width}x{asset.height} {asset.mime_type}
                  </p>
                  <p className="text-xs text-gray-500">{asset.alt_text}</p>
                  {!asset.archived_at && (
                    <form
                      action={archiveMediaAction.bind(null, asset.id)}
                      className="mt-2"
                    >
                      <button
                        type="submit"
                        className="text-xs text-red-600 underline"
                        onClick={(e) => {
                          if (!confirm('Zarchiwizować ten plik?')) {
                            e.preventDefault();
                          }
                        }}
                      >
                        Archiwizuj
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Brak plików w bibliotece.</p>
        )}
      </section>
    </div>
  );
}
