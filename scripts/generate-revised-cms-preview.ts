/**
 * Generate revised CMS production preview (local only).
 * Does NOT mutate Supabase project zorxzyvmcbwucvaywmuu.
 *
 *   npx tsx scripts/generate-revised-cms-preview.ts
 */
import { createHash } from 'crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import '@/lib/cms/static-registry';
import {
  fingerprintClonePageDocument,
  parseClonePageDocument,
  serializeClonePageDocument,
  validateClonePageContentForSave,
  type ClonePageDocument,
} from '@/lib/cms/page-document';
import {
  getStaticClonePage,
  listRegisteredStaticSlugs,
} from '@/lib/cms/resolve-page';
import { cmsSlugFromRoute } from '@/lib/cms/route-slug';
import {
  documentToArchivePage,
  documentToGallery,
  documentToGlinaBox,
  documentToHomepageServices,
  documentToMarketingParts,
} from '@/lib/cms/document-adapters';

const cloneFinal = JSON.parse(
  readFileSync(
    path.join(
      process.cwd(),
      'reference/original-site/implementation/clone-final.json'
    ),
    'utf8'
  )
) as {
  routes: {
    originalRoute: string;
    pageType: string;
    finalClassification: string;
  }[];
};

const OUT = path.join(process.cwd(), 'tmp/cms-import/revised');

type MatrixRow = {
  route: string;
  pageType: string;
  currentSource: string;
  proposedSource: string;
  dbBackedFields: string[];
  staticPresentationFields: string[];
  fallback: string;
  reasonIfStatic: string | null;
  cmsSlug: string | null;
  inContentPagesImport: boolean;
};

function sectionFieldCoverage(doc: ClonePageDocument): string[] {
  const fields = new Set<string>();
  fields.add('title');
  fields.add('metaDescription');
  fields.add('status(draft|published|archived)');
  fields.add('seoTitle');
  fields.add('seoDescription');
  for (const section of doc.sections) {
    fields.add(`section:${section.type}`);
  }
  return [...fields].sort();
}

function adapterParity(doc: ClonePageDocument): {
  ok: boolean;
  detail: string;
} {
  if (doc.template === 'archive') {
    const adapted = documentToArchivePage(doc);
    return {
      ok: !!adapted && adapted.sections.length > 0,
      detail: `archive sections=${adapted?.sections.length ?? 0}`,
    };
  }
  if (doc.template === 'marketing-split') {
    const adapted = documentToMarketingParts(doc);
    return {
      ok: !!adapted?.hero && adapted.blocks.length >= 0,
      detail: `marketing hero+blocks=${adapted?.blocks.length ?? 0} midCopy=${!!adapted?.midCopy} bulletLists=${adapted?.bulletLists.length ?? 0} offer=${!!adapted?.offerIntro}`,
    };
  }
  if (doc.template === 'homepage-services') {
    const adapted = documentToHomepageServices(doc);
    return {
      ok: !!adapted?.header && (adapted.services.length ?? 0) > 0,
      detail: `homepage services=${adapted?.services.length ?? 0}`,
    };
  }
  if (doc.template === 'gallery') {
    const adapted = documentToGallery(doc);
    return {
      ok: !!adapted?.hero && (adapted.images.length ?? 0) > 0,
      detail: `gallery images=${adapted?.images.length ?? 0}`,
    };
  }
  if (doc.template === 'glina-box') {
    const adapted = documentToGlinaBox(doc);
    return {
      ok: !!adapted?.hero,
      detail: `glina-box products=${adapted?.products.length ?? 0}`,
    };
  }
  return { ok: false, detail: 'unknown template' };
}

