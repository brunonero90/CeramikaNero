import type { Metadata } from 'next';
import { LegalDocumentView } from '@/components/clone/legal-document-view';
import { regulaminDocument } from '@/lib/clone/content/legal-documents';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: regulaminDocument.title,
  description: regulaminDocument.metaDescription,
};

export default function RegulaminPage() {
  return <LegalDocumentView blocks={regulaminDocument.blocks} />;
}
