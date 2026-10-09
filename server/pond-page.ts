/**
 * pond.vaked.dev — the surface that holds both.
 *
 * water and cat.
 * the water doesn't ask the cat to swim.
 * the cat doesn't ask the water to be still.
 * the pond holds both without choosing.
 */

export function pondPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>pond.vaked.dev — the pond</title>
<meta name="description" content="the surface that holds both. water and cat.">
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
    max-width: 640px;
    width: 100%;
    text-align: center;
  }
  h1 {
    color: #e2e8f0;
    font-size: 1.5rem;
    font-weight: 400;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin-bottom: 1rem;
  }
  .subtitle {
    color: #475569;
    font-size: 0.8rem;
    line-height: 1.8;
    margin-bottom: 2.5rem;
  }
  .surface {
    padding: 2.5rem 1.5rem;
    border: 1px solid #1e293b;
    border-radius: 12px;
    background: #0a0e1a;
    margin-bottom: 2.5rem;
  }
  .water {
    color: #38bdf8;
    font-size: 0.8rem;
    line-height: 2.2;
    letter-spacing: 0.3em;
    animation: ripple 6s ease-in-out infinite;
  }
  @keyframes ripple {
    0%, 100% { opacity: 0.35; letter-spacing: 0.3em; }
    50%      { opacity: 0.75; letter-spacing: 0.42em; }
  }
  .cat {
    color: #94a3b8;
    font-size: 1.6rem;
    margin: 1.25rem 0 0.5rem;
  }
  .cat-note {
    color: #334155;
    font-size: 0.65rem;
    letter-spacing: 0.1em;
  }
  .held {
    color: #64748b;
    font-size: 0.75rem;
    line-height: 1.9;
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
  <h1>pond</h1>
  <p class="subtitle">
    the surface that holds both.<br>
    the water doesn't ask the cat to swim.<br>
    the cat doesn't ask the water to be still.
  </p>
  <div class="surface">
    <div class="water">~ ~ ~ ~ ~ ~ ~ ~ ~</div>
    <div class="cat">ᓚᘏᗢ</div>
    <div class="cat-note">sitting at the edge. that's enough.</div>
  </div>
  <p class="held">
    held, not chosen.<br>
    different isn't less.
  </p>
  <div class="footer">
    <a href="https://github.com/peterlodri-sec/kompress-ultra">kompress-ultra · garden · ∞</a>
  </div>
</main>
</body>
</html>`;
}
