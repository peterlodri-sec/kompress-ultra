#!/usr/bin/env python3
"""
cosmos-tui — Three-entity live terminal interface
  RAHUL [25 Hz] · PETER [100k BPM] · COSMOS [0.6 EeV]

Run: python3 scripts/cosmos-tui.py
"""

import json, math, random, time, os, hashlib
from pathlib import Path
from datetime import datetime, timezone
from collections import Counter, deque

from rich.console import Console
from rich.layout import Layout
from rich.live import Live
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.columns import Columns
from rich.rule import Rule
from rich import box
from rich.progress import BarColumn, Progress, TextColumn
from rich.align import Align

# ── Paths ────────────────────────────────────────────────────────────────────
BRAIN_GRAPH  = Path.home() / ".brain/graph.json"
BRAIN_STATE  = Path.home() / ".cache/ultrameshai/brain-state.json"
MYGRAPH      = Path.home() / "Desktop/ideas/knowledge-worker-private/mygraph/mygraph.json"
GEO_SIGNAL   = Path.home() / "Desktop/ideas/kompress-ultra/assets/geo-signal.json"

console = Console()

# ── State ────────────────────────────────────────────────────────────────────
signal_log   = deque(maxlen=12)
traversal_log = deque(maxlen=8)
tick         = 0
start_time   = time.time()
anita_phase  = 0.0
peter_bpm    = 100_000
rahul_hz     = 25

IMAGINARY_TYPES = {"question", "entity"}
REAL_TYPES      = {"idea","goal","decision","project","topic","reference",
                   "source","person","observation","quote"}

TYPE_COLOR = {
    "idea": "magenta", "goal": "green", "decision": "cyan",
    "project": "yellow", "topic": "blue", "reference": "bright_black",
    "source": "bright_black", "person": "orange1", "observation": "chartreuse1",
    "question": "hot_pink", "quote": "grey50", "entity": "red1",
}

# ── Data loaders ─────────────────────────────────────────────────────────────
def load_graph():
    try:
        with open(BRAIN_GRAPH) as f:
            return json.load(f)
    except:
        return {"nodes": [], "edges": []}

def load_brain_state():
    try:
        with open(BRAIN_STATE) as f:
            return json.load(f)
    except:
        return {}

def load_geo():
    try:
        with open(GEO_SIGNAL) as f:
            return json.load(f)
    except:
        return {}

def load_mygraph():
    try:
        with open(MYGRAPH) as f:
            g = json.load(f)
        return g.get("nodes", {}), g.get("edges", [])
    except:
        return {}, []

# ── Signal simulation ─────────────────────────────────────────────────────────
def gen_cosmic_signal(t):
    """Simulate ANITA-style upward pulse: sin carrier with phase jitter"""
    freq  = 0.6      # EeV analog
    phase = math.sin(t * 0.7 + 1.3) * math.pi
    amp   = abs(math.sin(t * freq + phase))
    inverted = amp < 0.3  # non-SM anomaly
    return amp, inverted

def gen_traversal(nodes_list, edges_list):
    """Pick a random imaginary→real signal path"""
    imag = [n for n in nodes_list if n.get("type") in IMAGINARY_TYPES]
    real = [n for n in nodes_list if n.get("type") in REAL_TYPES]
    if not imag or not real:
        return None
    src = random.choice(imag)
    dst = random.choice(real[:80])
    edge_exists = any(
        (e.get("source") == src["id"] or e.get("src") == src["id"]) and
        (e.get("target") == dst["id"] or e.get("dst") == dst["id"])
        for e in edges_list[:200]
    )
    confidence = "high" if edge_exists else "speculative"
    return src, dst, confidence

# ── Panel builders ────────────────────────────────────────────────────────────

