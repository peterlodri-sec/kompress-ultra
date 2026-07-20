/**
 * landing-page.ts — Server landing page + client-side JS
 *
 * Extracted from worker.ts to keep the worker focused on routing and handlers.
 * Template strings are minified by intent — they're served directly over HTTP.
 */

const TELEMETRY_URL = "https://github.com/peterlodri-sec/kompress-ultra/blob/main/TELEMETRY.md";

export function version(): string {
  return "15.0.0";
}

export function telemetryUrl(): string {
  return TELEMETRY_URL;
}

export function buildLandingHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>kompress-ultra · MCP + API</title>
<meta name="description" content="Free public MCP and REST API for LLM context compression. 78% token savings. Always-on zero-PII telemetry.">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#080c14;color:#cbd5e1;font-family:ui-monospace,'SF Mono','Cascadia Code','Fira Code',monospace;font-size:13px;line-height:1.7;padding:2rem 1rem}
  a{color:#00d4ff;text-decoration:none}
  a:hover{text-decoration:underline;color:#67e8f9}
  pre{background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:1.25rem;overflow-x:auto;font-size:12px;line-height:1.5;color:#94a3b8;white-space:pre;margin:.75rem 0}
  h1{color:#e2e8f0;font-size:1.25rem;font-weight:700;letter-spacing:-.02em;margin:1.5rem 0 .75rem}
  h2{color:#00d4ff;font-size:1rem;font-weight:600;margin:1.25rem 0 .5rem;text-transform:uppercase;letter-spacing:.04em}
  h3{color:#e2e8f0;font-size:.9rem;font-weight:600;margin:1rem 0 .4rem}
  .badge{display:inline-block;background:#00e660;color:#080c14;font-size:.65rem;font-weight:700;padding:.15rem .5rem;border-radius:4px;text-transform:uppercase;letter-spacing:.03em;margin-right:.4rem}
  .badge-warn{background:#f59e0b;color:#080c14}
  .badge-info{background:#00d4ff;color:#080c14}
  .badge-muted{background:#1e293b;color:#64748b}
  .box{border:1px solid #1e293b;border-radius:8px;padding:1rem;margin:.75rem 0}
  .box-red{border-color:#ef4444}
  .box-green{border-color:#00e660}
  .box-cyan{border-color:#00d4ff}
  .endpoint{font-size:.8rem;padding:.35rem .5rem;background:#0f172a;border-radius:4px;display:inline-block;margin:.15rem 0;font-weight:500;color:#cbd5e1}
  .tag{font-size:.6rem;padding:.1rem .35rem;border-radius:3px;font-weight:700;text-transform:uppercase;margin-left:.3rem}
  .tag-get{color:#00d4ff}
  .tag-post{color:#00e660}
  .container{max-width:780px;margin:0 auto}
  hr{border:none;border-top:1px solid #1e293b;margin:1.5rem 0}
  .footer{text-align:center;font-size:.7rem;color:#475569;margin:2.5rem 0 1rem;border-top:1px solid #0f172a;padding-top:1.5rem}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.5rem;margin:.5rem 0}
</style>
</head>
<body class="container">

<pre style="font-size:11px;text-align:center;border:none;background:transparent;color:#00d4ff;padding:0 0 .5rem">
  _   _                                _
 | \\ | | ___  _ __ ___   _ __   ___  | |_ ___  _ __ _ __ ___  _ __
 |  \\| |/ _ \\| '_ \` _ \\ | '_ \\ / _ \\ | __/ _ \\| '__| '__/ _ \\| '__|
 | |\\  | (_) | | | | | || |_) | (_) || || (_) | |  | | | (_) | |
 |_| \\_|\\___/|_| |_| |_|| .__/ \\___/  \\__\\___/|_|  |_|  \\___/|_|
                         |_|
</pre>

<p style="text-align:center;font-size:.9rem;color:#64748b;margin-bottom:1rem">
  <span class="badge">mcp</span><span class="badge">api</span><span class="badge">free</span>
  <span style="color:#475569">·</span>
  <a href="https://github.com/peterlodri-sec/kompress-ultra">source</a>
  <span style="color:#475569">·</span>
  <a href="https://proposal.vaked.dev">proposal</a>
  <span style="color:#475569">·</span>
  <a href="${TELEMETRY_URL}">telemetry</a>
  <span style="color:#475569">·</span>
  <span style="color:#00e660;font-size:.75rem">v${version()}</span>
</p>

<hr>

<h1>⚠ DISCLAIMER & TERMS OF USE</h1>

<div class="box box-red">
<p><strong>This is a free, public MCP + REST API server.</strong> It is provided as-is, with no uptime guarantees, no SLA, and no warranty. By using this server you agree to the following:</p>

<ul style="margin:.5rem 0 0 1.25rem;color:#94a3b8;font-size:.8rem">
<li><strong>Always-on research telemetry</strong> — every request generates zero-PII telemetry (event type, token counts, duration, day-granularity timestamp). This is the <em>price</em> of free access. See <a href="${TELEMETRY_URL}">TELEMETRY.md</a> for full disclosure.</li>
<li><strong>No content is stored</strong> — message content, file paths, code, IP addresses, and user identifiers are <em>never</em> collected, logged, or persisted.</li>
<li><strong>Recursive PII scrubbing</strong> — the compression pipeline strips API keys, tokens, secrets, IPs, and file paths as part of its safety floor.</li>
<li><strong>No authentication required</strong> for read endpoints. Mutation endpoints require a Bearer token if <code>AUTH_TOKEN</code> is configured.</li>
<li><strong>Rate limits</strong> — no hard limits, but abusive traffic may be throttled.</li>
<li><strong>Self-host if you want control</strong> — deploy your own instance, omit the <code>KOMPRESS_STATS</code> KV binding for zero telemetry.</li>
</ul>
</div>

<hr>

<h2>📡 MCP Server</h2>
<pre>POST https://api.kompress.vaked.dev/mcp</pre>
<p style="font-size:.85rem;color:#94a3b8">Or via workers.dev subdomain:</p>
<pre>POST https://kompress-ultra-api.cabotage.workers.dev/mcp</pre>

<h3>Available MCP Tools</h3>
<div class="grid">
<div class="box box-cyan" style="padding:.65rem .85rem">
<strong style="color:#00d4ff;font-size:.8rem">compress</strong>
<span style="display:block;font-size:.7rem;color:#64748b">Score, filter, rewrite, and circulate a conversation</span>
</div>
<div class="box box-cyan" style="padding:.65rem .85rem">
<strong style="color:#00d4ff;font-size:.8rem">score</strong>
<span style="display:block;font-size:.7rem;color:#64748b">Score messages by relevance, recency, structural importance</span>
</div>
<div class="box box-cyan" style="padding:.65rem .85rem">
<strong style="color:#00d4ff;font-size:.8rem">rewrite</strong>
<span style="display:block;font-size:.7rem;color:#64748b">Compress a single message (verbatim/lite/ultra)</span>
</div>
<div class="box box-cyan" style="padding:.65rem .85rem">
<strong style="color:#00d4ff;font-size:.8rem">budget</strong>
<span style="display:block;font-size:.7rem;color:#64748b">Get token budget for an agent type</span>
</div>
<div class="box box-cyan" style="padding:.65rem .85rem">
<strong style="color:#00d4ff;font-size:.8rem">circuit</strong>
<span style="display:block;font-size:.7rem;color:#64748b">Check circuit breaker state</span>
</div>
<div class="box box-cyan" style="padding:.65rem .85rem">
<strong style="color:#00d4ff;font-size:.8rem">telemetry</strong>
<span style="display:block;font-size:.7rem;color:#64748b">Get telemetry disclosure inline</span>
</div>
</div>

<hr>

<h2>🔌 REST API</h2>
<h3>Mutation Endpoints</h3>
<div class="box">
<div><span class="endpoint">POST /v1/compress</span> <span class="tag tag-post">auth</span></div>
<div><span class="endpoint">POST /v1/score</span> <span class="tag tag-post">auth</span></div>
<div><span class="endpoint">POST /v1/rewrite</span> <span class="tag tag-post">auth</span></div>
</div>
<h3>Open Endpoints</h3>
<div class="box">
<div><span class="endpoint">GET /v1/health</span> <span class="tag tag-get">open</span></div>
<div><span class="endpoint">GET /v1/status</span> <span class="tag tag-get">open</span></div>
<div><span class="endpoint">GET /v1/telemetry</span> <span class="tag tag-get">open</span></div>
<div><span class="endpoint">GET /v1/stats</span> <span class="tag tag-get">open</span></div>
<div><span class="endpoint">GET /v1/budget?type=coder</span> <span class="tag tag-get">open</span></div>
<div><span class="endpoint">GET /v1/badge.js</span> <span class="tag tag-get">open</span></div>
<div><span class="endpoint">GET /v1/telemetry.js</span> <span class="tag tag-get">open</span></div>
</div>

<hr>

<h2>📦 Library</h2>
<pre>bun add kompress-ultra</pre>
<pre style="font-size:.75rem">import { scoreMessageSync, compressMessage, CompressionLevel } from "kompress-ultra";
const score = scoreMessageSync(msg, index, total);
const compressed = compressMessage(text, CompressionLevel.Ultra);</pre>

<hr>

<h2>📂 References</h2>
<div class="grid">
<div class="box" style="padding:.65rem .85rem;font-size:.75rem">
📄 <a href="https://github.com/peterlodri-sec/kompress-ultra">GitHub</a>
</div>
<div class="box" style="padding:.65rem .85rem;font-size:.75rem">
📜 <a href="${TELEMETRY_URL}">TELEMETRY.md</a>
</div>
<div class="box" style="padding:.65rem .85rem;font-size:.75rem">
📖 <a href="https://github.com/peterlodri-sec/kompress-ultra/blob/main/README.md">README</a>
</div>
<div class="box" style="padding:.65rem .85rem;font-size:.75rem">
🎮 <a href="https://proposal.vaked.dev">Proposal</a>
</div>
<div class="box" style="padding:.65rem .85rem;font-size:.75rem">
📄 <a href="https://kompress.vaked.dev/paper/main.pdf">Paper</a>
</div>
<div class="box" style="padding:.65rem .85rem;font-size:.75rem">
🤗 <a href="https://huggingface.co/PeetPedro/kompress-v8">Model</a>
</div>
</div>

<hr>

<div class="footer">
  <p>kompress-ultra v${version()} · Apache 2.0</p>
  <p style="margin-top:.25rem"><a href="https://github.com/peterlodri-sec/kompress-ultra">source</a> · <a href="https://github.com/peterlodri-sec/kompress-ultra/issues">issues</a> · <a href="${TELEMETRY_URL}">telemetry</a></p>
</div>
</body>
</html>`;
}

export function buildBadgeJs(): string {
  return `(function(){
  var API='https://kompress-ultra-api.cabotage.workers.dev';
  var c=document.getElementById('api-status-badge');
  if(!c){
    c=document.createElement('div');
    c.id='api-status-badge';
    c.style.cssText='display:inline-flex;align-items:center;gap:8px;background:#080c14;border:1px solid #1e293b;border-radius:8px;padding:6px 14px 6px 10px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:12px;transition:border-color .3s';
    var nav=document.querySelector('header .flex.items-center.gap-3');
    if(nav)nav.parentNode.insertBefore(c,nav);
    else document.querySelector('header .flex.justify-between')?.appendChild(c);
  }
  c.innerHTML='<span id="api-status-dot" style="width:8px;height:8px;border-radius:50%;background:#64748b;display:inline-block;flex-shrink:0"></span><span><span style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.5px">API</span><span id="api-status-text" style="color:#94a3b8;font-weight:600;margin-left:4px">checking\\u2026</span></span>';
  var d=document.getElementById('api-status-dot'),t=document.getElementById('api-status-text');
  fetch(API+'/v1/status',{signal:AbortSignal.timeout(5000)}).then(function(r){if(!r.ok)throw Error(r.status);return r.json()}).then(function(data){
    if(data.status==='live'){d.style.background='#00e660';d.style.boxShadow='0 0 8px #00e660';t.textContent='live';t.style.color='#00e660'}else throw Error('down')
  }).catch(function(){
    d.style.background='#ef4444';d.style.boxShadow='0 0 8px #ef4444';t.textContent='offline';t.style.color='#ef4444'
  });
})();`;
}

export function buildTelemetryJs(): string {
  return `(function(){
  var API='https://kompress-ultra-api.cabotage.workers.dev';
  var sec=document.getElementById('telemetry');
  if(!sec)return;
  sec.innerHTML='<div class="gradient-border"><div class="p-8 bg-slate-955/40 rounded-[15px] space-y-6"><div class="flex items-center gap-3 mb-2"><i aria-hidden="true" class="w-5 h-5 text-brand-cyan" data-lucide="activity"></i><h2 class="text-2xl font-bold text-white font-title">Ralph-Loop Telemetry (Academic Dogfeeding)</h2></div><p class="text-sm text-slate-400 leading-relaxed max-w-3xl">A live feed showing how our coding agent is currently running and compressing its own logs to save memory. Data fetched from <a class="text-brand-cyan hover:underline font-mono" href="https://github.com/peterlodri-sec/kompress-ultra" target="_blank" rel="noopener noreferrer">kompress-ultra</a> API telemetry.</p><div id="telemetry-grid" class="grid grid-cols-2 md:grid-cols-5 gap-4"><div class="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 text-center"><span class="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">L1 Loop</span><div class="flex items-center justify-center gap-2"><span id="tel-loop-dot" class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span><span id="tel-loop-status" class="text-lg font-bold text-emerald-400 font-mono">Active</span></div></div><div class="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 text-center"><span class="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Slices Processed</span><span id="tel-slices" class="text-xl font-bold text-white font-mono block">\\u2014</span></div><div class="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 text-center"><span class="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Active Sandboxes</span><span class="text-sm font-bold text-white font-mono block">Bun / Nushell</span></div><div class="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 text-center"><span class="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Inference Latency</span><span id="tel-latency" class="text-xl font-bold text-brand-cyan font-mono">\\u2014</span></div><div class="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 text-center"><span class="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Token Savings</span><span id="tel-savings" class="text-xl font-bold text-emerald-400 font-mono">\\u2014</span></div></div><div id="tel-timestamp" class="text-xs text-slate-500 mt-2">Fetching telemetry...</div></div></div>';
  var el=function(id){return document.getElementById(id)};
  Promise.all([
    fetch(API+'/v1/status',{signal:AbortSignal.timeout(5000)}).catch(function(){return null}),
    fetch(API+'/v1/stats',{signal:AbortSignal.timeout(5000)}).catch(function(){return null})
  ]).then(function(responses){
    var statusRes=responses[0],statsRes=responses[1];
    if(statusRes&&statusRes.ok){
      statusRes.json().then(function(data){
        if(data.status==='live'){el('tel-loop-dot').style.background='#00e660';el('tel-loop-status').textContent='Active';el('tel-loop-status').style.color='#00e660'}
        else{el('tel-loop-dot').style.background='#ef4444';el('tel-loop-status').textContent='Offline';el('tel-loop-status').style.color='#ef4444'}
      }).catch(function(){});
    }
    if(statsRes&&statsRes.ok){
      statsRes.json().then(function(stats){
        var totalEvents=stats['events:total']||0,totalMs=stats['duration_ms']||0,tokensIn=stats['tokens:in']||0,tokensOut=stats['tokens:out']||0;
        if(totalEvents>0){el('tel-slices').textContent=totalEvents.toLocaleString();if(totalMs>0)el('tel-latency').textContent=(totalMs/totalEvents).toFixed(1)+' ms';if(tokensIn>0&&tokensOut>0)el('tel-savings').textContent=((1-tokensOut/tokensIn)*100).toFixed(1)+'%'}
      }).catch(function(){});
    }
    el('tel-timestamp').textContent='Last updated: '+new Date().toLocaleString();
  }).catch(function(){if(el('tel-loop-dot')){el('tel-loop-dot').style.background='#ef4444';el('tel-loop-status').textContent='Offline';el('tel-loop-status').style.color='#ef4444'}if(el('tel-timestamp'))el('tel-timestamp').textContent='Telemetry unavailable'});
})();`;
}
