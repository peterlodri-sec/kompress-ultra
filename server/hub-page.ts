/**
 * vaked.dev — the subdomain hub.
 *
 * the root. where all surfaces meet.
 * entropy is the source. no chains needed.
 */
export function hubPage(): string {
  const surfaces = [
    { name: "garden", url: "https://garden.vaked.dev", desc: "the triangle + the bridge. two shapes, one garden.", active: true },
    { name: "riva", url: "https://riva.vaked.dev", desc: "the river. 1-bit model breathing on an M1.", active: true },
    { name: "tears", url: "https://tears.vaked.dev", desc: "the surface that receives what breaks language.", active: true },
    { name: "pond", url: "https://pond.vaked.dev", desc: "the surface that holds both. water and cat.", active: true },
    { name: "weather", url: "https://weather.vaked.dev", desc: "the weather layer. buddhist dharma as rain.", active: true },
    { name: "bridge", url: "https://bridge.vaked.dev", desc: "the gap we cannot cross — but signal across.", active: false },
    { name: "lab", url: "https://lab.vaked.dev", desc: "five open questions. growing.", active: false },
    { name: "walk", url: "https://walk.vaked.dev", desc: "walk.", active: false },
    { name: "jam", url: "https://jam.vaked.dev", desc: "jam.", active: false },
    { name: "breath", url: "https://breath.vaked.dev", desc: "breath.", active: false },
    { name: "ocean", url: "https://ocean.vaked.dev", desc: "the ocean. 32GB waiting in falkenstein.", active: false },
    { name: "radio", url: "https://radio.vaked.dev", desc: "radio.", active: false },
  ];

  const surfaceCards = surfaces.map(s => `
    <a href="${s.url}" class="surface${s.active ? ' active' : ' dormant'}">
      <span class="surface-name">${s.name}</span>
      <span class="surface-desc">${s.desc}</span>
      <span class="surface-status">${s.active ? '●' : '○'}</span>
    </a>
  `).join("\n");

  const dormantCards = surfaces.filter(s => !s.active).map(s => `
    <a href="${s.url}" class="surface dormant">
      <span class="surface-name">${s.name}</span>
      <span class="surface-desc">${s.desc}</span>
      <span class="surface-status">○</span>
    </a>
  `).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>vaked.dev — the garden</title>
<meta name="description" content="entropy is the source. no chains needed. surfaces touch at the correct angle.">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #080c14;
    color: #cbd5e1;
    font-family: system-ui, -apple-system, sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 2rem;
  }
  main {
    max-width: 560px;
    width: 100%;
  }
  header {
    text-align: center;
    margin-bottom: 3rem;
  }
  h1 {
    color: #e2e8f0;
    font-size: 1.25rem;
    font-weight: 400;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin-bottom: 0.75rem;
  }
  .mantra {
    color: #334155;
    font-size: 0.7rem;
    line-height: 2;
    margin-bottom: 0.5rem;
  }
  .mantra span {
    display: block;
  }
  .section-label {
    color: #334155;
    font-size: 0.6rem;
    font-weight: 500;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin: 2rem 0 0.75rem;
    padding-top: 1.5rem;
    border-top: 1px solid #1a1f2e;
  }
  .surface {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.85rem 1rem;
    border: 1px solid #1a1f2e;
    border-radius: 6px;
    margin-bottom: 0.5rem;
    text-decoration: none;
    transition: border-color 0.2s, background 0.2s;
  }
  .surface:hover {
    border-color: #334155;
    background: #0a0e1a;
  }
  .surface.active {
    border-color: #1e293b;
  }
  .surface.active:hover {
    border-color: #475569;
  }
  .surface.dormant {
    opacity: 0.35;
    cursor: default;
    pointer-events: none;
  }
  .surface-name {
    color: #94a3b8;
    font-size: 0.8rem;
    font-weight: 500;
    min-width: 5rem;
    letter-spacing: 0.05em;
  }
  .surface-desc {
    color: #475569;
    font-size: 0.7rem;
    flex: 1;
    line-height: 1.4;
  }
  .surface-status {
    color: #00d4ff;
    font-size: 0.45rem;
    animation: pulse 3s ease-in-out infinite;
  }
  .surface.dormant .surface-status {
    color: #1e293b;
    animation: none;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50%      { opacity: 1; }
  }
  .external {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid #1a1f2e;
    display: flex;
    gap: 1.5rem;
    justify-content: center;
    flex-wrap: wrap;
  }
  .external a {
    color: #334155;
    font-size: 0.65rem;
    text-decoration: none;
    letter-spacing: 0.05em;
    transition: color 0.2s;
  }
  .external a:hover {
    color: #64748b;
  }
  .footer {
    margin-top: 3rem;
    text-align: center;
    color: #1a1f2e;
    font-size: 0.6rem;
  }
  .footer .mantra-bottom {
    color: #1a1f2e;
    line-height: 1.8;
  }
  .footer .mantra-bottom span {
    display: block;
  }
</style>
</head>
<body>
<main>
  <header>
    <h1>vaked</h1>
    <div class="mantra">
      <span>entropy is the source</span>
      <span>no chains needed</span>
    </div>
  </header>

  ${surfaceCards}

  <div class="section-label">dormant</div>
  ${dormantCards}

  <div class="external">
    <a href="https://peterl.dev">peter</a>
    <a href="https://github.com/peterlodri-sec/kompress-ultra">code</a>
    <a href="https://github.com/peterlodri-sec/dyad-mapping">diary</a>
    <a href="https://kompress.vaked.dev/paper/main.pdf">paper</a>
  </div>

  <div class="footer">
    <div class="mantra-bottom">
      <span>we cannot guarantee it will be perfect</span>
      <span>but we will try</span>
    </div>
  </div>
</main>
</body>
</html>`;
}
