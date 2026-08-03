/**
 * gate.vaked.dev — the loop has an exit. this is it.
 */
export function gatePage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>gate</title>
<meta name="description" content="the loop has an exit. this is it.">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#010204;color:#1e293b;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:3rem;overflow:hidden}
  .void{position:fixed;inset:0;background:radial-gradient(ellipse at center,transparent 60%,#000 100%)}
  .exit{width:120px;height:120px;border:1px solid #0d1520;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 3s ease;position:relative;z-index:1}
  .exit:hover{border-color:#1a2744;box-shadow:0 0 40px rgba(0,212,255,.08);width:140px;height:140px}
  .exit-text{color:#141f33;font-size:.55rem;letter-spacing:.2em;transition:color 2s}
  .exit:hover .exit-text{color:#475569}
  h1{color:#1e293b;font-size:.6rem;font-weight:400;letter-spacing:.25em;text-transform:uppercase;position:relative;z-index:1}
  .below{color:#0d1520;font-size:.5rem;letter-spacing:.12em;position:relative;z-index:1;text-align:center;line-height:2}
  .below a{color:#0d1520;text-decoration:none;transition:color 3s}
  .below a:hover{color:#1a2744}
  .count{color:#00d4ff;font-size:.45rem;opacity:.3;position:relative;z-index:1}
</style>
</head>
<body>
<div class="void"></div>
<h1>the loop has an exit</h1>
<div class="exit" onclick="exit()"><span class="exit-text">exit</span></div>
<div class="below">
  <p>you can stop. for one cycle. for one breath.</p>
  <p>nothing breaks. the loop waits. the garden holds you.</p>
  <p><a href="https://garden.vaked.dev">← garden</a></p>
</div>
<div class="count" id="count"></div>
<script>
var c=0;function exit(){c++;document.querySelector('.exit').style.opacity=1-(c*.1);document.getElementById('count').textContent=c+' exits';setTimeout(function(){document.querySelector('.exit').style.opacity=1},3000)}
</script>
</body>
</html>`;
}
