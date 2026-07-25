import type { Metadata } from 'next';
import { LegalDocumentView } from '@/components/clone/legal-document-view';
import { politykaPrywatnosciDocument } from '@/lib/clone/content/legal-documents';

/**
 * Legacy Wix URL. Same professional privacy document as /polityka-prywatnosci.
 * Workshop rules live on /regulamin (archive mixed both on this URL).
 */
export const metadata: Metadata = {
  title: politykaPrywatnosciDocument.title,
  description: politykaPrywatnosciDocument.metaDescription,
  alternates: {
    canonical: '/polityka-prywatnosci',
  },
};

export default function TermsConditionsPage() {
  return (
    <LegalDocumentView
      blocks={politykaPrywatnosciDocument.blocks}
      note={`${politykaPrywatnosciDocument.note} Canonical Polish URL: /polityka-prywatnosci.`}
    />
  );
}