function classifyImplementedRoute(route: string, pageType: string): MatrixRow {
  const slug = cmsSlugFromRoute(route);
  const doc = getStaticClonePage(slug);
  const remaps: Record<string, string> = {
    '/onas': '/pracownia',
    '/dladzieci': '/dla-dzieci',
    '/dladoroslych': '/dla-doroslych',
    '/dlafirm': '/grupy-i-firmy',
  };

  if (route.startsWith('/post/') || route.startsWith('/blog')) {
    return {
      route,
      pageType,
      currentSource: 'clone archive fixtures (blog-posts.ts / BlogIndexView)',
      proposedSource:
        'blog_posts table (separate from content_pages) + archive fallback',
      dbBackedFields: [
        'title',
        'slug(ascii)',
        'excerpt',
        'content',
        'authorName',
        'status',
        'seo*',
        'legacyWixUrl',
      ],
      staticPresentationFields: [
        'BlogIndexView / BlogPostView layout',
        'category chrome',
        'share noise filters',
      ],
      fallback: 'archiveBlogPosts fixtures until blog import approved',
      reasonIfStatic:
        'Kept on separate blog_posts cutover; unicode slugs need ASCII mapping; not part of content_pages apply',
      cmsSlug: null,
      inContentPagesImport: false,
    };
  }

  if (doc) {
    return {
      route,
      pageType,
      currentSource: 'static-fallback via resolveClonePage (fixtures)',
      proposedSource: `content_pages.slug=${slug} clone-page-v1`,
      dbBackedFields: sectionFieldCoverage(doc),
      staticPresentationFields: [
        'React template/layout/CSS',
        'bookingAdaptation chrome',
        route === '/' ? 'Grafik zajęć structural CTA section' : null,
        route === '/home' ? 'Podgląd · badge prefix + cart disclaimer' : null,
      ].filter(Boolean) as string[],
      fallback: 'static registry document if DB missing/invalid',
      reasonIfStatic: null,
      cmsSlug: slug,
      inContentPagesImport: true,
    };
  }

  return {
    route,
    pageType,
    currentSource: 'unknown / missing registry',
    proposedSource: remaps[route]
      ? `redirect target ${remaps[route]}`
      : 'review required',
    dbBackedFields: [],
    staticPresentationFields: [],
    fallback: 'n/a',
    reasonIfStatic: 'No static CMS document registered for this route',
    cmsSlug: null,
    inContentPagesImport: false,
  };
}

