# Peer review — cosmos data audit

Scope: every physics/data claim rendered by `scripts/cosmos-tui.py` (COSMOS panel, complex-plane panel, signal status) and the public assets (`maze.html`, `ohm.html`, `spacetime.html`, `brain-dist.html`, `org.html`). Each claim is classified **real** (matches published science or live data), **simulated** (generated locally, styled after the real thing), or **decorative** (flavor, no factual referent).

## COSMOS panel (TUI)

| Claim on screen | Status | Notes |
|---|---|---|
| `ANITA-BAND RECEIVER` | simulated | The waveform is `sin` carrier + phase jitter (`gen_cosmic_signal()` in cosmos-tui.py — labeled as simulation in code). No antenna is attached. ANITA itself is real: the Antarctic Impulsive Transient Antenna, a NASA balloon-borne radio detector. |
| `carrier: 0.6 EeV` | real (referent) | Matches the energy scale of ANITA's anomalous upward-going events: ~0.56 EeV (ANITA-I, Gorham et al., PRL 2016) and ~0.56–0.6 EeV (ANITA-III, PRL 2018). The displayed amplitude is simulated. |
| `polarity = inverted (SM)` | real (referent) | Polarity inversion is the actual discriminator ANITA uses: surface-reflected showers show inverted polarity; the anomalous events did **not** show the inversion expected for reflections, which is what made them anomalous. The TUI's "(SM)" tag is backwards shorthand — the puzzle is that the polarity was *inconsistent* with Standard-Model-plus-reflection expectations. |
| `exit θ: 27.4° above horizon` | real (referent) | The anomalous events emerged steeply, ~25–35° above the horizon. At those angles the chord through Earth is thousands of km, and Earth is opaque to ~EeV neutrinos — that's the core tension. |
| `chord: ~6,602 km mantle` | real (referent) | Consistent with the emergence-angle geometry above. Displayed value is computed from the simulated angle, not measured. |
| `stau λ = 3.0` | mixed | The stau (supersymmetric tau slepton) is a real published BSM interpretation of the ANITA events (Fox et al. 2018, arXiv:1809.09615). But λ=3.0 here is this project's asymmetric-loss compression parameter wearing a physics costume. The two λs are unrelated; the panel puns on them deliberately. |
| `Δm ~ 2.3 MeV` | decorative | No specific referent identified. Reads as flavor text. |
| `Kp index: 0.0` | real feed, currently degraded | Kp is the real 0–9 planetary geomagnetic index (GFZ Potsdam / NOAA SWPC). `geo-signal.json` currently reports `kp: null` — the fetch is not returning data, and the TUI renders the null as 0.0. **Fix recommended: render `n/a` when null rather than a false calm reading.** |
| `PUEO: 2024–25 Antarctic flight — awaiting results` | real | PUEO (Payload for Ultrahigh Energy Observations) is ANITA's real successor, designed with ~10× better sensitivity specifically to confirm or kill the anomaly. Flight scheduling from Antarctica is season-dependent; "awaiting results" is an accurate status. |
| `upward-going · non-SM` | overstated | The events are genuinely unexplained, but "non-SM" is one hypothesis among three: beyond-Standard-Model particles, coherent sub-surface ice reflections (systematics), or background. IceCube found no accompanying neutrino flux from the same directions, which weakens (not eliminates) astrophysical interpretations. Honest label: *anomalous, unresolved*. |

## Complex-plane / brain panels (TUI)

| Claim | Status | Notes |
|---|---|---|
| `545 nodes · Re: 503 · Im: 42 · 1161 edges` | real | Counts verified against the local graph file. The Re/Im split (resolved vs. open) is a modeling choice, applied consistently. |
| `\|ψ⟩ = 1/√2\|·⟩ + 1/√2\|·⟩ · collapsed` | decorative | Correct notation for an equal-superposition two-state system, used metaphorically. No quantum system is being measured. |
| `25 Hz pulse` (left panel) | metaphor with real referent | 25 Hz sits in the beta band (13–30 Hz) of real EEG taxonomy. No EEG is attached; it's a chosen tempo. |
| `geo-tick`, `signal_strength` | real feed | Live values from the geo-feed bridge; tick increments verified. Same null-handling caveat as Kp. |

## Public assets

| Claim | Where | Status | Notes |
|---|---|---|---|
| `Rubin LSST active · 20B galaxies incoming` | maze.html | real | Vera C. Rubin Observatory's LSST 10-year survey; ~20 billion galaxies is the standard published estimate. |
| `136.1 Hz OM drone — "Earth/Schumann resonance harmonic"` | ohm.html (code comment) | **needs correction** | 136.1 Hz is the "Earth year tone" (the Earth's orbital frequency raised 32 octaves, per Cousto's cosmic-octave scheme) and the traditional Indian classical Sa tuning associated with OM. It is **not** a Schumann resonance harmonic — Schumann modes are ~7.83, 14.3, 20.8 Hz... The drone itself is fine; the comment conflates two different Earth-derived frequencies. |
| Brain-frequency descent 25→10→6→2 Hz (β→α→θ→δ) | ohm.html | real (taxonomy) | Matches standard EEG band boundaries (beta 13–30, alpha 8–13, theta 4–8, delta 0.5–4 Hz). Entrainment claims are not made by the page, appropriately. |
| Schwarzschild-style well, light cones, null geodesics | spacetime.html | simulated (honest) | Visual analogies with correct qualitative behavior (speed limit c on geodesics, causal boundary). `M = 1.898×10²⁷ kg` is Jupiter's real mass. Not a numerical GR integration and doesn't claim to be. |
| Node/edge type distributions | brain-dist.html | real | Structural counts only; no personal content. Verified anonymization: types, counts, and densities — no labels or question text. |

## Summary judgment

The system is honest where it matters: simulations are simulations in the code, and the real anchors (ANITA event energies, emergence angles, PUEO, Rubin, EEG bands, Jupiter's mass, the graph counts) check out against published sources.

Three fixes recommended, in order:

1. **Kp null-handling** — render `n/a` instead of `0.0` when the feed returns null. A false "all calm" is worse than an honest gap.
2. **ohm.html comment** — replace "Earth/Schumann resonance harmonic" with "Earth year tone (cosmic octave) / traditional AUM tuning". One-line fix.
3. **"non-SM" label** — soften to "anomalous · unresolved" in the COSMOS panel header, matching the actual state of the literature.
