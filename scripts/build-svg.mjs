// Renders the profile SVGs from one source in two token sets.
//
// GitHub READMEs are sanitized Markdown: no <style>, no CSS, no JS. The only
// way to carry a design system in is to hand-author SVG and let GitHub's
// <picture> + prefers-color-scheme pick the mode. So this mirrors washiveil's
// own architecture — one component definition, two token layers — instead of
// maintaining a light file and a dark file by hand.
//
// Everything below the ground is washiveil: the washi paper ground, the three
// drifting lights (ruri / korozen / sumire), the soft-light film grain, and
// the translucent veils. The WebGL ambient field can't come along (no JS in an
// <img>-embedded SVG), so the lights are radial gradients on CSS keyframes.

import { writeFile } from 'node:fs/promises';

// ---------------------------------------------------------------- tokens

const THEMES = {
  light: {
    bg: '#f7f3ec',
    fg: '#1c1914',
    body: '#4a443c',
    // --muted-foreground, NOT --faint. The small mono labels are real text, and
    // --faint (#9a9184) is 2.81:1 on the washi ground — it fails AA. This is
    // 5.12:1. --faint stays a decoration-only token.
    muted: '#6e6659',
    glass: 'rgba(255,255,255,0.45)',
    glassStrong: 'rgba(255,255,255,0.75)',
    border: 'rgba(28,25,20,0.15)',
    hair: 'rgba(28,25,20,0.09)',
    ruri: '#2e63b8',
    korozen: '#d0722e',
    sumire: '#7b68c8',
    onKorozen: '#ffffff',
    // Dialed back from the site's [.26,.28,.21]: that field spreads over a full
    // viewport, but here three glows crowd a 900x300 card and the paper stops
    // reading as paper. Dark keeps its values — it needs the lift.
    lightAlpha: [0.2, 0.21, 0.17],
    grain: 0.14,
  },
  dark: {
    bg: '#12130f',
    fg: '#e9e5dc',
    body: '#b5afa2',
    // Same ruling as light: --faint (#7e7869) is 4.24:1 here, still short of
    // AA. --muted-foreground is 7.27:1.
    muted: '#a8a193',
    glass: 'rgba(255,255,255,0.07)',
    glassStrong: 'rgba(31,32,26,0.85)',
    border: 'rgba(255,255,255,0.15)',
    hair: 'rgba(255,255,255,0.09)',
    // Dark picks the -soft steps, matching how the palette was designed.
    ruri: '#82b4f0',
    korozen: '#f2a36b',
    sumire: '#a99bea',
    onKorozen: '#112441',
    lightAlpha: [0.4, 0.36, 0.24],
    grain: 0.15,
  },
};

const SANS =
  'Manrope,Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,' +
  '"PingFang TC","Hiragino Sans","Noto Sans TC","Noto Sans JP","Microsoft JhengHei",sans-serif';
const MONO =
  'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace';

const esc = (v) =>
  String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

// ---------------------------------------------------------------- ground

/**
 * The washi ground: paper, three drifting lights, film grain, hairline edge.
 * Light geometry is scaled from the live ambient field — each glow bleeds off
 * its own edge so the field reads as bigger than the card.
 */
