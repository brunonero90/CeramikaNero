import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAnyRole: vi.fn(),
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  validateUploadedFile: vi.fn(),
  generateStoragePath: vi.fn(),
  uploadMediaToStorage: vi.fn(),
  mapMediaAsset: vi.fn(),
  recordAuditEvent: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/lib/admin/auth', () => ({
  requireAnyRole: mocks.requireAnyRole,
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock('@/lib/admin/media', () => ({
  validateUploadedFile: mocks.validateUploadedFile,
  generateStoragePath: mocks.generateStoragePath,
  uploadMediaToStorage: mocks.uploadMediaToStorage,
}));
vi.mock('@/lib/database/mappers', () => ({
  mapMediaAsset: mocks.mapMediaAsset,
}));
vi.mock('@/lib/admin/audit', () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

const insertedRow = {
  id: '7cb8ac24-6757-4737-bd2e-0f332dcc2ec1',
  original_filename: 'course.jpg',
  storage_bucket: 'media',
  storage_path: 'originals/2026/07/id/course.jpg',
  mime_type: 'image/jpeg',
  width: 1200,
  height: 800,
  file_size_bytes: 4,
  alt_text: 'Zdjęcie kursu',
  caption: null,
  source: 'upload',
  wix_url: null,
  checksum: null,
  archived_at: null,
};

function formData() {
  const data = new FormData();
  data.set('file', new File(['test'], 'course.jpg', { type: 'image/jpeg' }));
  data.set('altText', 'Zdjęcie kursu');
  return data;
}

describe('uploadMediaAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAnyRole.mockResolvedValue({
      userId: '6062b146-7101-47bb-a397-649cf3d8dfa8',
      role: 'owner',
    });
    mocks.validateUploadedFile.mockResolvedValue({
      ok: true,
      buffer: Buffer.from('test'),
      mimeType: 'image/jpeg',
      width: 1200,
      height: 800,
    });
    mocks.generateStoragePath.mockReturnValue(
      'originals/2026/07/id/course.jpg'
    );
    mocks.uploadMediaToStorage.mockResolvedValue({
      ok: true,
      publicUrl: 'https://example.test/course.jpg',
    });
    mocks.mapMediaAsset.mockReturnValue({ id: insertedRow.id });
    mocks.recordAuditEvent.mockResolvedValue(undefined);
  });

  it('authorizes the user but writes the object with the server-only client', async () => {
    const single = vi.fn().mockResolvedValue({
      data: insertedRow,
      error: null,
    });
    const metadataClient = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({ single })),
        })),
      })),
    };
    const storageAdmin = {
      storage: { from: vi.fn() },
    };
    mocks.createClient.mockResolvedValue(metadataClient);
    mocks.createAdminClient.mockReturnValue(storageAdmin);

    const { uploadMediaAction } =
      await import('@/app/admin/(protected)/media/actions');
    const result = await uploadMediaAction(undefined, formData());

    expect(result.ok).toBe(true);
    expect(mocks.requireAnyRole).toHaveBeenCalledWith(['editor', 'manager']);
    expect(mocks.uploadMediaToStorage).toHaveBeenCalledWith(
      storageAdmin,
      expect.objectContaining({
        path: 'originals/2026/07/id/course.jpg',
        mimeType: 'image/jpeg',
      })
    );
    expect(metadataClient.from).toHaveBeenCalledWith('media_assets');
  });

  it('removes the uploaded object when metadata persistence fails', async () => {
    const single = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'insert failed' },
    });
    const metadataClient = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({ single })),
        })),
      })),
    };
    const remove = vi.fn().mockResolvedValue({ error: null });
    const storageAdmin = {
      storage: {
        from: vi.fn(() => ({ remove })),
      },
    };
    mocks.createClient.mockResolvedValue(metadataClient);
    mocks.createAdminClient.mockReturnValue(storageAdmin);

    const { uploadMediaAction } =
      await import('@/app/admin/(protected)/media/actions');
    const result = await uploadMediaAction(undefined, formData());

    expect(result).toMatchObject({ ok: false, field: 'file' });
    expect(remove).toHaveBeenCalledWith(['originals/2026/07/id/course.jpg']);
  });
});
