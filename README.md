# Nature: water strategy, priced in dollars

> Companies won't act on sustainability unless it saves money. This tool shows exactly how many dollars a water strategy saves, and what a supply disruption would cost if they do nothing.

Nature is a water-management simulator for industrial campuses (semiconductor fabs, data centers). Drag water sources, treatment, recycling and efficiency pieces onto an isometric campus, and the engine prices the design against an auto-derived "do nothing" baseline: annual savings, risk-adjusted savings, payback, NPV, and the cost of a drought if you don't act. Units are metric (m³/day) with a USD / NT$ toggle.

The default demo is the **Taiwan Science Park** case study: the 2021 drought, 11-15% mandated water cuts, and trucked-in water.

<!-- TODO: screenshot or GIF of the board + dashboard -->
![Demo screenshot placeholder](docs/demo.gif)

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest unit tests
npm run build      # production build
```

Optional: copy `.env.example` to `.env.local` and set `ANTHROPIC_API_KEY` to turn on live Claude explanations. Without it, the "Ask" panel uses a scripted explainer built from the same engine numbers, so the demo works offline.

## How the numbers are computed

Every dashboard number is a `Metric` with its formula and plugged-in inputs (click any figure to "show your work"). All money is USD internally and converted for display. Volumes are m³/day unless named otherwise.

| Metric | Formula |
| --- | --- |
| Annual water cost | Σ (source volume × price) × 365, + discharge and brine fees + drought surcharge + trucking |
| Treatment energy cost | Σ (treated volume × kWh/m³) × electricity price × 365 |
| O&M | Variable O&M (Σ volume × USD/m³ × 365) + fixed O&M (per new piece, per year) |
| Capex | Σ capex of new (non-existing) pieces |
| Net annual savings | Baseline annual cost − Design annual cost |
| Simple payback | Capex ÷ Net annual savings (none if savings ≤ 0) |
| NPV | Σ<sub>t=1..N</sub> Net annual savings ÷ (1 + r)<sup>t</sup> − Capex, with r = discount rate, N = horizon |
| Expected disruption cost | Σ over supplies of P(outage per year) × outage length × lost production per hour |
| Risk-adjusted savings | Net annual savings + (Baseline expected disruption − Design expected disruption) |
| Trucking | Tankers/day = shortfall ÷ 20 m³ per tanker; cost = tankers × trip cost |
| Mandated cut | Permitted withdrawal = normal withdrawal × (1 − cut); cut = 11% (initial) or 15% (escalated) in the 2021 scenario |
| Surcharge | Applies to municipal use above 9,000 m³/month per user |
| Cost of doing nothing | Baseline cost in the selected scenario − baseline cost in a normal year |

## Assumptions: what's sourced and what's not

All constants live in [`lib/assumptions.ts`](lib/assumptions.ts), each with a unit, a source note and a status:

- **sourced**: secondary-source figure from the Taiwan case study. Verify before presenting.
- **illustrative**: placeholder. Editable. Replace with site data.

**Capex, O&M, downtime cost, disruption probabilities, trucking cost, electricity price and water tariffs are illustrative placeholders**, not measured site data. The dollar outputs show how the model reasons, not a quote for a real facility.

To change an assumption:

- **In the app:** open the Assumptions drawer, edit a value, and every metric recomputes. Changed values are saved in the scenario file and URL.
- **In code:** edit the default in `lib/assumptions.ts`. Keep the `status` and `source` honest: switch to `src(...)` only with a citation.

## Ask Claude (optional)

`POST /api/advise` takes an `AdviseRequest` (see [`lib/contract.ts`](lib/contract.ts)) and returns `{ success, source, answer }`.

- With `ANTHROPIC_API_KEY` set, Claude (`claude-sonnet-4-6`, 12 s timeout) explains the engine output in plain English. Its system prompt allows it to cite only numbers present in the engine output; if asked for something the engine doesn't compute, it says "the model doesn't compute that".
- Without a key, or on any error or timeout, it returns `source: "scripted"`: a deterministic explainer in [`lib/advise/scripted.ts`](lib/advise/scripted.ts) that uses only the request's numbers. Tests check that it never cites a number not present in the request.

## Deploy (Vercel)

1. Push the repo to GitHub and import it in Vercel (framework preset: Next.js).
2. Optional: in **Project Settings → Environment Variables**, add `ANTHROPIC_API_KEY`. Never put the key in code or commit a `.env` file (`.gitignore` excludes `.env*` except `.env.example`).
3. Deploy. The app works without the key; the Ask panel just uses the scripted explainer.

## Taiwan case study

Facts behind the default scenario (from `CASE_STUDY_FACTS` in `lib/assumptions.ts`). All are secondary sources: verify before presenting.

<!-- TODO: add source links (the research workstream is collecting them). -->

| Fact | Source |
| --- | --- |
| 2021 was Taiwan's worst drought in 50+ years; no typhoon made landfall for the first time since 1964. | Earth.org (2021) |
| TSMC used 156,000 t/day across Taiwan's three science parks in 2019; UMC used 31,500 t/day. | Bangkok Post, citing company reports (2021) |
| Hsinchu Science Park uses about 170,000 t/day; Southern Taiwan Science Park about 175,000 t/day. | Earth.org; Tom's Hardware citing DigiTimes (2021) |
| An average semiconductor fab consumes roughly 20,000 t/day. | China Water Risk via Fortune (2021) |
| Fab water recycling ranges roughly 40-70% of process water; TSMC targets reusing each drop about 3.5 times. | Swarajya; Fortune (2021) |
| Hsinchu-area government cuts of 11%, possibly rising to 15%. One tanker carries about 20 t; TSMC would need ~100 tankers/day. | DV Hardware citing Liberty Times (2021) |
| TSMC and UMC trucked in ~3,600 t, about 2% of the Southern park's daily use. | Tom's Hardware (2021) |
| Baoshan II reservoir (Hsinchu) was at 14.62% storage in Feb 2021. | The Register (2021) |
| A new Hsinchu desalination facility treats about 13,000 t/day, small relative to park demand. | Earth.org (2021) |
| Desalinated water was cited at about US$1 per tonne, affordable mainly to large companies. | Al Jazeera (2021) |
| TSMC's Southern Taiwan Science Park recycling plant (Sept 2022) supplies about 10,000 t/day, planned to expand. | The Diplomat (2022) |
| The drought also caused electricity blackouts via reduced hydropower. | Earth.org; Verdict (2021) |

## Project layout

- `lib/contract.ts`: shared types between engine, UI and API
- `lib/assumptions.ts`: every constant, with provenance
- `lib/` (engine), `app/` + `components/` (UI), `app/api/advise` + `lib/advise` (explanations)
- `research/`: assumption sourcing notes
