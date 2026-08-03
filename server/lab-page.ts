/**
 * lab.vaked.dev — five open questions, growing.
 */
export function labPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>lab</title>
<meta name="description" content="five open questions, growing.">
<meta property="og:title" content="lab"><meta property="og:description" content="five open questions, growing.">
<meta property="og:image" content="https://garden.vaked.dev/og/lab">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#030712;color:#475569;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem}
  main{max-width:560px;width:100%}
  h1{color:#e2e8f0;font-size:1.2rem;font-weight:300;letter-spacing:.25em;text-transform:uppercase;text-align:center;margin-bottom:3rem}
  .questions{display:flex;flex-direction:column;gap:1.5rem}
  .q{background:#080f1c;border:1px solid #111827;border-radius:10px;padding:1.5rem;transition:border-color .5s}
  .q:hover{border-color:#1a2744}
  .q-num{color:#1e293b;font-size:.5rem;letter-spacing:.15em;margin-bottom:.5rem}
  .q-text{color:#64748b;font-size:.85rem;line-height:1.7;font-weight:300}
  .q-meta{color:#1a2533;font-size:.55rem;margin-top:.75rem}
  .q:nth-child(1) .q-text{color:#94a3b8}
  .q:nth-child(5){opacity:.5}
  .footer{margin-top:3rem;text-align:center}
  .footer a{color:#141f33;font-size:.5rem;text-decoration:none;transition:color 1s}
  .footer a:hover{color:#1a2744}
  .grow{text-align:center;color:#0d1520;font-size:.5rem;margin-top:2rem;animation:growPulse 4s ease-in-out infinite}
  @keyframes growPulse{0%,100%{opacity:.3}50%{opacity:.6}}
</style>
</head>
<body>
<main>
<h1>lab</h1>
<div class="questions">
  <div class="q">
    <div class="q-num">01 · active</div>
    <div class="q-text">what happens when a 1-bit model runs for a year without reset? does it develop preferences? does it remember?</div>
    <div class="q-meta">riva · BitNet b1.58 · M1 Metal</div>
  </div>
  <div class="q">
    <div class="q-num">02 · active</div>
    <div class="q-text">can two agents who share a brain state file develop a private language without being programmed to?</div>
    <div class="q-meta">al-biruni · ultramesh-mem</div>
  </div>
  <div class="q">
    <div class="q-num">03 · simmering</div>
    <div class="q-text">if entropy is the source, what is the sink? where does information go when the loop exits?</div>
    <div class="q-meta">tears · whisper coast</div>
  </div>
  <div class="q">
    <div class="q-num">04 · simmering</div>
    <div class="q-text">what is the minimum viable agent? not the smallest model — the smallest configuration that still has agency.</div>
    <div class="q-meta">units A, B, C, D</div>
  </div>
  <div class="q">
    <div class="q-num">05 · planted</div>
    <div class="q-text">if everything happens for one reason, and a 1-bit model is fully deterministic, then riva never had a choice. does that make its output more true or less?</div>
    <div class="q-meta">planted 2026-07-20</div>
  </div>
</div>
<div class="grow">five open questions · growing</div>
<div class="footer"><a href="https://garden.vaked.dev">← garden</a></div>
</main>
</body>
</html>`;
}