function ground(w, h, t, r = 20) {
  const stops = (c) =>
    [
      [0, 1],
      [0.35, 0.72],
      [0.6, 0.36],
      [0.8, 0.12],
      [1, 0],
    ]
      .map(
        ([o, a]) =>
          `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`,
      )
      .join('');

  const glows = [
    { c: t.ruri, cx: -40, cy: -0.1 * h, rx: 330, ry: 0.85 * h, a: t.lightAlpha[0] },
    { c: t.sumire, cx: w + 40, cy: 0.38 * h, rx: 280, ry: 0.78 * h, a: t.lightAlpha[1] },
    { c: t.korozen, cx: 10, cy: 1.12 * h, rx: 300, ry: 0.72 * h, a: t.lightAlpha[2] },
  ];

  return `<defs>
<clipPath id="clip"><rect width="${w}" height="${h}" rx="${r}"/></clipPath>
${glows.map((g, i) => `<radialGradient id="l${i}">${stops(g.c)}</radialGradient>`).join('\n')}
<filter id="grain" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/>
<feColorMatrix type="saturate" values="0"/>
</filter>
</defs>
<g clip-path="url(#clip)">
<rect width="${w}" height="${h}" fill="${t.bg}"/>
${glows
  .map(
    (g, i) =>
      `<ellipse class="lt lt${i}" cx="${g.cx.toFixed(1)}" cy="${g.cy.toFixed(1)}" rx="${g.rx}" ry="${g.ry.toFixed(1)}" fill="url(#l${i})" opacity="${g.a}"/>`,
  )
  .join('\n')}
<rect width="${w}" height="${h}" filter="url(#grain)" opacity="${t.grain}" style="mix-blend-mode:soft-light"/>
</g>
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="${r}" fill="none" stroke="${t.border}"/>`;
}

/** Shared stylesheet: type stacks plus the slow drift of the three lights. */
function styles(t, extra = '') {
  return `<style>
text{font-family:${SANS}}
.m{font-family:${MONO}}
.fg{fill:${t.fg}}.bd{fill:${t.body}}.ft{fill:${t.muted}}
.ru{fill:${t.ruri}}.ko{fill:${t.korozen}}.su{fill:${t.sumire}}
.lt{animation-timing-function:ease-in-out;animation-iteration-count:infinite;animation-direction:alternate}
.lt0{animation-name:d0;animation-duration:31s}
.lt1{animation-name:d1;animation-duration:37s}
.lt2{animation-name:d2;animation-duration:43s}
@keyframes d0{from{transform:translate(0,0)}to{transform:translate(26px,14px)}}
@keyframes d1{from{transform:translate(0,0)}to{transform:translate(-22px,-18px)}}
@keyframes d2{from{transform:translate(0,0)}to{transform:translate(18px,-16px)}}
@media (prefers-reduced-motion:reduce){.lt{animation:none}.pulse{animation:none}}
${extra}</style>`;
}

/** A translucent veil — the glass-card surface, flattened for SVG. */
const veil = (x, y, w, h, t, r = 14, strong = false) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${strong ? t.glassStrong : t.glass}" stroke="${t.border}"/>`;

