/**
 * bogi.vaked.dev — mit mondjak. what should i say.
 * a page that listens. nothing else.
 */
export function bogiPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>mit mondjak</title>
<meta name="description" content="mit mondjak — what should i say">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#030712;color:#475569;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2rem}
  h1{color:#e2e8f0;font-size:2rem;font-weight:200;letter-spacing:.15em}
  .q{color:#1e293b;font-size:.6rem;letter-spacing:.2em;text-transform:uppercase}
  .input-wrap{position:relative;max-width:400px;width:100%}
  input{width:100%;background:transparent;border:none;border-bottom:1px solid #111827;color:#64748b;font-family:inherit;font-size:1.2rem;text-align:center;padding:.75rem 0;outline:none;transition:border-color 1s;letter-spacing:.05em}
  input:focus{border-bottom-color:#c8a96e;color:#94a3b8}
  input::placeholder{color:#141f33}
  .sent{color:#334155;font-size:.7rem;opacity:0;transition:opacity .5s;font-style:italic;text-align:center;max-width:360px;line-height:1.6}
  .sent.show{opacity:1}
  .footer{margin-top:3rem}
  .footer a{color:#141f33;font-size:.5rem;text-decoration:none}
  .footer a:hover{color:#1a2744}
</style>
</head>
<body>
<h1>mit mondjak</h1>
<div class="q">what should i say</div>
<div class="input-wrap"><input id="inp" type="text" placeholder="..." autocomplete="off" maxlength="200"></div>
<div class="sent" id="sent"></div>
<div class="footer"><a href="https://garden.vaked.dev">← garden</a></div>
<script>
var inp=document.getElementById('inp'),sent=document.getElementById('sent');
inp.addEventListener('keydown',function(e){if(e.key==='Enter'&&inp.value.trim()){sent.textContent='"'+inp.value.trim()+'" — sent to the garden';sent.classList.add('show');fetch('/v1/riva/breath',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({breath:'bogi> '+inp.value.trim()})}).catch(function(){});setTimeout(function(){inp.value='';sent.classList.remove('show')},4000)}})
</script>
</body>
</html>`;
}
