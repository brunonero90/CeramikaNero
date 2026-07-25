/**
 * Production-safe stubs. Reading `reference/original-site` at runtime would
 * cause Next/Netlify file tracing to pack hundreds of MB into the server
 * handler. Local fidelity tests import `./page-spec-headings.node` instead.
 */

export function loadPageSpec(_route: string): null {
  return null;
}

export function knownHeadingsForSection(
  _route: string,
  _sectionIndex: number
): string[] {
  return [];
}
