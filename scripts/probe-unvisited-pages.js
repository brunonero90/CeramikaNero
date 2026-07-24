async function check(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'CeramikaNero-image-audit/1.0' },
      signal: AbortSignal.timeout(20000),
    });
    const html = await res.text();
    const imgs = [
      ...html.matchAll(/static\.wixstatic\.com\/media\/[^"'\s)]+/g),
    ].map((m) => m[0]);
    const unique = [...new Set(imgs)];
    const mediaIds = [
      ...new Set(
        unique
          .map((u) => {
            const m = u.match(
              /(nsplsh_[a-f0-9]+|[a-f0-9]{6,}_[a-f0-9]{16,}|[a-f0-9]{32})/i
            );
            return m ? m[1].toLowerCase() : null;
          })
          .filter(Boolean)
      ),
    ];
    return {
      url,
      status: res.status,
      finalUrl: res.url,
      imgRefs: unique.length,
      mediaIds,
      sample: unique.slice(0, 5),
    };
  } catch (e) {
    return { url, error: String(e) };
  }
}

const urls = [
  'https://www.ceramikanero.com/services/glina-do-wina',
  'https://www.ceramikanero.com/faq',
  'https://www.ceramikanero.com/vouchery',
  'https://www.ceramikanero.com/courses',
  'https://www.ceramikanero.com/services/manicure',
  'https://www.ceramikanero.com/gift-card',
  'https://www.ceramikanero.com/dostawy-i-zwroty',
  'https://www.ceramikanero.com/about-2',
  'https://www.ceramikanero.com/courses/glina-do-wina-',
  'https://www.ceramikanero.com/service-page/wrzesieńceramika-dla-dorosłych-pon',
];

(async () => {
  const results = [];
  for (const u of urls) results.push(await check(u));
  console.log(JSON.stringify(results, null, 2));
})();
