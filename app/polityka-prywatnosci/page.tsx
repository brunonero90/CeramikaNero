import type { Metadata } from 'next';
import { LegalDocumentView } from '@/components/clone/legal-document-view';
import { politykaPrywatnosciDocument } from '@/lib/clone/content/legal-documents';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: politykaPrywatnosciDocument.title,
  description: politykaPrywatnosciDocument.metaDescription,
};

export default function PolitykaPrywatnosciPage() {
  // Intentionally omit `note` — audit/developer commentary must not be public.
  return <LegalDocumentView blocks={politykaPrywatnosciDocument.blocks} />;
}
