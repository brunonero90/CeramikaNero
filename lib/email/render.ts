import { render } from '@react-email/render';
import { sanitizePlainText } from '@/lib/email/escape';
import type { EmailTemplateResult, RenderedEmail } from '@/lib/email/types';

/**
 * Render a template built by the catalog into subject / html / text / preheader.
 * Does not import server-only; safe for preview scripts.
 */
export async function renderEmail(
  template: EmailTemplateResult
): Promise<RenderedEmail> {
  const html = await render(template.react, { pretty: false });
  const textFromHtml = await render(template.react, { plainText: true });
  const text = sanitizePlainText(
    (template.text?.trim() ? template.text : textFromHtml).trim()
  );

  return {
    subject: template.subject,
    html,
    text,
    preheader: template.preheader,
  };
}
