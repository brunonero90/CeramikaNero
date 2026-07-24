'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  isSafeInternalHref,
  serializeClonePageDocument,
  type ClonePageDocument,
  type ClonePageSection,
} from '@/lib/cms/page-document';

type Props = {
  initialDocument: ClonePageDocument;
  /** Hidden form field name submitted with the page form. */
  name?: string;
};

const TEMPLATE_LABELS: Record<ClonePageDocument['template'], string> = {
  archive: 'Szablon archiwum (sekcje tekstowe)',
  'marketing-split': 'Szablon marketingowy (hero + bloki)',
  'homepage-services': 'Sekcja usług na stronie głównej',
  gallery: 'Galeria',
  'glina-box': 'Glina Box / home',
};

function updateSection(
  sections: ClonePageSection[],
  index: number,
  next: ClonePageSection
): ClonePageSection[] {
  return sections.map((section, i) => (i === index ? next : section));
}

function linesToArray(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
}

export function ClonePageEditor({ initialDocument, name = 'content' }: Props) {
  const [document, setDocument] = useState<ClonePageDocument>(initialDocument);
  const [showRaw, setShowRaw] = useState(false);
  const [hrefWarning, setHrefWarning] = useState<string | null>(null);

  const serialized = useMemo(
    () => serializeClonePageDocument(document),
    [document]
  );

  function setSections(sections: ClonePageSection[]) {
    setDocument((prev) => ({ ...prev, sections }));
    setHrefWarning(null);
  }

  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= document.sections.length) return;
    const next = [...document.sections];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setSections(next);
  }

  function validateHrefs(sections: ClonePageSection[]): string | null {
    for (const section of sections) {
      if (section.type === 'archive-section') {
        for (const button of section.buttons) {
          if (button.href && !isSafeInternalHref(button.href)) {
            return `Niebezpieczny lub niedozwolony link CTA: ${button.href}`;
          }
        }
      }
      if (section.type === 'split-block' && section.ctaHref) {
        if (!isSafeInternalHref(section.ctaHref)) {
          return `Niebezpieczny lub niedozwolony link CTA: ${section.ctaHref}`;
        }
      }
    }
    return null;
  }

  function onDocumentChange(next: ClonePageDocument) {
    const warning = validateHrefs(next.sections);
    setHrefWarning(warning);
    setDocument(next);
  }

  return (
    <div className="space-y-4 rounded-md border border-gray-200 bg-gray-50 p-4">
      <input type="hidden" name={name} value={serialized} readOnly />

      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-900">Treść strony (CMS)</p>
        <p className="text-xs text-gray-600">
          {TEMPLATE_LABELS[document.template]}. Układ i style strony pozostają w
          aplikacji — tutaj edytujesz wyłącznie treść, obrazy i CTA.
        </p>
        <p className="text-xs text-gray-500">
          Trasa: {document.route} · sekcji: {document.sections.length}
        </p>
      </div>

      {hrefWarning && (
        <p
          className="rounded-md bg-amber-50 p-2 text-sm text-amber-900"
          role="status"
        >
          {hrefWarning} — popraw przed publikacją.
        </p>
      )}

      <div>
        <label
          htmlFor="cms-meta-description"
          className="block text-sm font-medium"
        >
          Opis meta (dokument)
        </label>
        <textarea
          id="cms-meta-description"
          rows={2}
          value={document.metaDescription ?? ''}
          onChange={(event) =>
            onDocumentChange({
              ...document,
              metaDescription: event.target.value || undefined,
            })
          }
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-3">
        {document.sections.map((section, index) => (
          <section
            key={`${section.type}-${index}`}
            className="rounded-md border border-gray-300 bg-white p-3"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-800">
                Sekcja {index + 1}: {section.type}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs disabled:opacity-40"
                  disabled={index === 0}
                  onClick={() => moveSection(index, -1)}
                >
                  W górę
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs disabled:opacity-40"
                  disabled={index === document.sections.length - 1}
                  onClick={() => moveSection(index, 1)}
                >
                  W dół
                </button>
              </div>
            </div>

            {section.type === 'archive-section' && (
              <ArchiveSectionFields
                section={section}
                onChange={(next) =>
                  onDocumentChange({
                    ...document,
                    sections: updateSection(document.sections, index, next),
                  })
                }
              />
            )}
            {section.type === 'hero' && (
              <HeroSectionFields
                section={section}
                onChange={(next) =>
                  onDocumentChange({
                    ...document,
                    sections: updateSection(document.sections, index, next),
                  })
                }
              />
            )}
            {section.type === 'split-block' && (
              <SplitBlockFields
                section={section}
                onChange={(next) =>
                  onDocumentChange({
                    ...document,
                    sections: updateSection(document.sections, index, next),
                  })
                }
              />
            )}
            {section.type === 'paragraphs' && (
              <ParagraphsFields
                section={section}
                onChange={(next) =>
                  onDocumentChange({
                    ...document,
                    sections: updateSection(document.sections, index, next),
                  })
                }
              />
            )}
          </section>
        ))}
      </div>

      <div>
        <button
          type="button"
          className="text-sm text-gray-700 underline"
          onClick={() => setShowRaw((value) => !value)}
        >
          {showRaw ? 'Ukryj surowy JSON' : 'Pokaż surowy JSON (zaawansowane)'}
        </button>
        {showRaw && (
          <textarea
            readOnly
            rows={8}
            value={serialized}
            className="mt-2 w-full rounded-md border border-gray-300 bg-white p-2 font-mono text-xs"
          />
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block text-sm">
      <span className="font-medium text-gray-800">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function textInputClassName() {
  return 'block w-full rounded-md border border-gray-300 px-3 py-2 text-sm';
}

function ArchiveSectionFields({
  section,
  onChange,
}: {
  section: Extract<ClonePageSection, { type: 'archive-section' }>;
  onChange: (
    next: Extract<ClonePageSection, { type: 'archive-section' }>
  ) => void;
}) {
  return (
    <div>
      <Field label="Nagłówek">
        <input
          className={textInputClassName()}
          value={section.heading ?? ''}
          onChange={(event) =>
            onChange({
              ...section,
              heading: event.target.value.trim() ? event.target.value : null,
            })
          }
        />
      </Field>
      <Field label="Tekst (akapity oddzielone pustą linią; listy z ■ / –)">
        <textarea
          rows={10}
          className={textInputClassName()}
          value={section.text}
          onChange={(event) =>
            onChange({ ...section, text: event.target.value })
          }
        />
      </Field>
      <Field label="Obrazy (ścieżka | alt — jedna linia na obraz)">
        <textarea
          rows={Math.max(2, section.images.length + 1)}
          className={textInputClassName()}
          value={section.images
            .map((image) => `${image.src} | ${image.alt}`)
            .join('\n')}
          onChange={(event) =>
            onChange({
              ...section,
              images: linesToArray(event.target.value).map((line) => {
                const [src, ...rest] = line.split('|');
                return {
                  src: (src ?? '').trim(),
                  alt: rest.join('|').trim(),
                };
              }),
            })
          }
        />
      </Field>
      <Field label="CTA (etykieta | href — jedna linia)">
        <textarea
          rows={Math.max(2, section.buttons.length + 1)}
          className={textInputClassName()}
          value={section.buttons
            .map((button) => `${button.label} | ${button.href}`)
            .join('\n')}
          onChange={(event) =>
            onChange({
              ...section,
              buttons: linesToArray(event.target.value).map((line) => {
                const [label, ...rest] = line.split('|');
                return {
                  label: (label ?? '').trim(),
                  href: rest.join('|').trim(),
                };
              }),
            })
          }
        />
      </Field>
    </div>
  );
}

function HeroSectionFields({
  section,
  onChange,
}: {
  section: Extract<ClonePageSection, { type: 'hero' }>;
  onChange: (next: Extract<ClonePageSection, { type: 'hero' }>) => void;
}) {
  return (
    <div>
      <Field label="Tytuł hero">
        <input
          className={textInputClassName()}
          value={section.title}
          onChange={(event) =>
            onChange({ ...section, title: event.target.value })
          }
        />
      </Field>
      <Field label="Obraz (src)">
        <input
          className={textInputClassName()}
          value={section.imageSrc}
          onChange={(event) =>
            onChange({ ...section, imageSrc: event.target.value })
          }
        />
      </Field>
      <Field label="Alt obrazu">
        <input
          className={textInputClassName()}
          value={section.imageAlt}
          onChange={(event) =>
            onChange({ ...section, imageAlt: event.target.value })
          }
        />
      </Field>
      <Field label="Intro (jedna linia = jeden akapit)">
        <textarea
          rows={4}
          className={textInputClassName()}
          value={(section.intro ?? []).join('\n')}
          onChange={(event) =>
            onChange({
              ...section,
              intro: linesToArray(event.target.value),
            })
          }
        />
      </Field>
    </div>
  );
}

function SplitBlockFields({
  section,
  onChange,
}: {
  section: Extract<ClonePageSection, { type: 'split-block' }>;
  onChange: (next: Extract<ClonePageSection, { type: 'split-block' }>) => void;
}) {
  return (
    <div>
      <Field label="Tytuł">
        <input
          className={textInputClassName()}
          value={section.title}
          onChange={(event) =>
            onChange({ ...section, title: event.target.value })
          }
        />
      </Field>
      <Field label="Podtytuł">
        <input
          className={textInputClassName()}
          value={section.subtitle ?? ''}
          onChange={(event) =>
            onChange({
              ...section,
              subtitle: event.target.value || undefined,
            })
          }
        />
      </Field>
      <Field label="Akapity (jedna linia = jeden akapit)">
        <textarea
          rows={5}
          className={textInputClassName()}
          value={(section.paragraphs ?? []).join('\n')}
          onChange={(event) =>
            onChange({
              ...section,
              paragraphs: linesToArray(event.target.value),
            })
          }
        />
      </Field>
      <Field label="Lista punktowana (jedna linia = punkt)">
        <textarea
          rows={4}
          className={textInputClassName()}
          value={(section.bullets ?? []).join('\n')}
          onChange={(event) =>
            onChange({
              ...section,
              bullets: linesToArray(event.target.value),
            })
          }
        />
      </Field>
      <Field label="Obraz (src)">
        <input
          className={textInputClassName()}
          value={section.imageSrc}
          onChange={(event) =>
            onChange({ ...section, imageSrc: event.target.value })
          }
        />
      </Field>
      <Field label="Alt obrazu">
        <input
          className={textInputClassName()}
          value={section.imageAlt}
          onChange={(event) =>
            onChange({ ...section, imageAlt: event.target.value })
          }
        />
      </Field>
      <Field label="CTA — etykieta">
        <input
          className={textInputClassName()}
          value={section.ctaLabel ?? ''}
          onChange={(event) =>
            onChange({
              ...section,
              ctaLabel: event.target.value || undefined,
            })
          }
        />
      </Field>
      <Field label="CTA — href (wewnętrzny / mailto / tel / wa.me)">
        <input
          className={textInputClassName()}
          value={section.ctaHref ?? ''}
          onChange={(event) =>
            onChange({
              ...section,
              ctaHref: event.target.value || undefined,
            })
          }
        />
      </Field>
    </div>
  );
}

function ParagraphsFields({
  section,
  onChange,
}: {
  section: Extract<ClonePageSection, { type: 'paragraphs' }>;
  onChange: (next: Extract<ClonePageSection, { type: 'paragraphs' }>) => void;
}) {
  return (
    <Field label="Akapity (jedna linia = jeden akapit)">
      <textarea
        rows={6}
        className={textInputClassName()}
        value={section.paragraphs.join('\n')}
        onChange={(event) =>
          onChange({
            ...section,
            paragraphs: linesToArray(event.target.value),
          })
        }
      />
    </Field>
  );
}