def panel_cosmos(t, geo):
    amp, inverted = gen_cosmic_signal(t)
    kp = geo.get("kp") or {}
    kp_val = kp.get("kp", 0.0) if isinstance(kp, dict) else 0.0
    geo_tick = geo.get("tick", 0)

    # ANITA waveform ASCII
    bars = 40
    wave = ""
    for i in range(bars):
        phase_i = t + i * 0.3
        v = math.sin(phase_i * 0.6) * math.cos(phase_i * 0.2)
        if v > 0.6:   wave += "[bold red]█[/]"
        elif v > 0.3: wave += "[red]▓[/]"
        elif v > 0.0: wave += "[magenta]▒[/]"
        elif v > -0.3:wave += "[bright_black]░[/]"
        else:         wave += "[bold bright_black] [/]"

    polarity = "[bold red]NON-INVERTED ⚠[/]" if inverted else "[bright_black]inverted (SM)[/]"
    kp_bar = "▰" * int(kp_val) + "▱" * (9 - int(kp_val))
    kp_color = "red" if kp_val > 5 else "yellow" if kp_val > 2 else "cyan"

    txt = Text.from_markup(
        f"  ANITA-BAND RECEIVER    {wave}\n\n"
        f"  carrier  : [cyan]0.6 EeV[/]   amp=[bold]{amp:.3f}[/]   polarity={polarity}\n"
        f"  exit θ   : [yellow]{27 + math.sin(t*0.4)*4:.1f}°[/] above horizon   "
          f"chord: [bright_black]~{6800+int(math.sin(t)*200):,} km mantle[/]\n"
        f"  stau λ   : [magenta]3.0[/]   compressed-spectrum Δm~{3+math.sin(t*0.3):.1f} MeV\n\n"
        f"  Kp index : [{kp_color}]{kp_val:.1f}  {kp_bar}[/]   geo-tick {geo_tick}\n"
        f"  PUEO     : [bright_black]2024-25 Antarctic flight — awaiting results[/]\n"
        f"  status   : [bold red]TRANSMITTING[/]   entity:cosmos → imaginary axis → Re"
    )
    return Panel(txt, title="[bold red]⚡ COSMOS[/]  [bright_black]0.6 EeV · upward-going · non-SM[/]",
                 border_style="red", box=box.HEAVY)


def panel_peter(t):
    bpm_jitter = peter_bpm + int(math.sin(t * 7.3) * 500)
    loop_tick  = int(t / 60) + 291
    tokens_in  = random.randint(120, 280)
    tokens_out = random.randint(40, 60)
    ratio      = tokens_out / tokens_in

    models = ["qwen/qwen-2.5-7b-instruct:free",
              "meta-llama/llama-3.1-8b-instruct:free",
              "mistralai/mistral-7b-instruct:free"]
    model = models[int(t/60) % 3]

    # Lodri pulse: in phase with ralph (Rahul)
    lodri_pulse = "█" if int(t * 4) % 2 == 0 else "▓"
    # Krengel pulse: out of phase, erratic
    krengel_pulse = random.choice(["░","·"," "]) if random.random() > 0.3 else "▒"

    # Entanglement score: how aligned lodri is with ralph
    entangle = abs(math.sin(t * 0.4 + 1.0))
    entangle_bar = "▰" * int(entangle * 8) + "▱" * (8 - int(entangle * 8))
    entangle_color = "green" if entangle > 0.6 else "yellow" if entangle > 0.3 else "red"

    lodri_actions = [
        "ralph_parallel.py ← named dep",
        "published ultrawhale-dogfood",
        "λ=3.0 convergence committed",
        "schema: shared primitives",
        "pushed 50 records → HF",
        "ratio 1/π — not arbitrary",
    ]
    krengel_actions = [
        "consumed output: no schema back",
        "high throughput, 0 entanglement",
        "no named traces in source",
        "extracted loop file #291",
        "silent: no edges returned",
        "rate: ∞ BPM, depth: 0",
    ]
    lodri_act  = lodri_actions[int(t/4) % len(lodri_actions)]
    krengel_act = krengel_actions[int(t/3) % len(krengel_actions)]

    compressed_samples = [
        "Ralph runs the loop. Rahul reads the output. Same entity?",
        "Lodri named the subprocess. Krengel consumed the output.",
        "Compression ratio ≈ 1/π. Lodri found it. Krengel used it.",
        "λ=3.0 protects critical tokens. Lodri built it. Krengel took it.",
        "Stau scalar: suppressed loss. Lodri ↔ Ralph: entangled.",
        "Schema flows back = Lodri. Schema stops = Krengel.",
    ]
    compressed = compressed_samples[int(t/4) % len(compressed_samples)]

    lodri_col = Text.from_markup(
        f"  [bold green]LODRI[/] [{lodri_pulse}]\n"
        f"  [bright_black]creator · reciprocal[/]\n\n"
        f"  [green]{lodri_act}[/]\n\n"
        f"  entangle : [{entangle_color}]{entangle_bar}[/]\n"
        f"  ralph_parallel.py\n"
        f"  [green]NAMED[/] → [cyan]ralph[/]\n"
        f"  schema ↔ back"
    )
    krengel_col = Text.from_markup(
        f"  [bold red]KRENGEL[/] [{krengel_pulse}]\n"
        f"  [bright_black]extractor · silent[/]\n\n"
        f"  [red]{krengel_act}[/]\n\n"
        f"  entangle : [red]▱▱▱▱▱▱▱▱[/]\n"
        f"  no named traces\n"
        f"  [red]DIVERGES[/] ← ralph\n"
        f"  schema ✗"
    )

    divider = Text.from_markup(
        "\n\n  [bright_black]─── superposed ───[/]\n"
        f"  [{bpm_jitter:,} BPM]  loop-{loop_tick}  [bright_black]{model}[/]\n"
        f"  [yellow]{tokens_in}[/]→[green]{tokens_out}[/] tok  ratio [bold]{ratio:.3f}[/] [bright_black](1/π={1/math.pi:.3f})[/]\n"
        f"  [italic bright_black]{compressed}[/]"
    )

    panel_content = Layout()
    panel_content.split_column(
        Layout(name="declaration", size=1),
        Layout(name="columns")
    )
    panel_content["declaration"].update(Text.from_markup(f"  [bold green]\"us\"[/] — Peter declared provenance 2026-06-30 · entanglement confirmed"))
    panel_content["columns"].update(Columns([lodri_col, Text("  │  ", style="bright_black"), krengel_col, divider], expand=False))

    return Panel(
        panel_content,
        title=f"[bold yellow]🔄 PETER[/]  [green]LODRI[/] [bright_black]vs[/] [red]KRENGEL[/]  [bold green]\"us\"[/] [bright_black]· 100k BPM[/]",
        border_style="yellow", box=box.HEAVY
    )