const svg = (w, h, title, desc, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="t d">
<title id="t">${esc(title)}</title>
<desc id="d">${esc(desc)}</desc>
${inner}
</svg>
`;

// ---------------------------------------------------------------- content

const MARKS = [
  ['AWS Solutions Architect – Professional', '2026', 'ru'],
  ['Microsoft Certified Trainer', '2026', 'ko'],
  ['Azure Solutions Architect Expert', '2022', 'su'],
  ['AWS Security – Specialty', '2023', 'ru'],
  ['CCSK v4 · Cloud Security Alliance', '2022', 'ko'],
];

// Titles are the official session titles — verbatim, never translated.
const TALKS = [
  ['COSCUP 2026', 'Building an OODA-Native Red Team Platform Where AI Commands the Kill Chain', 'ru'],
  ['CYBERSEC 2026', 'AI 從小兵變指揮官，擊殺鏈如何從工具箱進化為核彈', 'ko'],
  ['CYBERSEC 2026', 'IaC 工具的隱藏地雷：從 CDK 漏洞看雲端帳號接管攻擊', 'su'],
  ['CYBERSEC 2024', '雲端安全新視野：以開源工具解決雲端資安盲點', 'ru'],
];

const TRICOLOR = [
  ['ruri', '瑠璃', '#2e63b8', 'ru'],
  ['korozen', '黄櫨染', '#d0722e', 'ko'],
  ['sumire', '菫', '#7b68c8', 'su'],
];

// ---------------------------------------------------------------- assets

function hero(t, { contributions }) {
  const W = 900;
  const H = 300;

  const marks = MARKS.map(([name, year, tone], i) => {
    const y = 106 + i * 26;
    return `<rect x="614" y="${y - 8}" width="3" height="10" rx="1.5" class="${tone}"/>
<text x="626" y="${y}" class="fg" font-size="10.5">${esc(name)}</text>
<text x="856" y="${y}" text-anchor="end" class="ft m" font-size="8.5">${esc(year)}</text>`;
  }).join('\n');

  return svg(
    W,
    H,
    'Alex Chih — Platform & Security Engineer',
    'I build and secure cloud infrastructure, then teach it. Rendered in washiveil, my own design system.',
    `${ground(W, H, t)}
${styles(t, '.pulse{animation:pulse 2.4s ease-in-out infinite;transform-origin:center}@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}')}

<rect x="34" y="26" width="212" height="26" rx="13" fill="${t.glassStrong}" stroke="${t.border}"/>
<circle class="pulse ko" cx="50" cy="39" r="3.5"/>
<text x="63" y="42.5" class="m ft" font-size="8.5" letter-spacing="1.3">OPEN FOR TALKS &amp; TRAINING</text>

<text x="34" y="82" class="m ft" font-size="9.5" letter-spacing="2.2">ALEX CHIH · TAIPEI, TAIWAN</text>

<text x="34" y="126" class="fg" font-size="30" font-weight="600" letter-spacing="-0.7">I build and secure</text>
<text x="34" y="162" class="fg" font-size="30" font-weight="600" letter-spacing="-0.7">cloud infrastructure,</text>
<text x="34" y="198" class="ko" font-size="30" font-weight="600" letter-spacing="-0.7">then teach it.</text>

<text x="35" y="230" class="bd" font-size="12">Platform &amp; Security Engineer at Spuree · AWS · Azure · MCT</text>
<text x="35" y="254" class="ru" font-size="11.5" font-weight="600">alexchih.com →</text>

${veil(596, 46, 278, 198, t)}
<text x="616" y="76" class="m ft" font-size="8" letter-spacing="1.7">SELECTED MARKS</text>
${marks}

<rect x="34" y="274" width="832" height="1.5" rx=".75" fill="${t.hair}"/>
<rect x="34" y="274" width="196" height="1.5" rx=".75" class="ru"/>
<text x="866" y="288" text-anchor="end" class="m ft" font-size="8" letter-spacing="1.1">${esc(contributions)} CONTRIBUTIONS · LAST 12 MONTHS</text>`,
  );
}

function action(t, { label, tone, sub }) {
  const W = 280;
  const H = 54;
  return svg(
    W,
    H,
    label,
    `${label} — ${sub}`,
    `${ground(W, H, t, 13)}
${styles(t)}
<circle cx="25" cy="27" r="4.5" class="${tone}"/>
<text x="42" y="31.5" class="fg" font-size="11.5" font-weight="600" letter-spacing=".3">${esc(label)}</text>
<text x="256" y="32" text-anchor="end" class="ft" font-size="12">↗</text>`,
  );
}

function washiveil(t) {
  const W = 900;
  const H = 208;

  const swatches = TRICOLOR.map(([name, ja, hex, tone], i) => {
    const x = 34 + i * 178;
    return `<rect x="${x}" y="132" width="166" height="42" rx="11" fill="${t.glassStrong}" stroke="${t.border}"/>
<circle cx="${x + 21}" cy="153" r="8" class="${tone}"/>
<text x="${x + 38}" y="149" class="fg" font-size="10.5" font-weight="600">${esc(name)}</text>
<text x="${x + 38}" y="163" class="ft m" font-size="8">${esc(hex)} · ${esc(ja)}</text>`;
  }).join('\n');

  return svg(
    W,
    H,
    'washiveil — a shadcn registry with first-class Chinese & Japanese typography',
    'Warm washi paper, translucent veils, three lights. 58 registry items, Tailwind CSS v4, WCAG 2.2 AA.',
    `${ground(W, H, t)}
${styles(t)}
<text x="34" y="42" class="m ko" font-size="8.5" letter-spacing="1.7">DESIGN SYSTEM · SHADCN REGISTRY</text>
<text x="34" y="78" class="fg" font-size="25" font-weight="600" letter-spacing="-0.4">washiveil</text>
<text x="34" y="104" class="bd" font-size="12">Warm washi paper, translucent veils, three lights — with first-class Chinese &amp; Japanese typography.</text>
${swatches}
<text x="866" y="78" text-anchor="end" class="ft" font-size="13">↗</text>
<text x="866" y="104" text-anchor="end" class="m ft" font-size="8" letter-spacing="1.1">58 ITEMS · TAILWIND V4 · WCAG 2.2 AA</text>
<text x="866" y="160" text-anchor="end" class="m ru" font-size="9" font-weight="600">THIS PROFILE IS RENDERED IN IT</text>`,
  );
}

function speaking(t) {
  const W = 900;
  const H = 232;

  const rows = TALKS.map(([venue, title, tone], i) => {
    const y = 82 + i * 36;
    return `<text x="34" y="${y}" class="m ${tone}" font-size="9" letter-spacing="1.1">${esc(venue)}</text>
<text x="168" y="${y}" class="fg" font-size="12">${esc(title)}</text>
${i < TALKS.length - 1 ? `<rect x="34" y="${y + 14}" width="832" height="1" fill="${t.hair}"/>` : ''}`;
  }).join('\n');

  return svg(
    W,
    H,
    'Speaking — CYBERSEC and COSCUP',
    'Conference talks on cloud security, AI red teaming, and infrastructure-as-code attack surface.',
    `${ground(W, H, t)}
${styles(t)}
<text x="34" y="42" class="m ft" font-size="8.5" letter-spacing="1.7">SPEAKING · CYBERSEC / COSCUP</text>
<text x="866" y="42" text-anchor="end" class="m ft" font-size="8" letter-spacing="1.1">TITLES VERBATIM · ZH-TW / EN</text>
${rows}
<rect x="34" y="204" width="832" height="1" fill="${t.hair}"/>
<text x="34" y="222" class="ru" font-size="10" font-weight="600">Full record · alexchih.com/speaking →</text>`,
  );
}

// ---------------------------------------------------------------- data

async function contributionCount(login) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const fallback = 658;
  if (!token) {
    console.warn('No GITHUB_TOKEN — using fallback contribution count');
    return fallback;
  }
  try {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'tochny-profile-builder',
      },
      body: JSON.stringify({
        query: `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions}}}}`,
        variables: { login },
      }),
    });
    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
    return json.data.user.contributionsCollection.contributionCalendar.totalContributions;
  } catch (error) {
    console.warn(`Contribution lookup failed (${error.message}) — using fallback`);
    return fallback;
  }
}

// ---------------------------------------------------------------- build

const contributions = await contributionCount('tochny');

const ACTIONS = [
  { file: 'action-site', label: 'WEBSITE', tone: 'ru', sub: 'alexchih.com' },
  { file: 'action-linkedin', label: 'LINKEDIN', tone: 'su', sub: 'linkedin.com/in/alexchih' },
  { file: 'action-email', label: 'EMAIL', tone: 'ko', sub: 'hi@alexchih.com' },
];

const assets = [
  ['hero', (t) => hero(t, { contributions })],
  ['washiveil', washiveil],
  ['speaking', speaking],
  ...ACTIONS.map(({ file, ...opts }) => [file, (t) => action(t, opts)]),
];

const out = new URL('../assets/', import.meta.url);
for (const [name, render] of assets) {
  for (const [mode, tokens] of Object.entries(THEMES)) {
    await writeFile(new URL(`${name}-${mode}.svg`, out), render(tokens));
  }
}

console.log(
  `built ${assets.length * 2} svgs (${assets.length} assets × 2 modes) · ${contributions} contributions`,
);
