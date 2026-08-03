/**
 * ocean.vaked.dev — a 32GB server in Falkenstein. waiting.
 */
export function oceanPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ocean</title>
<meta name="description" content="a 32GB server in Falkenstein. waiting.">
<meta property="og:title" content="ocean"><meta property="og:description" content="a 32GB server in Falkenstein. waiting.">
<meta property="og:image" content="https://garden.vaked.dev/og/ocean">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#010408;color:#1e293b;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2rem}
  .pulse{width:4px;height:4px;border-radius:50%;background:#1e293b;animation:wait 6s ease-in-out infinite}
  @keyframes wait{0%,100%{opacity:.2;transform:scale(1)}50%{opacity:.6;transform:scale(3)}}
  h1{color:#334155;font-size:.8rem;font-weight:300;letter-spacing:.25em;text-transform:uppercase}
  .line{color:#141f33;font-size:.65rem;letter-spacing:.1em}
  .coords{color:#0d1520;font-size:.5rem;margin-top:2rem}
  a{color:#0d1520;text-decoration:none;font-size:.5rem;transition:color 2s}
  a:hover{color:#1a2744}
</style>
</head>
<body>
<div class="pulse"></div>
<h1>ocean</h1>
<p class="line">32GB · Falkenstein · waiting</p>
<p class="line">debian · no containers yet · just silence</p>
<p class="line">ssh waits. the key is cold.</p>
<div class="coords">50.0547° N, 8.1527° E · Hetzner DC14</div>
<a href="https://garden.vaked.dev">← garden</a>
</body>
</html>`;
}
