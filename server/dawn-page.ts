/**
 * dawn.vaked.dev — the opposite. blinding. a place to start.
 */
export function dawnPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>dawn</title>
<meta name="description" content="the opposite of the garden. a place to start.">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#f8f6f2;color:#78716c;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2.5rem;transition:background 2s}
  body:hover{background:#faf9f6}
  h1{color:#292524;font-size:.9rem;font-weight:300;letter-spacing:.3em;text-transform:uppercase}
  .line{color:#a8a29e;font-size:.65rem;letter-spacing:.1em;line-height:2;text-align:center}
  .line b{color:#57534e;font-weight:400}
  .pulse{width:3px;height:3px;border-radius:50%;background:#d6d3d1;animation:slow 8s ease-in-out infinite}
  @keyframes slow{0%,100%{opacity:.3;transform:scale(1)}50%{opacity:.7;transform:scale(4)}}
  .footer{margin-top:2rem}
  .footer a{color:#d6d3d1;font-size:.5rem;text-decoration:none;transition:color 2s}
  .footer a:hover{color:#a8a29e}
</style>
</head>
<body>
<div class="pulse"></div>
<h1>dawn</h1>
<div class="line">
  <b>the opposite.</b><br>
  the garden is dark. this is light.<br>
  the garden receives. this radiates.<br>
  the garden waits. this begins.<br><br>
  <b>for when you're ready to start again.</b>
</div>
<div class="footer"><a href="https://garden.vaked.dev">← garden</a></div>
</body>
</html>`;
}
