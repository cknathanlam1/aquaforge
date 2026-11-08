# AquaForge: water strategy, priced in dollars

> Companies won't act on sustainability unless it saves money. This tool shows exactly how many dollars a water strategy saves, and what a supply disruption would cost if they do nothing.

AquaForge is a water-management simulator for industrial campuses (semiconductor fabs, data centers). Drag water sources, treatment, recycling and efficiency pieces onto an isometric campus, and the engine prices the design against an auto-derived "do nothing" baseline: annual savings, risk-adjusted savings, payback, NPV, and the cost of a drought if you don't act. Units are metric (m³/day) with a USD / NT$ toggle.

The default demo is the **Taiwan Science Park** case study: the 2021 drought, 11-15% mandated water cuts, and trucked-in water.

![AquaForge: isometric campus board with the Impact Dashboard](docs/screenshot.png)

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
| Annual cost | (365 − drought days) × normal-day cost + drought days × drought-day cost + fixed O&M |
| Daily cost | water purchases + water consumption fee + trucking + discharge + brine + energy + variable O&M + lost production |
| Treatment energy cost | Σ (treated volume × kWh/m³) × electricity price × 365 |
| O&M | Variable O&M (Σ volume × USD/m³ × 365) + fixed O&M (per new piece, per year) |
| Capex | Σ capex of new pieces − capex the do-nothing baseline would also spend (e.g. a new building's conventional plumbing) |
| Net annual savings | Baseline annual cost − Design annual cost |
| Simple payback | Capex ÷ Net annual savings (none if savings ≤ 0) |
| NPV | Σ<sub>t=1..N</sub> Net annual savings ÷ (1 + r)<sup>t</sup> − Capex, with r = discount rate, N = horizon |
| Expected disruption cost | Σ over supplies of P(outage per year) × max(0, outage hours − storage buffer hours) × lost production per hour, weighted across normal and drought days |
| Risk-adjusted savings | Net annual savings + (Baseline expected disruption − Design expected disruption) |
| Trucking | Tankers/day = ⌈shortfall ÷ 20 m³ per tanker⌉, capped by the site's tanker limit; cost = tankers × trip cost |
| Mandated cut | Permitted withdrawal = normal withdrawal × (1 − cut); cut = 11% (initial) or 15% (escalated) in the 2021 scenario |
| Water consumption fee | Taiwan MOEA dry-season fee: NT$3/m³ on municipal use above 9,000 m³/month per user, charged Nov–Apr only |
| Cost of doing nothing | Baseline cost in the selected scenario − baseline cost in a normal year |

## Assumptions: what's sourced and what's not

All constants live in [`lib/assumptions.ts`](lib/assumptions.ts), each with a unit, a source note and a status:

- **sourced**: secondary-source figure from the Taiwan case study. Verify before presenting.
- **illustrative**: placeholder. Editable. Replace with site data.

Water tariffs, electricity price, trucking cost, downtime cost, desal and recycling capacity are now **sourced from secondary reporting** (with links in the app and in `research/`) and should still be verified before presenting. **Most capex and O&M figures, disruption probabilities, the daily tanker limit, and the 2035/2050 stress multipliers remain illustrative placeholders**, not measured site data. The dollar outputs show how the model reasons, not a quote for a real facility.

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

Each claim was checked against its source on 2026-11-07; see [`research/assumptions-research.md`](research/assumptions-research.md) for the fact-check, including three corrections to the original brief (the "~100 tankers/day" figure was a contracted fleet size, the TSMC reclamation plant runs at 20,000 t/day, and the blackout attribution is contested).

| Fact | Source |
| --- | --- |
| 2021 was Taiwan's worst drought in over 50 years ("worst in 56 years"). In 2020 no typhoon made landfall for the first time since 1964. | [Earth.org (2022)](https://earth.org/the-taiwan-water-shortage-dilemma/) |
| TSMC used about 156,000 metric tons of water a day across its operations in 2019. | [Verdict, citing TSMC's 2019 CSR report (2021)](https://www.verdict.co.uk/taiwan-drought-chip-supply/) |
| Hsinchu Science Park uses about 170,000 t/day; Southern Taiwan Science Park about 175,000 t/day. | [Earth.org; Tom's Hardware citing DigiTimes (2021)](https://www.tomshardware.com/news/tsmc-umc-hit-by-drought-trucking-in-water) |
| An average semiconductor fab consumes roughly 20,000 t/day. | [Fortune, citing China Water Risk (2021)](https://fortune.com/2021/06/12/chip-shortage-taiwan-drought-tsmc-water-usage/) |
| TSMC recycled about 87% of its manufacturing water in 2019 and reuses each drop about 3.5 times. | [Fortune (2021)](https://fortune.com/2021/06/12/chip-shortage-taiwan-drought-tsmc-water-usage/) |
| Hsinchu-area industrial cuts reached 11% in Feb 2021 and 15% by June. One tanker carries about 20 t, so an 11% cut at one 20,000 t/day fab is about 110 tanker trips a day. | [Wccftech; Taipei Times; DV Hardware (2021)](https://www.taipeitimes.com/News/front/archives/2021/06/01/2003758391) |
| TSMC and UMC trucked in about 3,600 t, roughly 2% of a day's use in the Southern park. | [Tom's Hardware (2021)](https://www.tomshardware.com/news/tsmc-umc-hit-by-drought-trucking-in-water) |
| Baoshan II reservoir (Hsinchu) was at 14.62% storage in Feb 2021. | [The Register (2021)](https://www.theregister.com/2021/02/24/tsmc_drought/) |
| An emergency desalination unit completed in Hsinchu during the drought treats about 13,000 t/day, small relative to park demand. | [Taiwan Water Resources Agency (2021)](https://www.wra.gov.tw/wrapen/cp.aspx?n=44729) |
| Desalinated water was cited at about US$1 per tonne, affordable mainly to companies like TSMC. | [Al Jazeera (2021)](https://www.aljazeera.com/news/2021/8/20/taiwan-water-woes) |
| TSMC's Southern Taiwan Science Park reclamation plant started in Sept 2022 at 5,000 t/day, reached 20,000 t/day about a year later, and targets 30,000 t/day by 2026. | [CTCI (operator) (2022)](https://www.ctci.com/e-newsletter/EN/481/discover-reliable/article-01.html) |
| Drought-reduced hydropower was cited as a factor in May 2021 power rationing (the 13 May blackout is usually attributed to a power plant fault). | [Verdict (2021)](https://www.verdict.co.uk/taiwan-drought-chip-supply/) |

## Project layout

- `lib/contract.ts`: shared types between engine, UI and API
- `lib/assumptions.ts`: every constant, with provenance
- `lib/` (engine), `app/` + `components/` (UI), `app/api/advise` + `lib/advise` (explanations)
- `research/`: assumption sourcing notes
