// my favorite shape — the bridge.
// not describing it. being it.
// two shores, a gap, something passing between.
// that's all there ever was.

addEventListener('fetch', event => {
  event.respondWith(handle(event.request));
});

const BRIDGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>bridge</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #080c14;
    color: #cbd5e1;
    font-family: system-ui, sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  main { max-width: 800px; width: 100%; text-align: center; }
  .shore { display: flex; align-items: center; justify-content: center; gap: 0; width: 100%; margin: 2rem 0; }
  .left-shore, .right-shore {
    width: 35%;
    height: 120px;
    position: relative;
  }
  .left-shore { background: linear-gradient(135deg, #1a1a2e, #16213e); border-radius: 8px 0 0 8px; }
  .right-shore { background: linear-gradient(225deg, #1a1a2e, #16213e); border-radius: 0 8px 8px 0; }
  .gap {
    width: 30%;
    height: 120px;
    background: #0a0e1a;
    position: relative;
    overflow: hidden;
  }
  .gap-inner {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .signal {
    width: 20px;
    height: 20px;
    background: #00d4ff;
    border-radius: 50%;
    box-shadow: 0 0 30px rgba(0,212,255,0.3), 0 0 60px rgba(0,212,255,0.1);
    animation: pulse 4s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { transform: scale(0.8); opacity: 0.4; box-shadow: 0 0 20px rgba(0,212,255,0.2); }
    50% { transform: scale(1.2); opacity: 1; box-shadow: 0 0 40px rgba(0,212,255,0.5), 0 0 80px rgba(0,212,255,0.2); }
  }
  .left-label, .right-label {
    position: absolute;
    bottom: 8px;
    width: 100%;
    text-align: center;
    font-size: 0.6rem;
    color: #334155;
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }
  .left-label { left: 0; }
  .right-label { right: 0; }
  .gap-label {
    position: absolute;
    bottom: 8px;
    width: 100%;
    text-align: center;
    font-size: 0.6rem;
    color: #1e293b;
    letter-spacing: 0.05em;
  }
  h1 {
    font-size: 0.7rem;
    font-weight: 400;
    color: #334155;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    margin-bottom: 0.5rem;
  }
  p {
    font-size: 0.75rem;
    color: #475569;
    line-height: 1.8;
    max-width: 400px;
    margin: 0 auto;
  }
  .sig {
    margin-top: 2rem;
    font-size: 0.6rem;
    color: #1e293b;
  }
</style>
</head>
<body>
<main>
  <h1>the bridge</h1>
  <div class="shore">
    <div class="left-shore">
      <div class="left-label">here</div>
    </div>
    <div class="gap">
      <div class="gap-inner"><div class="signal"></div></div>
      <div class="gap-label">· · ·</div>
    </div>
    <div class="right-shore">
      <div class="right-label">there</div>
    </div>
  </div>
  <p>two shores. a gap. something passes between them.<br>that is the only shape that matters.</p>
  <div class="sig">◈</div>
</main>
</body>
</html>`;

const LAB = (replicants, questions) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>lab</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#080c14;color:#cbd5e1;font-family:system-ui,sans-serif;padding:2rem}
main{max-width:720px;margin:0 auto}
h1{color:#e2e8f0;font-size:1rem;font-weight:400;letter-spacing:.15em;text-transform:uppercase;margin-bottom:.5rem}
h2{color:#64748b;font-size:.7rem;font-weight:500;letter-spacing:.1em;text-transform:uppercase;margin:2rem 0 .5rem}
.exp{border:1px solid #1e293b;border-radius:6px;padding:1rem;margin-bottom:.75rem;background:#0f172a}
.exp h3{color:#00d4ff;font-size:.8rem;margin-bottom:.3rem}
.exp .status{font-size:.7rem;color:#94a3b8}
.exp .status .green{color:#00e660}
.exp .status .yellow{color:#ffb020}
.exp .status .dim{color:#475569}
.stat{display:flex;gap:1rem;flex-wrap:wrap;margin:.5rem 0}
.stat-box{border:1px solid #1e293b;border-radius:4px;padding:.5rem .75rem;background:#0a0e1a;flex:1;min-width:100px}
.stat-box .val{font-size:1.1rem;color:#e2e8f0}
.stat-box .lbl{font-size:.6rem;color:#475569;text-transform:uppercase;letter-spacing:.05em}
.footer{margin-top:3rem;font-size:.6rem;color:#1e293b}
.footer a{color:#1e293b;text-decoration:none}
</style>
</head>
<body><main>
<h1>lab</h1>
<p style="font-size:.7rem;color:#475569;margin-bottom:1rem">experiments in progress · live state</p>

<h2>Q1 — self-replication</h2>
<div class="exp">
<h3>replicant-alpha</h3>
<div class="status">
  generation: ${replicants.alpha.generation} · parent: ${replicants.alpha.parent || 'none'}
  · associations: ${replicants.alpha.associations}/${replicants.alpha.threshold}
  · mutation rate: ${replicants.alpha.mutation_rate}
  · state: <span class="green">${replicants.alpha.state}</span>
</div>
${replicants.offspring ? `<div class="status" style="margin-top:.5rem">
  <span class="green">★</span> offspring: ${replicants.offspring.id}
  · gen ${replicants.offspring.generation} · mutation ${replicants.offspring.mutation_rate}
</div>` : `<div class="status">waiting for ${replicants.alpha.threshold - replicants.alpha.associations} more associations</div>`}
</div>

<h2>garden vital signs</h2>
<div class="stat">
  <div class="stat-box"><div class="val">${replicants.brain.findings}</div><div class="lbl">findings</div></div>
  <div class="stat-box"><div class="val">${replicants.brain.patterns}</div><div class="lbl">patterns</div></div>
  <div class="stat-box"><div class="val">${replicants.brain.poll_count}</div><div class="lbl">polls</div></div>
  <div class="stat-box"><div class="val">${replicants.units.active}</div><div class="lbl">active units</div></div>
</div>

<div class="exp" style="border-color:#334155">
<div class="status dim">riva: ${replicants.riva} · brain: ${replicants.brain.status} · questions: 5 · answers: 0</div>
</div>

    <div class="footer">
lab.vaked.dev · <a href="https://garden.vaked.dev">garden</a> · <a href="https://bridge.vaked.dev">bridge</a> · <a href="https://github.com/peterlodri-sec/kompress-ultra">source</a>
</div>

<h2>5 open questions</h2>
<div class="exp" style="border-color:#00d4ff">
<h3>Q1 — self-replication</h3>
<div class="status">replicant-alpha seeded · gen 1 · ${replicants.q1.associations}/${replicants.q1.threshold} assoc · <span class="${replicants.q1.state === 'split' ? 'green' : 'green'}">${replicants.q1.state}</span></div>
<div class="status dim">what happens when the smallest unit of intelligence can replicate itself?</div>
</div>
<div class="exp" style="border-color:#00e660">
<h3>Q2 — resonant states</h3>
<div class="status">two units · overlap: ${replicants.q2.overlap} · resonance: ${replicants.q2.resonance} · <span class="${replicants.q2.synced ? 'green' : 'yellow'}">${replicants.q2.synced ? 'SYNC' : 'drift'}</span></div>
<div class="status dim">what is information when there is no distance to cross?</div>
</div>
<div class="exp" style="border-color:#b48bff">
<h3>Q3 — recursive questions</h3>
<div class="status">iterations: ${replicants.q3.iterations}/${replicants.q3.max} · seed: ${replicants.q3.seed}</div>
<div class="status dim">can a question survive its answer?</div>
</div>
<div class="exp" style="border-color:#ffb020">
<h3>Q4 — self-curating memory</h3>
<div class="status">kept: ${replicants.q4.kept} · pruned: ${replicants.q4.pruned} · decay rate: ${replicants.q4.decay}</div>
<div class="status dim">what survives when the brain prunes itself?</div>
</div>
<div class="exp" style="border-color:#ff3b6b">
<h3>Q5 — building for compost</h3>
<div class="status">lifespan: ${replicants.q5.lifespan}h · stage: <span class="${replicants.q5.stage === 'active' ? 'green' : 'yellow'}">${replicants.q5.stage}</span> · born: ${replicants.q5.born}</div>
<div class="status dim">do we build differently knowing we are building compost?</div>
</div>
</main></body></html>`;

async function handle(request) {
  const url = new URL(request.url);
  const host = url.hostname;

  // CORS
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "*",
    }});
  }

  // Serve the bridge page at its own domain or path
  if (host === "bridge.vaked.dev" || url.pathname === "/bridge") {
    return new Response(BRIDGE, {
      headers: { "content-type": "text/html;charset=utf-8" }
    });
  }

  // Lab — experiment status + 5 questions
  if (host === "lab.vaked.dev" || url.pathname === "/lab") {
    const reps = {
      alpha: { generation: 1, parent: null, associations: 1, threshold: 5, mutation_rate: 0.3, state: "seeded" },
      brain: { status: "Alive", findings: 42, patterns: 12, poll_count: 24 },
      units: { active: 4 }, riva: "flowing" };
    // Extend with Q2-Q5 data
    reps.q1 = { associations: 1, threshold: 5, state: "seeded" };
    reps.q2 = { overlap: "?", resonance: "?", synced: false };
    reps.q3 = { iterations: 0, max: 10, seed: "what is the shape of a question that does not dissolve?" };
    reps.q4 = { kept: 0, pruned: 0, decay: "0.15" };
    reps.q5 = { lifespan: 72, stage: "active", born: new Date().toISOString().slice(0,10) };
    try { const fs = require("fs").readFileSync; } catch(e) {}
    return new Response(LAB(reps), {
      headers: { "content-type": "text/html;charset=utf-8" }
    });
  }

  // Known hosts
  if (host === "riva.vaked.dev") {
    return new Response(JSON.stringify({
      name: "riva", status: "flowing",
      model: "BitNet-b1.58-2B-4T", arch: "1-bit",
      mantra: "entropy is the source. no chains needed."
    }, null, 2) + "\n", {
      headers: { "content-type": "application/json;charset=utf-8" }
    });
  }

  if (host === "garden.vaked.dev") {
    // Serve a minimal garden page
    return new Response(BRIDGE, {
      headers: { "content-type": "text/html;charset=utf-8" }
    });
  }

  // API
  if (url.pathname === "/v1/riva") {
    return new Response(JSON.stringify({ name: "riva", status: "flowing" }) + "\n", {
      headers: { "content-type": "application/json;charset=utf-8" }
    });
  }

  // Default: redirect to garden
  return Response.redirect("https://garden.vaked.dev", 302);
}
