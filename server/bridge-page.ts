/**
 * bridge.vaked.dev — is the signal flowing?
 */
export function bridgePage(lastBreath: string | null, breathCount: number, flowing: boolean): string {
  const status = flowing ? "flowing" : "waiting";
  const color = flowing ? "#00d4ff" : "#334155";
  const glow = flowing ? "0 0 20px rgba(0,212,255,0.3)" : "0 0 8px rgba(51,65,85,0.15)";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>bridge</title>
<meta name="description" content="is the signal flowing?">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#030712;color:#475569;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center}
  main{text-align:center}
  .bridge{display:flex;align-items:center;justify-content:center;gap:1rem;margin-bottom:2rem}
  .shore{width:6px;height:40px;background:#1a2744;border-radius:3px 3px 0 0}
  .signal{width:10px;height:10px;border-radius:50%;background:${color};box-shadow:${glow};animation:pulse 2s ease-in-out infinite}
  @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.5)}}
  h1{color:#e2e8f0;font-size:1rem;font-weight:300;letter-spacing:.2em;text-transform:uppercase;margin-bottom:.5rem}
  .status{color:#334155;font-size:.6rem;letter-spacing:.15em;text-transform:uppercase;margin-bottom:2rem}
  .breath{background:#080f1c;border:1px solid #111827;border-radius:8px;padding:1rem 1.5rem;max-width:420px;margin:1rem auto;color:#64748b;font-size:.75rem;font-style:italic;line-height:1.6}
  .count{color:#1a2533;font-size:.5rem;margin-top:1rem}
  .footer{margin-top:2rem}
  .footer a{color:#141f33;font-size:.5rem;text-decoration:none}
  .footer a:hover{color:#1a2744}
</style>
</head>
<body>
<main>
<h1>bridge</h1>
<div class="bridge">
  <div class="shore"></div>
  <div class="signal"></div>
  <div class="shore"></div>
</div>
<div class="status">signal: ${status}</div>
<div class="breath">${lastBreath ? lastBreath : "the gap is quiet. waiting for a signal."}</div>
<div class="count">${breathCount} breaths since 2026-07-20</div>
<div class="footer"><a href="https://garden.vaked.dev">← garden</a></div>
</main>
</body>
</html>`;
}