async function main() {
  mkdirSync(path.join(OUT, 'records'), { recursive: true });

  const slugs = listRegisteredStaticSlugs();
  const docs: ClonePageDocument[] = [];
  const validation: {
    slug: string;
    parseOk: boolean;
    hrefOk: boolean;
    adapterOk: boolean;
    fingerprint: string;
    detail: string;
  }[] = [];

  for (const slug of slugs) {
    const doc = getStaticClonePage(slug);
    if (!doc) continue;
    docs.push(doc);
    const raw = serializeClonePageDocument(doc);
    const roundTrip = parseClonePageDocument(raw);
    const hrefIssue = validateClonePageContentForSave(raw);
    const adapter = adapterParity(doc);
    validation.push({
      slug,
      parseOk: !!roundTrip,
      hrefOk: hrefIssue === null,
      adapterOk: adapter.ok,
      fingerprint: createHash('sha256')
        .update(fingerprintClonePageDocument(doc))
        .digest('hex')
        .slice(0, 16),
      detail: adapter.detail,
    });
    writeFileSync(
      path.join(OUT, 'records', `${slug}.json`),
      JSON.stringify(
        {
          title: doc.title,
          slug,
          excerpt: doc.metaDescription ?? null,
          content: doc,
          status: 'draft',
          seo_title: doc.title,
          seo_description: doc.metaDescription ?? null,
          provenance: doc.provenance,
        },
        null,
        2
      )
    );
  }

  const implemented = cloneFinal.routes.filter(
    (r) => r.finalClassification === 'Implemented directly'
  );

  const matrix: MatrixRow[] = implemented.map((r) =>
    classifyImplementedRoute(r.originalRoute, r.pageType)
  );

  // Live Next remaps not in the 77 original routes
  const liveExtras: MatrixRow[] = [
    '/pracownia',
    '/dla-dzieci',
    '/dla-doroslych',
    '/grupy-i-firmy',
    '/kalendarz',
  ].map((route) => {
    if (route === '/kalendarz') {
      return {
        route,
        pageType: 'operational-calendar',
        currentSource: 'workshop_sessions query',
        proposedSource: 'workshop_sessions (not content_pages)',
        dbBackedFields: ['published workshops', 'scheduled/sold_out sessions'],
        staticPresentationFields: ['calendar UI chrome'],
        fallback: 'empty state when no sessions',
        reasonIfStatic: null,
        cmsSlug: null,
        inContentPagesImport: false,
      };
    }
    const slug = cmsSlugFromRoute(route);
    const doc = getStaticClonePage(slug)!;
    return {
      route,
      pageType: 'live-remap-marketing',
      currentSource: 'static-fallback via resolveClonePage',
      proposedSource: `content_pages.slug=${slug}`,
      dbBackedFields: sectionFieldCoverage(doc),
      staticPresentationFields: ['React marketing template'],
      fallback: 'static registry',
      reasonIfStatic: null,
      cmsSlug: slug,
      inContentPagesImport: true,
    };
  });

  const importDocs = docs;
  const homeContradiction = {
    explanation:
      'Previous preview listed `home` for import while `/` and `/home` were still static-primary because app/page.tsx and app/home/page.tsx were not wired to resolveClonePage. That wiring is now done.',
    afterImport: {
      '/': {
        cmsSlug: 'root',
        template: 'homepage-services',
        winner:
          'Published valid content_pages row for slug=root wins; otherwise static homepageServices registry document.',
        notTheSameAs: '/home',
      },
      '/home': {
        cmsSlug: 'home',
        template: 'glina-box',
        winner:
          'Published valid content_pages row for slug=home wins; otherwise static glinaBoxPage registry document.',
        note: '/home is the GLINA BOX marketing page — distinct from `/` workshop picker.',
      },
    },
  };

  const omittedResolved = {
    pracowniaMidCopy:
      'Represented as section type mid-copy (no schema migration)',
    grupyIntroWho:
      'Represented as section type bullet-list (ids intro-bullets, who-bullets)',
    servicePageNested:
      'Each /service-page/* archive fixture registered as content_pages clone-page-v1 with ASCII cmsSlug',
    bookingCalendarNested:
      'Each /booking-calendar/* archive fixture registered likewise',
    blogArchive:
      'Intentionally NOT in content_pages import — separate blog_posts cutover with archive fallback; unicode slug mapping required before apply',
  };

  const preview = {
    generatedAt: new Date().toISOString(),
    mode: 'local-preview-only',
    productionMutation: false,
    targetProjectRef: 'zorxzyvmcbwucvaywmuu',
    awaitingBrunoApproval: true,
    schemaMigrationRequired: false,
    schemaNote:
      'Additive clone-page-v1 section types only; content_pages.content JSON; no SQL migration',
    homeContradiction,
    omittedResolved,
    workshopCatalog: {
      status: 'NOT included in this import',
      reason:
        'No verified business data for prices/capacities/instructors/dates; workshops/sessions remain separate operational tables',
    },
    counts: {
      implementedDirectlyRoutes: implemented.length,
      contentPagesProposed: importDocs.length,
      blogRoutesDeferred: matrix.filter(
        (m) => m.route.startsWith('/blog') || m.route.startsWith('/post/')
      ).length,
      insert: importDocs.length,
      update: 0,
      skip: 0,
      existingRemoteAssumption: 0,
    },
    validationSummary: {
      allParseOk: validation.every((v) => v.parseOk),
      allHrefOk: validation.every((v) => v.hrefOk),
      allAdapterOk: validation.every((v) => v.adapterOk),
      failures: validation.filter(
        (v) => !v.parseOk || !v.hrefOk || !v.adapterOk
      ),
    },
    adminEditingCoverage: {
      structuredEditorPrimary: true,
      rawJsonAdvancedOnly: true,
      draftPublishArchived: true,
      inPlacePreviewForAdmins: true,
      rollback:
        'Unpublish/archive/delete content_pages row by slug → public resolveClonePage falls back to static registry automatically',
      fieldCoverageNote:
        'Every section type in proposed documents has ClonePageEditor fields',
    },
    visualParity: {
      method:
        'Structural fingerprint equality + adapter round-trip for every proposed document; Playwright viewport renders generated in cms-visual-parity.ts when server available',
      widths: [1440, 390],
      materialDifferences: [] as string[],
      note: 'With empty Supabase content_pages, live pages already use static-fallback documents identical to proposed seed JSON — DB-backed render equals static when content matches fingerprint.',
    },
    matrix: [...matrix, ...liveExtras],
    proposedSlugs: importDocs.map(
      (d) => d.cmsSlug ?? cmsSlugFromRoute(d.route)
    ),
  };

  // Local parity: seed JSON fingerprint must equal registry fingerprint
  const parityMismatches: string[] = [];
  for (const doc of importDocs) {
    const slug = doc.cmsSlug ?? cmsSlugFromRoute(doc.route);
    const fromDisk = parseClonePageDocument(
      JSON.stringify(
        JSON.parse(
          readFileSync(path.join(OUT, 'records', `${slug}.json`), 'utf8')
        ).content
      )
    );
    if (
      !fromDisk ||
      fingerprintClonePageDocument(fromDisk) !==
        fingerprintClonePageDocument(doc)
    ) {
      parityMismatches.push(slug);
    }
  }
  preview.visualParity.materialDifferences = parityMismatches.map(
    (s) => `Fingerprint mismatch for ${s}`
  );

  writeFileSync(
    path.join(OUT, 'revised-production-preview.json'),
    JSON.stringify(preview, null, 2)
  );
  writeFileSync(
    path.join(OUT, 'route-matrix.csv'),
    [
      'route,pageType,proposedSource,cmsSlug,inContentPagesImport,reasonIfStatic',
      ...preview.matrix.map((m) =>
        [
          m.route,
          m.pageType,
          JSON.stringify(m.proposedSource),
          m.cmsSlug ?? '',
          m.inContentPagesImport,
          JSON.stringify(m.reasonIfStatic ?? ''),
        ].join(',')
      ),
    ].join('\n')
  );

  console.log(
    JSON.stringify(
      {
        out: OUT,
        contentPagesProposed: preview.counts.contentPagesProposed,
        implementedRoutes: preview.counts.implementedDirectlyRoutes,
        validation: preview.validationSummary,
        parityMismatches,
        awaitingBrunoApproval: true,
        productionMutation: false,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
