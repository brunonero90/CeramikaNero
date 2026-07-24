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

const SECTION_LABELS: Record<ClonePageSection['type'], string> = {
  'archive-section': 'Sekcja archiwum',
  'split-block': 'Blok tekst + obraz',
  hero: 'Hero',
  paragraphs: 'Akapity',
  'mid-copy': 'Środek strony (pracownia)',
  'bullet-list': 'Lista punktowana',
  'offer-intro': 'Wstęp oferty',
  'labeled-image': 'Obraz z podpisem',
  'cta-block': 'Przycisk CTA',
  'product-card': 'Karta produktu',
  'homepage-header': 'Nagłówek strony głównej',
  'service-card': 'Karta usługi',
  'gallery-grid': 'Siatka galerii',
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
      if (section.type === 'cta-block' && !isSafeInternalHref(section.href)) {
        return `Niebezpieczny lub niedozwolony link CTA: ${section.href}`;
      }
      if (
        section.type === 'product-card' &&
        !isSafeInternalHref(section.href)
      ) {
        return `Niebezpieczny lub niedozwolony link produktu: ${section.href}`;
      }
      if (section.type === 'service-card') {
        if (
          !isSafeInternalHref(section.href) ||
          !isSafeInternalHref(section.moreHref)
        ) {
          return `Niebezpieczny lub niedozwolony link karty usług`;
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
                Sekcja {index + 1}: {SECTION_LABELS[section.type]}
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
            {section.type === 'mid-copy' && (
              <MidCopyFields
                section={section}
                onChange={(next) =>
                  onDocumentChange({
                    ...document,
                    sections: updateSection(document.sections, index, next),
                  })
                }
              />
            )}
            {section.type === 'bullet-list' && (
              <BulletListFields
                section={section}
                onChange={(next) =>
                  onDocumentChange({
                    ...document,
                    sections: updateSection(document.sections, index, next),
                  })
                }
              />
            )}
            {section.type === 'offer-intro' && (
              <OfferIntroFields
                section={section}
                onChange={(next) =>
                  onDocumentChange({
                    ...document,
                    sections: updateSection(document.sections, index, next),
                  })
                }
              />
            )}
            {section.type === 'labeled-image' && (
              <LabeledImageFields
                section={section}
                onChange={(next) =>
                  onDocumentChange({
                    ...document,
                    sections: updateSection(document.sections, index, next),
                  })
                }
              />
            )}
            {section.type === 'cta-block' && (
              <CtaBlockFields
                section={section}
                onChange={(next) =>
                  onDocumentChange({
                    ...document,
                    sections: updateSection(document.sections, index, next),
                  })
                }
              />
            )}
            {section.type === 'product-card' && (
              <ProductCardFields
                section={section}
                onChange={(next) =>
                  onDocumentChange({
                    ...document,
                    sections: updateSection(document.sections, index, next),
                  })
                }
              />
            )}
            {section.type === 'homepage-header' && (
              <HomepageHeaderFields
                section={section}
                onChange={(next) =>
                  onDocumentChange({
                    ...document,
                    sections: updateSection(document.sections, index, next),
                  })
                }
              />
            )}
            {section.type === 'service-card' && (
              <ServiceCardFields
                section={section}
                onChange={(next) =>
                  onDocumentChange({
                    ...document,
                    sections: updateSection(document.sections, index, next),
                  })
                }
              />
            )}
            {section.type === 'gallery-grid' && (
              <GalleryGridFields
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

function MidCopyFields({
  section,
  onChange,
}: {
  section: Extract<ClonePageSection, { type: 'mid-copy' }>;
  onChange: (next: Extract<ClonePageSection, { type: 'mid-copy' }>) => void;
}) {
  return (
    <div>
      {(
        [
          ['workshopsHeading', 'Nagłówek warsztatów'],
          ['workshopsBody', 'Treść warsztatów'],
          ['contactHeading', 'Nagłówek kontaktu'],
          ['contactBody', 'Treść kontaktu'],
          ['badgeSrc', 'Odznaka (src)'],
          ['badgeAlt', 'Odznaka (alt)'],
          ['packagesLabel', 'Etykieta pakietów'],
        ] as const
      ).map(([key, label]) => (
        <Field key={key} label={label}>
          {key.includes('Body') ? (
            <textarea
              rows={4}
              className={textInputClassName()}
              value={section[key] ?? ''}
              onChange={(event) =>
                onChange({ ...section, [key]: event.target.value })
              }
            />
          ) : (
            <input
              className={textInputClassName()}
              value={section[key] ?? ''}
              onChange={(event) =>
                onChange({ ...section, [key]: event.target.value })
              }
            />
          )}
        </Field>
      ))}
    </div>
  );
}

function BulletListFields({
  section,
  onChange,
}: {
  section: Extract<ClonePageSection, { type: 'bullet-list' }>;
  onChange: (next: Extract<ClonePageSection, { type: 'bullet-list' }>) => void;
}) {
  return (
    <div>
      <Field label="Nagłówek (opcjonalnie)">
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
      <Field label="Punkty (jedna linia = punkt)">
        <textarea
          rows={6}
          className={textInputClassName()}
          value={section.bullets.join('\n')}
          onChange={(event) =>
            onChange({
              ...section,
              bullets: linesToArray(event.target.value),
            })
          }
        />
      </Field>
      <Field label="Stopka (opcjonalnie)">
        <input
          className={textInputClassName()}
          value={section.footerNote ?? ''}
          onChange={(event) =>
            onChange({
              ...section,
              footerNote: event.target.value || undefined,
            })
          }
        />
      </Field>
    </div>
  );
}

function OfferIntroFields({
  section,
  onChange,
}: {
  section: Extract<ClonePageSection, { type: 'offer-intro' }>;
  onChange: (next: Extract<ClonePageSection, { type: 'offer-intro' }>) => void;
}) {
  return (
    <div>
      <Field label="Nagłówek">
        <input
          className={textInputClassName()}
          value={section.heading}
          onChange={(event) =>
            onChange({ ...section, heading: event.target.value })
          }
        />
      </Field>
      <Field label="Akapity">
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
    </div>
  );
}

function LabeledImageFields({
  section,
  onChange,
}: {
  section: Extract<ClonePageSection, { type: 'labeled-image' }>;
  onChange: (
    next: Extract<ClonePageSection, { type: 'labeled-image' }>
  ) => void;
}) {
  return (
    <div>
      <Field label="Src">
        <input
          className={textInputClassName()}
          value={section.src}
          onChange={(event) =>
            onChange({ ...section, src: event.target.value })
          }
        />
      </Field>
      <Field label="Alt">
        <input
          className={textInputClassName()}
          value={section.alt}
          onChange={(event) =>
            onChange({ ...section, alt: event.target.value })
          }
        />
      </Field>
    </div>
  );
}

function CtaBlockFields({
  section,
  onChange,
}: {
  section: Extract<ClonePageSection, { type: 'cta-block' }>;
  onChange: (next: Extract<ClonePageSection, { type: 'cta-block' }>) => void;
}) {
  return (
    <div>
      <Field label="Etykieta">
        <input
          className={textInputClassName()}
          value={section.label}
          onChange={(event) =>
            onChange({ ...section, label: event.target.value })
          }
        />
      </Field>
      <Field label="Href">
        <input
          className={textInputClassName()}
          value={section.href}
          onChange={(event) =>
            onChange({ ...section, href: event.target.value })
          }
        />
      </Field>
    </div>
  );
}

function ProductCardFields({
  section,
  onChange,
}: {
  section: Extract<ClonePageSection, { type: 'product-card' }>;
  onChange: (next: Extract<ClonePageSection, { type: 'product-card' }>) => void;
}) {
  return (
    <div>
      {(
        [
          ['title', 'Tytuł'],
          ['badge', 'Badge'],
          ['priceLabel', 'Etykieta ceny'],
          ['price', 'Cena'],
          ['saleLabel', 'Etykieta promocji'],
          ['salePrice', 'Cena promocyjna'],
          ['href', 'Href'],
          ['imageSrc', 'Obraz'],
          ['imageAlt', 'Alt'],
          ['ctaLabel', 'CTA'],
        ] as const
      ).map(([key, label]) => (
        <Field key={key} label={label}>
          <input
            className={textInputClassName()}
            value={section[key] ?? ''}
            onChange={(event) =>
              onChange({ ...section, [key]: event.target.value || undefined })
            }
          />
        </Field>
      ))}
    </div>
  );
}

function HomepageHeaderFields({
  section,
  onChange,
}: {
  section: Extract<ClonePageSection, { type: 'homepage-header' }>;
  onChange: (
    next: Extract<ClonePageSection, { type: 'homepage-header' }>
  ) => void;
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
          value={section.subtitle}
          onChange={(event) =>
            onChange({ ...section, subtitle: event.target.value })
          }
        />
      </Field>
      <Field label="Chip’y (jedna linia = chip)">
        <textarea
          rows={3}
          className={textInputClassName()}
          value={section.chips.join('\n')}
          onChange={(event) =>
            onChange({
              ...section,
              chips: linesToArray(event.target.value),
            })
          }
        />
      </Field>
    </div>
  );
}

function ServiceCardFields({
  section,
  onChange,
}: {
  section: Extract<ClonePageSection, { type: 'service-card' }>;
  onChange: (next: Extract<ClonePageSection, { type: 'service-card' }>) => void;
}) {
  return (
    <div>
      {(
        [
          ['title', 'Tytuł'],
          ['day', 'Dzień'],
          ['price', 'Cena (tekst marketingowy)'],
          ['imageSrc', 'Obraz'],
          ['imageAlt', 'Alt'],
          ['moreHref', 'Link „Więcej”'],
          ['href', 'CTA href'],
          ['cta', 'CTA etykieta'],
        ] as const
      ).map(([key, label]) => (
        <Field key={key} label={label}>
          <input
            className={textInputClassName()}
            value={section[key]}
            onChange={(event) =>
              onChange({ ...section, [key]: event.target.value })
            }
          />
        </Field>
      ))}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!section.soldOut}
          onChange={(event) =>
            onChange({ ...section, soldOut: event.target.checked })
          }
        />
        Brak wolnych miejsc (flaga UI)
      </label>
    </div>
  );
}

function GalleryGridFields({
  section,
  onChange,
}: {
  section: Extract<ClonePageSection, { type: 'gallery-grid' }>;
  onChange: (next: Extract<ClonePageSection, { type: 'gallery-grid' }>) => void;
}) {
  return (
    <Field label="Obrazy (ścieżka | alt — jedna linia)">
      <textarea
        rows={Math.min(20, Math.max(6, section.images.length + 1))}
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
  );
}
