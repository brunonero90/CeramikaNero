'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createCartAdminClient } from '@/lib/supabase/cart-admin';
import { requireAnyRole } from '@/lib/admin/auth';

const productSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  sku: z.string().min(2).max(64),
  shortDescription: z.string().max(500).optional().nullable(),
  description: z.string().max(8000).optional().nullable(),
  status: z.enum(['draft', 'published', 'archived']),
  priceGrossPln: z.number().min(0).max(100000),
  requiresShipping: z.boolean(),
  allowsPickup: z.boolean(),
  trackInventory: z.boolean(),
  inventoryQuantity: z.number().int().min(0).max(100000),
  shippingFeeMode: z.enum(['quote_required', 'fixed', 'free']),
});

export async function updateProductAction(formData: FormData): Promise<void> {
  await requireAnyRole(['owner', 'manager']);

  const parsed = productSchema.safeParse({
    id: String(formData.get('id') ?? ''),
    title: String(formData.get('title') ?? ''),
    slug: String(formData.get('slug') ?? ''),
    sku: String(formData.get('sku') ?? ''),
    shortDescription: String(formData.get('shortDescription') ?? '') || null,
    description: String(formData.get('description') ?? '') || null,
    status: String(formData.get('status') ?? ''),
    priceGrossPln: Number(
      String(formData.get('priceGrossPln') ?? '').replace(',', '.')
    ),
    requiresShipping: formData.get('requiresShipping') === 'on',
    allowsPickup: formData.get('allowsPickup') === 'on',
    trackInventory: formData.get('trackInventory') === 'on',
    inventoryQuantity: Number(formData.get('inventoryQuantity') ?? 0),
    shippingFeeMode: String(formData.get('shippingFeeMode') ?? ''),
  });

  if (!parsed.success) {
    throw new Error('Nieprawidłowe dane produktu.');
  }

  const data = parsed.data;
  const priceGrosz = Math.round(data.priceGrossPln * 100);
  const supabase = createCartAdminClient();

  const { error } = await supabase
    .from('products')
    .update({
      title: data.title,
      slug: data.slug,
      sku: data.sku,
      short_description: data.shortDescription,
      description: data.description,
      status: data.status,
      price_gross_grosz: priceGrosz,
      requires_shipping: data.requiresShipping,
      allows_pickup: data.allowsPickup,
      track_inventory: data.trackInventory,
      inventory_quantity: data.inventoryQuantity,
      shipping_fee_mode: data.shippingFeeMode,
      archived_at: data.status === 'archived' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.id);

  if (error) {
    console.error('product update failed', error.message);
    throw new Error('Nie udało się zapisać produktu.');
  }

  revalidatePath('/admin/produkty');
  revalidatePath(`/admin/produkty/${data.id}`);
  revalidatePath('/home');
  redirect(`/admin/produkty/${data.id}`);
}
