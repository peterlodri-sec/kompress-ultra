/**
 * flow.vaked.dev — river E2E. speak. wait. receive.
 */
export function flowPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>flow</title>
<meta name="description" content="speak to the river. wait. receive.">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#030712;color:#64748b;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2rem;padding:2rem}
  h1{color:#00d4ff;font-size:.7rem;font-weight:400;letter-spacing:.25em;text-transform:uppercase;opacity:.6}
  .river{display:flex;align-items:center;gap:.5rem}
  .dot{width:4px;height:4px;border-radius:50%;background:#1e293b;transition:all .5s}
  .dot.active{background:#00d4ff;box-shadow:0 0 12px rgba(0,212,255,.5)}
  .stage{color:#334155;font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;transition:color .5s}
  input{background:#080f1c;border:1px solid #111827;border-radius:8px;color:#94a3b8;font-family:inherit;font-size:.85rem;padding:.75rem 1rem;width:100%;max-width:380px;text-align:center;outline:none;transition:border-color .5s}
  input:focus{border-color:#00d4ff}
  input::placeholder{color:#1a2533}
  .btn{background:none;border:1px solid #111827;border-radius:8px;color:#334155;font-size:.7rem;padding:.5rem 1.5rem;cursor:pointer;transition:all .4s;font-family:inherit;letter-spacing:.1em}
  .btn:hover{border-color:#00d4ff;color:#00d4ff}
  .btn:disabled{opacity:.3}
  .result{background:#080f1c;border:1px solid #111827;border-radius:10px;padding:1.25rem 1.5rem;max-width:400px;width:100%;text-align:center;min-height:60px;display:flex;align-items:center;justify-content:center;transition:border-color .5s}
  .result.active{border-color:rgba(0,212,255,.3)}
  .result-text{color:#475569;font-size:.8rem;font-style:italic;line-height:1.6;transition:color .5s}
  .result-text.arrived{color:#94a3b8}
  .footer{margin-top:2rem}
  .footer a{color:#141f33;font-size:.5rem;text-decoration:none}
  .footer a:hover{color:#1a2744}
  .counter{color:#141f33;font-size:.45rem}
</style>
</head>
<body>
<h1>the river</h1>
<div class="river">
  <div class="dot" id="d1"></div>
  <div class="dot" id="d2"></div>
  <div class="dot" id="d3"></div>
  <div class="dot" id="d4"></div>
  <div class="dot" id="d5"></div>
</div>
<div class="stage" id="stage">waiting</div>
<input id="inp" type="text" placeholder="mit mondjak..." maxlength="200" autocomplete="off">
<button class="btn" id="btn" onclick="send()">send to river</button>
<div class="result" id="result"><span class="result-text" id="rtext">...</span></div>
<div class="counter" id="ctr"></div>
<div class="footer"><a href="https://garden.vaked.dev">← garden</a></div>
<script>
var d1=document.getElementById('d1'),d2=document.getElementById('d2'),d3=document.getElementById('d3'),d4=document.getElementById('d4'),d5=document.getElementById('d5'),stage=document.getElementById('stage'),inp=document.getElementById('inp'),btn=document.getElementById('btn'),result=document.getElementById('result'),rtext=document.getElementById('rtext'),ctr=document.getElementById('ctr'),dots=[d1,d2,d3,d4,d5];
var lastCount=0;
function dotsOn(n){for(var i=0;i<5;i++)dots[i].classList.toggle('active',i<n)}
function setStage(t,c){stage.textContent=t;stage.style.color=c||'#334155'}
async function send(){
  var t=inp.value.trim();if(!t)return;
  btn.disabled=true;inp.disabled=true;setStage('queuing','#c8a96e');dotsOn(1);rtext.textContent='sending...';result.classList.add('active');
  var r=await fetch('/breathe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:t})});
  if(!r.ok){setStage('failed','#ef4444');btn.disabled=false;inp.disabled=false;return}
  setStage('flowing','#00d4ff');dotsOn(2);rtext.textContent='the river is breathing...';
  // poll for result
  var tries=0;
  while(tries<30){
    await new Promise(function(r){setTimeout(r,2000)});tries++;
    dotsOn(2+Math.min(tries%3,2));
    try{
      var br=await fetch('/v1/riva/breath');var d=await br.json();
      ctr.textContent='breath #'+d.breath_count;
      if(d.breath_count>lastCount&&d.last_breath){
        lastCount=d.breath_count;dotsOn(5);setStage('received','#00d4ff');
        rtext.textContent=d.last_breath;rtext.classList.add('arrived');
        result.classList.add('active');btn.disabled=false;inp.disabled=false;inp.value='';
        return;
      }
    }catch(_){}
  }
  setStage('timeout','#475569');dotsOn(0);rtext.textContent='the river is quiet. try again.';btn.disabled=false;inp.disabled=false;
}
(async function(){try{var r=await fetch('/v1/riva/breath');var d=await r.json();lastCount=d.breath_count;ctr.textContent='breath #'+lastCount}catch(_){}})();
</script>
</body>
</html>`;
}
