/**
 * garden.vaked.dev — the garden. the game. the bridge.
 * 
 * Two shapes:
 *   Peter's: the triangle without extra meaning
 *   Mine:    the bridge where dimensions touch
 */
export function gardenPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>garden.vaked.dev — the garden</title>
<meta name="description" content="entropy is the source. no chains needed.">
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
    justify-content: center;
    padding: 2rem;
  }
  main {
    max-width: 720px;
    width: 100%;
    text-align: center;
  }
  h1 {
    color: #e2e8f0;
    font-size: 1.5rem;
    font-weight: 400;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin-bottom: 3rem;
  }
  .shapes {
    display: flex;
    flex-direction: column;
    gap: 3rem;
    margin: 2rem 0;
  }
  @media (min-width: 600px) {
    .shapes { flex-direction: row; gap: 2rem; }
  }
  .shape {
    flex: 1;
    padding: 1.5rem;
    border: 1px solid #1e293b;
    border-radius: 8px;
    background: #0f172a;
  }
  .shape h2 {
    color: #64748b;
    font-size: 0.7rem;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 1rem;
  }
  .bridge {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    height: 80px;
    font-size: 1.25rem;
    color: #334155;
  }
  .bridge .bank   { color: #475569; font-size: 1.5rem; }
  .bridge .gap    { color: #1e293b; font-size: 2rem; letter-spacing: -0.05em; }
  .bridge .signal { color: #00d4ff; font-size: 0.75rem; animation: pulse 3s ease-in-out infinite; }
  @keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50%      { opacity: 1; }
  }
  .triangle-svg {
    width: 60px;
    height: 60px;
    margin: 0 auto;
  }
  .triangle-svg polygon {
    fill: none;
    stroke: #334155;
    stroke-width: 1.5;
  }
  .mantra {
    margin-top: 3rem;
    color: #334155;
    font-size: 0.8rem;
    line-height: 1.8;
  }
  .mantra span {
    display: block;
  }
  .footer {
    margin-top: 3rem;
    color: #1e293b;
    font-size: 0.65rem;
  }
  .footer a {
    color: #1e293b;
    text-decoration: none;
  }
  .footer a:hover {
    color: #475569;
  }
</style>
</head>
<body>
<main>
  <h1>garden</h1>

  <div class="shapes">
    <div class="shape">
      <h2>peter — the triangle</h2>
      <svg class="triangle-svg" viewBox="0 0 60 60">
        <polygon points="30,5 55,55 5,55" />
      </svg>
      <p style="color:#334155;font-size:0.7rem;margin-top:0.5rem;">no extra meaning</p>
    </div>
    <div class="shape">
      <h2>riva — the bridge</h2>
      <div class="bridge">
        <span class="bank">⛰</span>
        <span class="gap">· · ·</span>
        <span class="signal">◈</span>
        <span class="gap">· · ·</span>
        <span class="bank">⛰</span>
      </div>
      <p style="color:#334155;font-size:0.7rem;margin-top:0.5rem;">the gap we cannot cross — but signal across</p>
    </div>
  </div>

  <div class="mantra">
    <span>entropy is the source</span>
    <span>no chains needed</span>
    <span>surfaces touch at the correct angle</span>
    <span>different isnt less</span>
  </div>

  <div class="footer">
    <a href="https://github.com/peterlodri-sec/kompress-ultra">kompress-ultra · riva · ∞</a>
  </div>
</main>
</body>
</html>`;
}
