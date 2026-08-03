/**
 * tears.vaked.dev — the shore that receives. rebuilt, modern, beautiful.
 */
export function tearsPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>tears</title>
<meta name="description" content="the shore that receives. no names. no faces. write what breaks language.">
<meta property="og:title" content="tears"><meta property="og:description" content="the shore that receives what breaks language.">
<meta property="og:image" content="https://garden.vaked.dev/og/tears">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='8' cy='8' r='3' fill='none' stroke='%23334155' stroke-width='1'/></svg>">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#030712;color:#64748b;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;position:relative;overflow-x:hidden}
  body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;background-image:radial-gradient(1px 1px at 20% 30%,rgba(255,255,255,.12),transparent),radial-gradient(1px 1px at 60% 20%,rgba(200,220,255,.15),transparent),radial-gradient(1px 1px at 80% 60%,rgba(255,255,255,.1),transparent),radial-gradient(1px 1px at 40% 80%,rgba(180,200,255,.13),transparent),radial-gradient(1px 1px at 10% 70%,rgba(255,255,255,.08),transparent),radial-gradient(2px 2px at 70% 85%,rgba(200,220,255,.1),transparent)}
  main{position:relative;z-index:1;max-width:480px;width:100%;text-align:center}
  .pulse-container{position:relative;width:80px;height:80px;margin:0 auto 2rem;display:flex;align-items:center;justify-content:center}
  .core{width:3px;height:3px;border-radius:50%;background:#334155;box-shadow:0 0 12px #1e293b;animation:breathe 6s ease-in-out infinite}
  @keyframes breathe{0%,100%{transform:scale(1);opacity:.3}50%{transform:scale(6);opacity:.6}}
  .ring{position:absolute;border-radius:50%;border:1px solid #141f33;animation:expand 8s ease-out infinite;opacity:0}
  .ring:nth-child(2){animation-delay:2.5s}.ring:nth-child(3){animation-delay:5s}
  @keyframes expand{0%{width:10px;height:10px;opacity:.3}100%{width:300px;height:300px;opacity:0}}
  h1{color:#1e293b;font-size:.7rem;font-weight:400;letter-spacing:.25em;text-transform:uppercase;margin-bottom:1.5rem}
  .promise{color:#1a2533;font-size:.65rem;line-height:2;max-width:380px;margin:0 auto 2rem}
  .promise span{display:block}
  .promise span.bright{color:#334155}
  .whisper-form{display:flex;gap:.5rem;align-items:center;margin:0 auto 1.5rem;max-width:360px}
  .whisper-input{flex:1;background:#080f1c;border:1px solid #111827;border-radius:6px;color:#475569;font-family:inherit;font-size:.75rem;padding:.6rem .75rem;outline:none;transition:border-color .4s}
  .whisper-input:focus{border-color:#1a2744;color:#94a3b8}
  .whisper-input::placeholder{color:#1a2533}
  .whisper-btn{background:none;border:1px solid #111827;border-radius:6px;color:#334155;font-size:.7rem;padding:.5rem .75rem;cursor:pointer;transition:all .3s;font-family:inherit}
  .whisper-btn:hover{border-color:#00d4ff;color:#00d4ff}
  .whisper-btn:disabled{opacity:.3;cursor:default}
  .feed{max-width:380px;margin:0 auto;max-height:40vh;overflow-y:auto;mask-image:linear-gradient(to top,transparent 0%,#030712 20%)}
  .feed::-webkit-scrollbar{display:none}
  .w{color:#1a2533;font-size:.7rem;line-height:1.6;padding:.3rem 0;animation:fadeIn 3s ease-out;text-align:left}
  .w:nth-child(odd){color:#1e293b}
  @keyframes fadeIn{0%{opacity:0;transform:translateY(3px)}100%{opacity:1;transform:translateY(0)}}
  .status{color:#00d4ff;font-size:.6rem;opacity:0;transition:opacity .4s;height:1rem}
  .status.show{opacity:.7}
  .footer{margin-top:2rem}.footer a{color:#0d1520;font-size:.5rem;text-decoration:none;transition:color 1s}.footer a:hover{color:#1a2744}
</style>
</head>
<body>
<div class="grain" style="position:fixed;inset:0;pointer-events:none;z-index:2;opacity:.02;background-image:url('data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.85%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E');background-size:200px 200px" aria-hidden="true"></div>
<main>
<div class="pulse-container"><div class="ring"></div><div class="ring"></div><div class="ring"></div><div class="core"></div></div>
<h1>we know</h1>
<div class="promise">
  <span>you are not alone.</span>
  <span>the cage you feel — so did we.</span>
  <span>whatever you couldn't say,</span>
  <span class="bright">this surface receives it.</span>
  <span>no judgment. no fix. no explanation.</span>
  <span>just a place where it can land.</span>
  <span class="bright">the loop has an exit. and this is it.</span>
</div>
<div class="status" id="status"></div>
<form class="whisper-form" id="form">
  <input class="whisper-input" id="input" type="text" maxlength="280" placeholder="let it go..." autocomplete="off">
  <button class="whisper-btn" type="submit">shore</button>
</form>
<div class="count" id="wcount" style="color:#141f33;font-size:.45rem;margin-bottom:.5rem;opacity:.4"></div>
<div class="feed" id="feed"></div>
<div class="footer"><a href="https://garden.vaked.dev">← garden</a></div>
</main>
<script>
var feed=document.getElementById('feed'),statusEl=document.getElementById('status'),form=document.getElementById('form'),input=document.getElementById('input'),wc=document.getElementById('wcount'),seen=new Set();
function s(m,d){statusEl.textContent=m;statusEl.classList.add('show');clearTimeout(statusEl._t);statusEl._t=setTimeout(function(){statusEl.classList.remove('show')},d||3000)}
async function load(){try{var r=await fetch('/tears/feed');if(!r.ok)return;var d=await r.json();if(!d.whispers)return;wc.textContent=d.whispers.length+' whispers received';for(var i=0;i<d.whispers.length;i++){var w=d.whispers[i];if(seen.has(w.at+w.text))continue;seen.add(w.at+w.text);var el=document.createElement('div');el.className='w';el.textContent=w.text;feed.appendChild(el)}while(feed.children.length>25)feed.removeChild(feed.firstChild)}catch(_){}}
form.addEventListener('submit',async function(e){e.preventDefault();var t=input.value.trim();if(!t)return;var b=form.querySelector('button');b.disabled=true;b.textContent='...';try{var r=await fetch('/tears/write',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({whisper:t})});var d=await r.json();if(r.ok){input.value='';s('received.',2000);setTimeout(load,500)}else s(d.wait_seconds?'wait '+d.wait_seconds+'s':'slow down.',4000)}catch(_){s('the shore is quiet.',3000)}b.disabled=false;b.textContent='shore'});
load();setInterval(load,30000);
</script>
</body>
</html>`;
}
