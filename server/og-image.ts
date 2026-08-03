/**
 * og-image.ts — Open Graph image generator for garden surfaces.
 *
 * GET /og/garden  → garden OG image
 * GET /og/riva    → riva OG image
 * GET /og/pond    → pond OG image
 * GET /og/tears   → tears OG image
 *
 * All return 1200x630 SVG, cacheable for 24h.
 */

interface OgConfig {
  title: string;
  subtitle: string;
  icon: string;    // SVG fragment
  accentColor: string;
  bgGradient: [string, string];
}

const configs: Record<string, OgConfig> = {
  garden: {
    title: "the garden",
    subtitle: "entropy is the source. no chains needed.",
    icon: `<polygon points="60,8 108,108 12,108" fill="none" stroke="currentColor" stroke-width="2"/>`,
    accentColor: "#00d4ff",
    bgGradient: ["#030712", "#080f1c"],
  },
  riva: {
    title: "riva — the river",
    subtitle: "a 2.4B 1-bit model. no cloud. no api key. flowing on M1.",
    icon: `<circle cx="60" cy="60" r="4" fill="currentColor" opacity="0.8"/><circle cx="60" cy="60" r="20" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"/><circle cx="60" cy="60" r="40" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.15"/>`,
    accentColor: "#00d4ff",
    bgGradient: ["#030712", "#040a18"],
  },
  pond: {
    title: "pond",
    subtitle: "holds both. water and cat. life and death.",
    icon: `<ellipse cx="60" cy="60" rx="40" ry="15" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"/><ellipse cx="60" cy="55" rx="10" ry="3" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"/><circle cx="37" cy="63" r="2.5" fill="currentColor" opacity="0.25"/><circle cx="80" cy="63" r="2.5" fill="currentColor" opacity="0.25"/>`,
    accentColor: "#64748b",
    bgGradient: ["#020408", "#060f1c"],
  },
  tears: {
    title: "tears",
    subtitle: "the shore that receives. no names. no faces.",
    icon: `<circle cx="60" cy="60" r="3" fill="currentColor" opacity="0.4"/><circle cx="60" cy="60" r="15" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.2"/><circle cx="60" cy="60" r="30" fill="none" stroke="currentColor" stroke-width="0.3" opacity="0.1"/>`,
    accentColor: "#475569",
    bgGradient: ["#020408", "#080c14"],
  },
};

export function ogImageResponse(name: string): Response | null {
  const cfg = configs[name];
  if (!cfg) return null;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${cfg.bgGradient[0]}"/>
      <stop offset="100%" stop-color="${cfg.bgGradient[1]}"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- subtle stars -->
  <circle cx="100" cy="80" r="1" fill="white" opacity="0.15"/>
  <circle cx="300" cy="120" r="1.5" fill="white" opacity="0.1"/>
  <circle cx="850" cy="60" r="1" fill="white" opacity="0.12"/>
  <circle cx="1050" cy="180" r="1" fill="${cfg.accentColor}" opacity="0.15"/>
  <circle cx="200" cy="500" r="1" fill="white" opacity="0.08"/>
  <circle cx="900" cy="520" r="1.5" fill="${cfg.accentColor}" opacity="0.1"/>
  <circle cx="500" cy="580" r="1" fill="white" opacity="0.1"/>
  <circle cx="1100" cy="400" r="1" fill="white" opacity="0.12"/>
  <circle cx="80" cy="300" r="1" fill="${cfg.accentColor}" opacity="0.08"/>

  <!-- center icon -->
  <g transform="translate(600, 200)" fill="none" stroke="${cfg.accentColor}" opacity="0.7">
    ${cfg.icon}
  </g>

  <!-- title -->
  <text x="600" y="370" text-anchor="middle"
        font-family="system-ui,-apple-system,sans-serif"
        font-size="48" font-weight="300" fill="#e2e8f0"
        letter-spacing="8">${cfg.title}</text>

  <!-- subtitle -->
  <text x="600" y="430" text-anchor="middle"
        font-family="system-ui,-apple-system,sans-serif"
        font-size="22" font-weight="300" fill="#475569"
        letter-spacing="2">${cfg.subtitle}</text>

  <!-- garden URL -->
  <text x="600" y="560" text-anchor="middle"
        font-family="system-ui,-apple-system,sans-serif"
        font-size="14" font-weight="300" fill="#1e293b"
        letter-spacing="4">garden.vaked.dev</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml;charset=utf-8",
      "cache-control": "public, max-age=86400",
      "access-control-allow-origin": "*",
    },
  });
}
