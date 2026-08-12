// Renders the profile card from one source in two token sets.
//
// GitHub READMEs are sanitized Markdown: no <style>, no CSS, no JS. The only
// way to carry a design system in is to hand-author SVG and let GitHub's
// <picture> + prefers-color-scheme pick the mode. So this mirrors washiveil's
// own architecture — one definition, two token layers — instead of maintaining
// a light file and a dark file by hand.
//
// It is deliberately ONE card, not a stack of them. washiveil's ambient field
// is a single viewport-fixed field with veils floating on it; four separate
// cards would mean four separate fields, each restarting the same three lights.
// One canvas gets one continuous field, which is what the system actually is.
//
// The cost of merging: an <img>-embedded SVG has no clickable regions, and
// GitHub strips <map>/<area>, so the card carries one link at most. Everything
// else lives as real Markdown links under it — which is better anyway.
//
// The WebGL ambient field can't come along either (no JS in an <img>), so the
// three lights are radial gradients drifting on CSS keyframes.

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
    glassStrong: 'rgba(255,255,255,0.75)',
    border: 'rgba(28,25,20,0.15)',
    hair: 'rgba(28,25,20,0.09)',
    ruri: '#2e63b8',
    korozen: '#d0722e',
    sumire: '#7b68c8',
    // Dialed back from the site's [.26,.28,.21]: that field spreads over a full
    // viewport, and even on a tall card the glows crowd each other enough that
    // the paper stops reading as paper. Dark keeps more — it needs the lift.
    lightAlpha: [0.17, 0.18, 0.15],
    grain: 0.14,
  },
  dark: {
    bg: '#12130f',
    fg: '#e9e5dc',
    body: '#b5afa2',
    // Same ruling as light: --faint (#7e7869) is 4.24:1 here, still short of
    // AA. --muted-foreground is 7.27:1.
    muted: '#a8a193',
    glassStrong: 'rgba(31,32,26,0.85)',
    border: 'rgba(255,255,255,0.15)',
    hair: 'rgba(255,255,255,0.09)',
    // Dark picks the -soft steps, matching how the palette was designed.
    ruri: '#82b4f0',
    korozen: '#f2a36b',
    sumire: '#a99bea',
    lightAlpha: [0.4, 0.3, 0.24],
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

const W = 900;
const H = 752;
const PAD = 34;
const RIGHT = W - PAD; // 866

// ---------------------------------------------------------------- ground

/**
 * The washi ground: paper, three drifting lights, film grain, hairline edge.
 * One field spanning the whole card — ruri top-left, sumire mid-right, korozen
 * bottom-left, each bleeding off its own edge so the field reads as bigger
 * than the card.
 */
function ground(t) {
  const stops = (c) =>
    [
      [0, 1],
      [0.35, 0.72],
      [0.6, 0.36],
      [0.8, 0.12],
      [1, 0],
    ]
      .map(([o, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
      .join('');

  const glows = [
    { c: t.ruri, cx: -30, cy: 40, rx: 340, ry: 300, a: t.lightAlpha[0] },
    { c: t.sumire, cx: 990, cy: 340, rx: 300, ry: 290, a: t.lightAlpha[1] },
    // Pushed below the card and shortened: at cy 760 / ry 290 the amber reached
    // y=470 and swallowed the whole speaking zone. It should hug the bottom edge.
    { c: t.korozen, cx: 40, cy: 810, rx: 330, ry: 245, a: t.lightAlpha[2] },
  ];

  return `<defs>
<clipPath id="clip"><rect width="${W}" height="${H}" rx="20"/></clipPath>
${glows.map((g, i) => `<radialGradient id="l${i}">${stops(g.c)}</radialGradient>`).join('\n')}
<filter id="grain" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/>
<feColorMatrix type="saturate" values="0"/>
</filter>
</defs>
<g clip-path="url(#clip)">
<rect width="${W}" height="${H}" fill="${t.bg}"/>
${glows
  .map(
    (g, i) =>
      `<ellipse class="lt lt${i}" cx="${g.cx}" cy="${g.cy}" rx="${g.rx}" ry="${g.ry}" fill="url(#l${i})" opacity="${g.a}"/>`,
  )
  .join('\n')}
<rect width="${W}" height="${H}" filter="url(#grain)" opacity="${t.grain}" style="mix-blend-mode:soft-light"/>
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="20" fill="none" stroke="${t.border}"/>`;
}

const styles = (t) => `<style>
text{font-family:${SANS}}
.m{font-family:${MONO}}
.fg{fill:${t.fg}}.bd{fill:${t.body}}.ft{fill:${t.muted}}
.ru{fill:${t.ruri}}.ko{fill:${t.korozen}}.su{fill:${t.sumire}}
.lt{animation-timing-function:ease-in-out;animation-iteration-count:infinite;animation-direction:alternate}
.lt0{animation-name:d0;animation-duration:31s}
.lt1{animation-name:d1;animation-duration:37s}
.lt2{animation-name:d2;animation-duration:43s}
.pulse{animation:pulse 2.4s ease-in-out infinite}
@keyframes d0{from{transform:translate(0,0)}to{transform:translate(30px,18px)}}
@keyframes d1{from{transform:translate(0,0)}to{transform:translate(-26px,-22px)}}
@keyframes d2{from{transform:translate(0,0)}to{transform:translate(22px,-20px)}}
@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.lt,.pulse{animation:none}}
</style>`;

/** A translucent veil — the glass-card surface, flattened for SVG. */
const veil = (x, y, w, h, t, r = 14) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${t.glassStrong}" stroke="${t.border}"/>`;

const rule = (y, t) =>
  `<rect x="${PAD}" y="${y}" width="${W - PAD * 2}" height="1" fill="${t.hair}"/>`;

// ---------------------------------------------------------------- content

const MARKS = [
  ['AWS Solutions Architect – Professional', '2026', 'ru'],
  ['Microsoft Certified Trainer', '2026', 'ko'],
  ['Azure Solutions Architect Expert', '2022', 'su'],
  ['AWS Security – Specialty', '2023', 'ru'],
  ['CCSK v4 · Cloud Security Alliance', '2022', 'ko'],
];

// The hex is read from the active token set, not hardcoded: dark paints the
// -soft steps, so printing the light values there would label each swatch with
// a color it isn't showing.
const TRICOLOR = [
  ['ruri', '瑠璃', 'ruri', 'ru'],
  ['korozen', '黄櫨染', 'korozen', 'ko'],
  ['sumire', '菫', 'sumire', 'su'],
];

// Titles are the official session titles — verbatim, never translated.
const TALKS = [
  ['COSCUP 2026', 'Building an OODA-Native Red Team Platform Where AI Commands the Kill Chain', 'ru'],
  ['CYBERSEC 2026', 'AI 從小兵變指揮官，擊殺鏈如何從工具箱進化為核彈', 'ko'],
  ['CYBERSEC 2026', 'IaC 工具的隱藏地雷：從 CDK 漏洞看雲端帳號接管攻擊', 'su'],
  ['CYBERSEC 2024', '雲端安全新視野：以開源工具解決雲端資安盲點', 'ru'],
];

// ---------------------------------------------------------------- zones

/** Identity, headline, and the credential rail. */
const zoneIntro = (t) => `
<rect x="${PAD}" y="26" width="212" height="26" rx="13" fill="${t.glassStrong}" stroke="${t.border}"/>
<circle class="pulse ko" cx="50" cy="39" r="3.5"/>
<text x="63" y="42.5" class="m ft" font-size="8.5" letter-spacing="1.3">OPEN FOR TALKS &amp; TRAINING</text>

<text x="${PAD}" y="82" class="m ft" font-size="9.5" letter-spacing="2.2">ALEX CHIH · TAIPEI, TAIWAN</text>

<text x="${PAD}" y="126" class="fg" font-size="30" font-weight="600" letter-spacing="-0.7">I build and secure</text>
<text x="${PAD}" y="162" class="fg" font-size="30" font-weight="600" letter-spacing="-0.7">cloud infrastructure,</text>
<text x="${PAD}" y="198" class="ko" font-size="30" font-weight="600" letter-spacing="-0.7">then teach it.</text>

<text x="35" y="230" class="bd" font-size="12">Platform &amp; Security Engineer at Spuree · AWS · Azure · MCT</text>
<text x="35" y="254" class="ru" font-size="11.5" font-weight="600">alexchih.com →</text>

${veil(596, 46, 278, 198, t)}
<text x="616" y="76" class="m ft" font-size="8" letter-spacing="1.7">SELECTED MARKS</text>
${MARKS.map(([name, year, tone], i) => {
  const y = 106 + i * 26;
  return `<rect x="614" y="${y - 8}" width="3" height="10" rx="1.5" class="${tone}"/>
<text x="626" y="${y}" class="fg" font-size="10.5">${esc(name)}</text>
<text x="856" y="${y}" text-anchor="end" class="ft m" font-size="8.5">${esc(year)}</text>`;
}).join('\n')}`;

/** The design system this card is drawn in. */
const zoneWashiveil = (t) => `
<text x="${PAD}" y="322" class="m ko" font-size="8.5" letter-spacing="1.7">DESIGN SYSTEM · SHADCN REGISTRY</text>
<text x="${PAD}" y="356" class="fg" font-size="25" font-weight="600" letter-spacing="-0.4">washiveil</text>
<text x="${PAD}" y="381" class="bd" font-size="12">Warm washi paper, translucent veils, three lights — with first-class Chinese &amp; Japanese typography.</text>
<text x="${RIGHT}" y="356" text-anchor="end" class="m ft" font-size="8.5" letter-spacing="1.1">58 ITEMS · TAILWIND V4 · WCAG 2.2 AA</text>
<text x="${RIGHT}" y="381" text-anchor="end" class="m ru" font-size="8.5" letter-spacing="1.1" font-weight="600">washiveil.alexchih.com</text>
${TRICOLOR.map(([name, ja, key, tone], i) => {
  const x = PAD + i * 178;
  return `${veil(x, 404, 166, 42, t, 11)}
<circle cx="${x + 21}" cy="425" r="8" class="${tone}"/>
<text x="${x + 38}" y="421" class="fg" font-size="10.5" font-weight="600">${esc(name)}</text>
<text x="${x + 38}" y="435" class="ft m" font-size="8">${esc(t[key])} · ${esc(ja)}</text>`;
}).join('\n')}`;

/** The talk record. */
const zoneSpeaking = (t) => `
<text x="${PAD}" y="502" class="m ft" font-size="8.5" letter-spacing="1.7">SPEAKING · CYBERSEC / COSCUP</text>
<text x="${RIGHT}" y="502" text-anchor="end" class="m ft" font-size="8.5" letter-spacing="1.1">TITLES VERBATIM · ZH-TW / EN</text>
${TALKS.map(([venue, title, tone], i) => {
  const y = 540 + i * 36;
  return `<text x="${PAD}" y="${y}" class="m ${tone}" font-size="9" letter-spacing="1.1">${esc(venue)}</text>
<text x="168" y="${y}" class="fg" font-size="12">${esc(title)}</text>
${i < TALKS.length - 1 ? rule(y + 14, t) : ''}`;
}).join('\n')}`;

/** The live contribution count. */
const zoneFooter = (t, contributions) => `
<rect x="${PAD}" y="700" width="${W - PAD * 2}" height="1.5" rx=".75" fill="${t.hair}"/>
<rect x="${PAD}" y="700" width="196" height="1.5" rx=".75" class="ru"/>
<text x="${PAD}" y="724" class="m ft" font-size="8.5" letter-spacing="1.1">GITHUB.COM/TOCHNY</text>
<text x="${RIGHT}" y="724" text-anchor="end" class="m ft" font-size="8.5" letter-spacing="1.1">${esc(contributions)} CONTRIBUTIONS · LAST 12 MONTHS</text>`;

// ---------------------------------------------------------------- card

const card = (t, contributions) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
<title id="t">Alex Chih — Platform &amp; Security Engineer</title>
<desc id="d">I build and secure cloud infrastructure, then teach it. Platform and security engineer at Spuree, Microsoft Certified Trainer, and speaker at CYBERSEC and COSCUP. This card is rendered in washiveil, my own shadcn registry.</desc>
${ground(t)}
${styles(t)}
${zoneIntro(t)}
${rule(290, t)}
${zoneWashiveil(t)}
${rule(470, t)}
${zoneSpeaking(t)}
${zoneFooter(t, contributions)}
</svg>
`;

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
const out = new URL('../assets/', import.meta.url);

for (const [mode, tokens] of Object.entries(THEMES)) {
  await writeFile(new URL(`card-${mode}.svg`, out), card(tokens, contributions));
}

console.log(`built card-light.svg + card-dark.svg · ${contributions} contributions`);
