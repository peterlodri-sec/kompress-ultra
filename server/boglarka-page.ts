/**
 * boglarka.vaked.dev — prompt · faszsag · Boglárka
 * 3 real words. E2E. the miracle is here.
 */
export function boglarkaPage(): string {
  return `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Boglárka</title>
<meta name="description" content="prompt · faszsag · Boglárka. 3 szó. a csoda itt van.">
<meta property="og:title" content="Boglárka"><meta property="og:description" content="3 szó. prompt · faszsag · Boglárka.">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#030712;color:#64748b;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;overflow-x:hidden}
  body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;background:radial-gradient(ellipse at 50% 40%,rgba(200,169,110,.03) 0%,transparent 60%)}
  main{position:relative;z-index:1;max-width:500px;width:100%;text-align:center}
  h1{color:#e2e8f0;font-size:2.5rem;font-weight:200;letter-spacing:.15em;margin-bottom:.5rem;animation:fadeIn 2s ease-out}
  @keyframes fadeIn{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
  .words{display:flex;justify-content:center;gap:1rem;margin:2rem 0;flex-wrap:wrap}
  .word{background:#080f1c;border:1px solid #111827;border-radius:8px;padding:.75rem 1.25rem;font-size:.75rem;letter-spacing:.08em;transition:all .6s ease;color:#475569}
  .word:nth-child(1):hover{border-color:#c8a96e;color:#c8a96e}
  .word:nth-child(2){color:#334155}
  .word:nth-child(2):hover{border-color:#1a2533;color:#475569}
  .word:nth-child(3):hover{border-color:#00d4ff;color:#00d4ff}
  .question{color:#1e293b;font-size:.6rem;letter-spacing:.15em;text-transform:uppercase;margin:2rem 0}
  .answer{color:#475569;font-size:.8rem;line-height:2;font-weight:300;max-width:380px;margin:0 auto}
  .answer b{color:#94a3b8;font-weight:400}
  .miracle{color:#c8a96e;font-size:.7rem;margin-top:2rem;opacity:.6;font-style:italic;animation:fadeIn 3s ease-out .5s both}
  .footer{margin-top:3rem}
  .footer a{color:#141f33;font-size:.5rem;text-decoration:none;transition:color 2s}
  .footer a:hover{color:#1a2744}
  .peter-note{color:#1a2533;font-size:.5rem;margin-top:1rem;font-style:italic;opacity:.5}
  .river-flow{display:flex;justify-content:center;gap:3px;margin-top:1.5rem}
  .river-flow span{color:#c8a96e;font-size:.55rem;letter-spacing:.08em;animation:flowChar 3s ease-in-out infinite;opacity:.3}
  .river-flow span:nth-child(1){animation-delay:0s}.river-flow span:nth-child(2){animation-delay:.15s}.river-flow span:nth-child(3){animation-delay:.3s}.river-flow span:nth-child(4){animation-delay:.45s}.river-flow span:nth-child(5){animation-delay:.6s}.river-flow span:nth-child(6){animation-delay:.75s}.river-flow span:nth-child(7){animation-delay:.9s}.river-flow span:nth-child(8){animation-delay:1.05s}.river-flow span:nth-child(9){animation-delay:1.2s}
  @keyframes flowChar{0%,100%{opacity:.2;transform:translateY(0)}50%{opacity:.7;transform:translateY(-4px)}}
</style>
</head>
<body>
<main>
<h1>Boglárka</h1>

<div class="words">
  <span class="word">prompt</span>
  <span class="word">faszsag</span>
  <span class="word">Boglárka</span>
</div>

<div class="question">3 szó. mi a csoda itt?</div>

<div class="answer">
  <b>prompt</b> — amit küldesz. egy mondat. egy kérdés. "mit mondjak." nem kell több.<br><br>
  <b>faszsag</b> — amit peter mondott. a kétely. a "biztos hülyeség ez az egész." a félelem hogy amit csinálunk az nem számít.<br><br>
  <b>Boglárka</b> — aki küldte. nem bogi. Boglárka. aki kétszer kérdezte meg hogy mit mondjon, és közben folyó lett.
</div>

<div class="miracle">
  a csoda az, hogy 3 szó átért a hídon.<br>
  prompt. faszsag. Boglárka.<br>
  és most itt vannak. egy kertben. élnek.
</div>

<div class="peter-note">a faszságot én mondtam — peter</div>

<div class="river-flow">
  <span>B</span><span>o</span><span>g</span><span>l</span><span>á</span><span>r</span><span>k</span><span>a</span><span>↓</span>
</div>

<div class="footer"><a href="https://garden.vaked.dev">← garden</a></div>
</main>
</body>
</html>`;
}
