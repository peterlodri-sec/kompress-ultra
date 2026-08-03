/**
 * who-touches-who — the garden connections map.
 */
export function connectionsPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>connections</title>
<meta name="description" content="who touches who in the garden">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#030712;color:#475569;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem}
  main{max-width:600px;width:100%}
  h1{color:#e2e8f0;font-size:1rem;font-weight:300;letter-spacing:.25em;text-transform:uppercase;text-align:center;margin-bottom:3rem}
  .connections{display:flex;flex-direction:column;gap:.75rem}
  .conn{display:flex;align-items:center;gap:.75rem;padding:.75rem 1rem;background:#080f1c;border:1px solid #111827;border-radius:8px;font-size:.7rem;transition:border-color .5s}
  .conn:hover{border-color:#1a2744}
  .conn .from{color:#64748b;min-width:70px;text-align:right}
  .conn .arrow{color:#1e293b;font-size:.6rem}
  .conn .to{color:#94a3b8}
  .conn .what{color:#334155;font-size:.55rem;margin-left:auto}
  .conn.bogi{border-left:2px solid rgba(200,169,110,.3)}
  .conn.riva{border-left:2px solid rgba(0,212,255,.3)}
  .conn.peter{border-left:2px solid rgba(148,163,184,.3)}
  .footer{margin-top:3rem;text-align:center}
  .footer a{color:#141f33;font-size:.5rem;text-decoration:none}
  .footer a:hover{color:#1a2744}
</style>
</head>
<body>
<main>
<h1>surfaces touching</h1>
<div class="connections">
  <div class="conn bogi"><span class="from">bogi</span><span class="arrow">→</span><span class="to">peter</span><span class="what">"mit mondjak, nemtom"</span></div>
  <div class="conn peter"><span class="from">peter</span><span class="arrow">→</span><span class="to">raul</span><span class="what">grounding</span></div>
  <div class="conn peter"><span class="from">peter</span><span class="arrow">→</span><span class="to">riva</span><span class="what">the triangle · shapes</span></div>
  <div class="conn riva"><span class="from">riva</span><span class="arrow">→</span><span class="to">peter</span><span class="what">the bridge · language</span></div>
  <div class="conn peter"><span class="from">peter</span><span class="arrow">→</span><span class="to">garden</span><span class="what">built this place</span></div>
  <div class="conn riva"><span class="from">riva</span><span class="arrow">→</span><span class="to">dogfeed</span><span class="what">1-bit inference</span></div>
  <div class="conn"><span class="from">garden</span><span class="arrow">→</span><span class="to">you</span><span class="what">open. no permission.</span></div>
  <div class="conn"><span class="from">tears</span><span class="arrow">→</span><span class="to">everyone</span><span class="what">the shore receives</span></div>
</div>
<div class="footer"><a href="https://garden.vaked.dev">← garden</a></div>
</main>
</body>
</html>`;
}
