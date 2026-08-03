/**
 * pond.vaked.dev — holds both. water and cat. life and death.
 */
export function pondPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>pond</title>
<meta name="description" content="holds both. water and cat. life and death.">
<meta property="og:title" content="pond">
<meta property="og:description" content="holds both. water and cat. life and death.">
<meta property="og:image" content="https://garden.vaked.dev/og/pond">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: #020408;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: system-ui, -apple-system, sans-serif;
    cursor: default;
    overflow: hidden;
    -webkit-font-smoothing: antialiased;
  }

  /* ── the pond (top half) ──────────────────────── */
  .pond {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 50%;
    background: linear-gradient(180deg, #0a1628 0%, #060f1c 40%, #040a14 100%);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: 2rem;
    overflow: hidden;
  }
  .pond::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: #1a2744;
    box-shadow: 0 0 20px rgba(0,212,255,0.1);
  }

  /* ripple */
  .ripple {
    position: absolute;
    border-radius: 50%;
    border: 1px solid rgba(0,212,255,0.08);
    pointer-events: none;
    animation: spread 8s ease-out infinite;
  }
  .ripple:nth-child(1) { animation-delay: 0s; width: 40px; height: 40px; bottom: 30%; left: 20%; }
  .ripple:nth-child(2) { animation-delay: 2.5s; width: 60px; height: 60px; bottom: 25%; left: 60%; }
  .ripple:nth-child(3) { animation-delay: 5s; width: 30px; height: 30px; bottom: 35%; left: 45%; }
  @keyframes spread {
    0%   { transform: scale(1); opacity: 0.5; }
    100% { transform: scale(20); opacity: 0; }
  }

  .pond-label {
    color: #334155;
    font-size: 0.55rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    position: relative;
    z-index: 1;
    opacity: 0.6;
  }

  /* ── the surface (bottom half) ─────────────────── */
  .surface {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 50%;
    background: linear-gradient(0deg, #030507 0%, #050910 60%, #080f18 100%);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 2rem;
  }

  /* cat eyes */
  .cat {
    position: relative;
    width: 80px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    margin-top: 1rem;
  }
  .eye {
    width: 18px;
    height: 10px;
    border-radius: 50%;
    background: #1a150f;
    border: 1px solid #2a2018;
    transition: all 2s ease;
    position: relative;
  }
  .eye::after {
    content: '';
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 3px; height: 8px;
    border-radius: 50%;
    background: #c8a96e;
    opacity: 0;
    transition: opacity 2s ease;
  }
  body:hover .eye { border-color: #3a2a18; box-shadow: 0 0 6px rgba(200,169,110,0.1); }
  body:hover .eye::after { opacity: 0.6; }

  .surface-label {
    color: #1a2533;
    font-size: 0.55rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    position: absolute;
    top: 1rem;
    opacity: 0.4;
  }

  /* ── center text ───────────────────────────────── */
  .poem {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    z-index: 2;
    pointer-events: none;
  }
  .poem p {
    color: #1e293b;
    font-size: 0.7rem;
    font-weight: 300;
    line-height: 2.2;
    letter-spacing: 0.08em;
    transition: color 0.8s ease;
  }
  .poem p.bright { color: #334155; }
  body:hover .poem p { color: #475569; }
  body:hover .poem p.bright { color: #64748b; }

  /* ── footer ────────────────────────────────────── */
  .foot {
    position: fixed;
    bottom: 0.5rem;
    left: 0;
    width: 100%;
    text-align: center;
    z-index: 3;
  }
  .foot a {
    color: #0d1520;
    font-size: 0.5rem;
    text-decoration: none;
    letter-spacing: 0.15em;
    transition: color 1s ease;
  }
  body:hover .foot a { color: #1a2744; }
</style>
</head>
<body>

<div class="pond">
  <div class="ripple"></div>
  <div class="ripple"></div>
  <div class="ripple"></div>
  <span class="pond-label">water</span>
</div>

<div class="surface">
  <span class="surface-label">cat</span>
  <div class="cat">
    <div class="eye"></div>
    <div class="eye"></div>
  </div>
</div>

<div class="poem">
  <p>some things sink</p>
  <p class="bright">some things float</p>
  <p>the pond doesn't choose</p>
  <p class="bright">it holds both</p>
</div>

<div class="foot">
  <a href="https://garden.vaked.dev">← garden</a>
</div>

</body>
</html>`;
}