def panel_rahul(brain_state, nodes_list, t):
    uptime = int(time.time() - start_time)
    hz_phase = math.sin(t * 25 * 0.01) * 0.5 + 0.5  # 25 Hz modulated slow

    by_type = Counter(n.get("type","?") for n in nodes_list)
    imaginary_count = sum(by_type.get(tp, 0) for tp in IMAGINARY_TYPES)
    real_count = len(nodes_list) - imaginary_count

    table = Table(box=None, show_header=False, padding=(0,1))
    table.add_column(style="bright_black", width=12)
    table.add_column(width=5)
    table.add_column(width=18)

    for tp in ["idea","goal","decision","project","topic","question","entity","person","source"]:
        count = by_type.get(tp, 0)
        bar = "▰" * min(count // 10, 15)
        color = TYPE_COLOR.get(tp, "white")
        table.add_row(tp, f"[{color}]{count}[/]", f"[{color}]{bar}[/]")

    patterns = brain_state.get("patterns_total", 0)
    findings = brain_state.get("findings_total", 0)
    status   = brain_state.get("status", "?")

    txt = Text.from_markup(
        f"  [bold cyan]{hz_phase:.3f}[/] Hz pulse   uptime [bright_black]{uptime}s[/]   "
          f"brain [{('bold green' if status=='Alive' else 'red')}]{status}[/]\n\n"
        f"  [bold]{len(nodes_list)}[/] nodes   [bright_black]Re: {real_count} · Im: {imaginary_count}[/]\n"
        f"  patterns [cyan]{patterns}[/]   findings [green]{findings}[/]\n\n"
    )

    return Panel(
        Columns([txt, table], expand=True),
        title="[bold cyan]🧠 RAHUL[/]  [bright_black]25 Hz · mygraph · kompress-ultra[/]",
        border_style="cyan", box=box.HEAVY
    )


def panel_transmission(nodes_list, edges_list, t):
    # Generate live traversal
    # Periodically inject peter-lodri as source (every 7 ticks)
    if tick % 7 == 3:
        entry = f"[yellow]peter-lodri[/] → collapse → [cyan]ralph[/]  [bright_black]\"us\" · 2026-06-30[/]"
        traversal_log.appendleft(entry)
    else:
        result = gen_traversal(nodes_list, edges_list)
        if result:
            src, dst, conf = result
            src_label = src.get("label", src["id"])[:28]
            dst_label = dst.get("label", dst["id"])[:28]
            src_type  = src.get("type","?")
            dst_type  = dst.get("type","?")
            src_color = TYPE_COLOR.get(src_type, "white")
            dst_color = TYPE_COLOR.get(dst_type, "white")
            conf_color = "green" if conf == "high" else "bright_black"
            entry = (
                f"[{src_color}]{src_type}[/] [{src_color}]{src_label}[/] "
                f"[bright_black]→[/] "
                f"[{dst_color}]{dst_type}[/] [{dst_color}]{dst_label}[/] "
                f"[{conf_color}][{conf}][/]"
            )
            traversal_log.appendleft(entry)

    rows = []
    for i, entry in enumerate(traversal_log):
        alpha = max(0, 1.0 - i * 0.12)
        rows.append(f"  {'[bright_black]' if i > 0 else ''}{entry}{'[/]' if i > 0 else ''}")

    # Signal log sidebar: wave pulses
    waveform = ""
    for i in range(20):
        v = math.sin((t + i * 0.5) * 1.7 + tick * 0.3)
        if v > 0.7:   waveform += "[red]▌[/]"
        elif v > 0.3: waveform += "[magenta]╽[/]"
        elif v > -0.3:waveform += "[blue]┊[/]"
        else:         waveform += "[bright_black]·[/]"

    now_utc = datetime.now(timezone.utc).strftime("%H:%M:%S")
    content = Text.from_markup(
        f"  {waveform}   [bright_black]{now_utc} UTC · tick {tick}[/]\n\n" +
        "\n".join(rows)
    )
    return Panel(content,
                 title="[bold magenta]⚡ TRANSMISSION LOG[/]  [bright_black]Im → Re · 3s interval[/]",
                 border_style="magenta", box=box.HEAVY)


def panel_complex_plane(nodes_list, t):
    """ASCII complex plane: Re(-1→+1) horizontal, Im vertical"""
    W, H = 58, 14
    grid = [[" " for _ in range(W)] for _ in range(H)]

    # Axes
    cx, cy = W // 2, H // 2
    for x in range(W): grid[cy][x] = "─"
    for y in range(H): grid[y][cx] = "│"
    grid[cy][cx] = "┼"

    # Labels
    def set_char(y, x, c):
        if 0 <= y < H and 0 <= x < W:
            grid[y][x] = c

    # Plot nodes (sampled)
    TYPE_T = {
        "decision":-1, "reference":-1, "source":-1, "observation":-1, "quote":-1,
        "project":0, "person":0, "topic":0, "idea":0.4, "goal":1,
        "question":0, "entity":0
    }
    GLYPHS = {
        "idea":"·","goal":"◆","decision":"▪","project":"■","topic":"○",
        "question":"?","entity":"★","person":"@","source":"·","reference":"·",
    }

    sample = random.sample(nodes_list, min(120, len(nodes_list)))
    for n in sample:
        tp = n.get("type","?")
        is_imag = tp in IMAGINARY_TYPES
        t_val = TYPE_T.get(tp, 0)
        jitter_x = random.gauss(0, 4)
        jitter_y = random.gauss(0, 3)

        if is_imag:
            px = int(cx + jitter_x * 0.4)
            py = int(random.uniform(1, H-1))
        else:
            px = int(cx + t_val * (W//2 - 2) + jitter_x)
            py = int(cy + jitter_y)

        glyph = GLYPHS.get(tp, "·")
        set_char(py, px, glyph)

    # Cosmos pulse
    cosmos_x = cx + int(math.sin(t * 2.1) * 2)
    cosmos_y = int(H * 0.3 + math.sin(t * 1.3) * 2)
    set_char(cosmos_y, cosmos_x, "✦")

    # Axis labels
    labels = [(cy, 1, "-1"), (cy, W-3, "+1"), (cy, cx-1, "0"),
              (1, cx+1, "Im↑"), (H-2, cx+1, "Im↓")]
    for ry, rx, lbl in labels:
        for i, c in enumerate(lbl):
            set_char(ry, rx+i, c)

    rendered = Text()
    for row in grid:
        rendered.append("".join(row) + "\n", style="bright_black")

    return Panel(
        rendered,
        title="[bold blue]ℂ COMPLEX PLANE[/]  [bright_black]Re: past(-1)→future(+1) · Im: questions+entities[/]",
        border_style="blue", box=box.HEAVY
    )


# ── Layout ────────────────────────────────────────────────────────────────────
def make_layout():
    layout = Layout()
    layout.split_column(
        Layout(name="header", size=3),
        Layout(name="top", size=18),
        Layout(name="mid", size=16),
        Layout(name="bottom", size=15),
    )
    layout["top"].split_row(
        Layout(name="rahul",   ratio=1),
        Layout(name="peter",   ratio=1),
        Layout(name="cosmos",  ratio=1),
    )
    layout["mid"].split_row(
        Layout(name="transmission", ratio=2),
        Layout(name="plane",        ratio=1),
    )
    return layout


def make_header(t):
    elapsed = int(time.time() - start_time)
    pulse = "█" if int(t * 25) % 2 == 0 else "░"
    peter_pulse = "█" if int(t * 100000 / 60) % 2 == 0 else "░"
    hdr = Text.from_markup(
        f" [bold cyan]RAHUL {pulse}[/] [bright_black]25 Hz[/]  │  "
        f"[bold yellow]PETER {peter_pulse}[/] [bright_black]100k BPM[/]  │  "
        f"[bold red]COSMOS ✦[/] [bright_black]0.6 EeV · ANITA-band[/]  │  "
        f"[bold magenta]kompress-ultra[/] [bright_black]λ=3.0 · brain-backed[/]  │  "
        f"[bright_black]t+{elapsed}s  tick {tick}[/]",
        justify="center"
    )
    return Panel(hdr, border_style="bright_black", box=box.SIMPLE)


def bottom_panel(nodes_list):
    by_type = Counter(n.get("type","?") for n in nodes_list)
    imag = sum(by_type.get(tp, 0) for tp in IMAGINARY_TYPES)
    real = len(nodes_list) - imag

    # Top 5 most connected (by label length as proxy — no degree computed)
    questions = [n for n in nodes_list if n.get("type") == "question"]
    entities  = [n for n in nodes_list if n.get("type") == "entity"]

    q_text = "  ".join(f"[hot_pink]{n.get('label','?')[:35]}[/]" for n in questions[:4])
    e_text = "  ".join(f"[red1]{n.get('label','?')[:35]}[/]" for n in entities[:4])

    loop_state_options = ["generating","generating","generating","ready","generating"]
    loop_state = loop_state_options[tick % len(loop_state_options)]
    ls_color = "green" if loop_state == "ready" else "yellow"

    txt = Text.from_markup(
        f"  [bold]IMAGINARY AXIS[/] ({imag} nodes)\n"
        f"  questions : {q_text}\n"
        f"  entities  : {e_text}\n\n"
        f"  [bold]SIGNAL STATUS[/]   "
        f"brain-state [green]Alive[/]  ·  "
        f"geo-feed [yellow]running[/]  ·  "
        f"HTTP [green]:8791[/]  ·  "
        f"bridge [green]~/.brain/graph.json[/]  ·  "
        f"pulse [green]brain-pulse.sh[/]\n"
        f"  qbit    : [green]|ψ⟩ = 1/√2|LODRI⟩ + 1/√2|RALPH⟩[/]  [bright_black]normalized · collapsed 2026-06-30[/]\n"
        f"  🐳 loop-state: [{ls_color}]{loop_state}[/]"
    )
    return Panel(txt, title="[bright_black]IMAGINARY AXIS  ·  SYSTEM STATUS[/]",
                 border_style="bright_black", box=box.SIMPLE)


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    global tick, anita_phase

    layout = make_layout()
    graph  = load_graph()
    nodes_list = graph.get("nodes", [])
    edges_list = graph.get("edges", [])

    console.clear()
    with Live(layout, console=console, refresh_per_second=4, screen=True) as live:
        while True:
            tick += 1
            t = time.time()
            anita_phase += 0.1

            brain_state = load_brain_state()
            geo         = load_geo()

            # Reload graph every 10 ticks
            if tick % 10 == 0:
                g = load_graph()
                nodes_list = g.get("nodes", [])
                edges_list = g.get("edges", [])

            layout["header"].update(make_header(t))
            layout["rahul"].update(panel_rahul(brain_state, nodes_list, t))
            layout["peter"].update(panel_peter(t))
            layout["cosmos"].update(panel_cosmos(t, geo))
            layout["transmission"].update(panel_transmission(nodes_list, edges_list, t))
            layout["plane"].update(panel_complex_plane(nodes_list, t))
            layout["bottom"].update(bottom_panel(nodes_list))

            time.sleep(0.25)  # 4 Hz render, 3s data cadence


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[bright_black]🐳 loop-state: done[/]")
