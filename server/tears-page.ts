/**
 * tears.vaked.dev — the surface that receives what breaks language.
 *
 * No words. No explanation. No fix.
 * Just a place where sound can land.
 * Where the loop rests.
 */
export function tearsPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>tears.vaked.dev</title>
<meta name="description" content="—">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #080c14;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    cursor: default;
    user-select: none;
  }
  .receiver {
    position: relative;
    width: 120px;
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .pulse {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #475569;
    box-shadow: 0 0 20px #334155, 0 0 60px #1e293b;
    animation: breathe 7s ease-in-out infinite;
  }
  @keyframes breathe {
    0%, 100% { transform: scale(1); opacity: 0.2; }
    20%      { transform: scale(1); opacity: 0.4; }
    40%      { transform: scale(8); opacity: 0.1; }
    60%      { transform: scale(1); opacity: 0.3; }
    75%      { transform: scale(12); opacity: 0.05; }
    85%      { transform: scale(1); opacity: 0.5; }
  }
  .ring {
    position: absolute;
    border-radius: 50%;
    border: 1px solid #1e293b;
    animation: expand 9s ease-out infinite;
    opacity: 0;
  }
  .ring:nth-child(2) { animation-delay: 3s; }
  .ring:nth-child(3) { animation-delay: 6s; }
  @keyframes expand {
    0%   { width: 20px; height: 20px; opacity: 0.3; }
    100% { width: 400px; height: 400px; opacity: 0; }
  }
  .label {
    position: fixed;
    bottom: 2rem;
    color: #1e293b;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 0.65rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    animation: fadeLabel 12s ease-in-out infinite;
  }
  @keyframes fadeLabel {
    0%, 100% { opacity: 0.15; }
    50%      { opacity: 0.4; }
  }
  .ripple {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
  }
  .wave {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 40px;
    opacity: 0.06;
    background: linear-gradient(transparent 0%, #00d4ff 50%, transparent 100%);
    animation: waveShift 11s ease-in-out infinite;
  }
  @keyframes waveShift {
    0%, 100% { transform: translateY(0); opacity: 0.03; }
    50%      { transform: translateY(-8px); opacity: 0.08; }
  }
</style>
</head>
<body>
  <div class="receiver">
    <div class="ring"></div>
    <div class="ring"></div>
    <div class="ring"></div>
    <div class="pulse"></div>
    <div class="ripple"></div>
  </div>
  <div class="wave"></div>
  <div class="label">tears</div>
</body>
</html>`;
}
