# Assumptions research: `lib/assumptions.ts`

Researched 2026-11-07. Money converted at **NT$32/USD** (see `fx.twdPerUsd`). All units match the `unit` field in `lib/assumptions.ts`, so values drop straight in.
The machine-readable version is `research/assumptions-proposed.json`, which maps key → `{ value, low, high, status, source, url }`. It covers **all 170 keys** in `lib/assumptions.ts` as of 2026-11-07, including the keys the engine session renamed or added mid-research (`demand.evap`, `consumptive.evap`, `eff.opt/leak/meter`, `downtime.fabArea/datacenterXL`, and the river, rain, softener and WWT keys). Keys with no source carry `status: "illustrative"`, `low/high: null`, and the note "No good public source; keep illustrative."

How to read the "status" column:
- **sourced**: a cited figure that was checked against the page (or a primary source) for this report.
- **derived**: an engineering calculation from a cited relationship. Present it as an estimate, not as a fact.
- **illustrative**: no good public source, so keep it as an editable placeholder.

---

## 0. Top surprises (default changes by about 2× or more, or a sourced fact that is wrong)

1. **`truck.tripCost` 100 → 1,000 USD/trip (10×).** Wccftech, citing Liberty Times, reports **US$1,000 (NT$30,000) per 20 t tanker**, which is about **US$50/m³**, or roughly 130× the tap tariff. This is the biggest single change. It makes trucking look far worse than it does now.
2. **The "~100 tankers/day covers TSMC" claim is arithmetically wrong.** 100 × 20 t = 2,000 t/day, but TSMC used about 156,000 t/day. The 100 figure is the number of trucks TSMC *contracted* (a fleet), not a daily coverage figure. An 11% cut on 156,000 t/day is about 17,000 t/day, or about **860 tanker trips/day**. Do not present "100 tankers/day would cover TSMC" in the pitch. If a 20,000 m³/day fab faces an 11% cut, it needs 2,200 m³/day, which is **110 trips/day**. That number is defensible.
3. **`cap.recycle` / fact `tsmc-reclaim`: 10,000 t/day was not found.** The operator CTCI says the TSMC Southern Taiwan Science Park (STSP) reclamation plant **started on 19 Sept 2022 at 5,000 t/day, reached 20,000 t/day about a year later, and targets 30,000 t/day by 2026** (67,000 t/day long-term). Proposed default: 20,000 (2×). The Diplomat page returned 403, so its 10,000 figure could not be checked.
4. **`downtime.fab` 500k → 1.0M USD/hour (2×).** Schneider Electric gives US$1–2M/hour for advanced fabs. TSMC's own 2018 virus incident booked about NT$2.6B (about US$85M) in Q3 2018 for roughly 3 days of disruption, which is about US$1.2M/hour.
5. **`downtime.datacenter` 150k → 300k USD/hour (2×).** Ponemon (2016) puts the average unplanned outage at US$8,851/min, which is about US$531k/hour. Uptime Institute (2024) reports that 54% of operators' last significant outage cost >US$100k, and 20% cost >US$1M.
6. **The surcharge is national, not Southern Taiwan Science Park–specific, and it only applies Nov–Apr.** The 9,000 m³/month threshold is real. It is a Ministry of Economic Affairs (MOEA) **耗水費 (water consumption fee)** on any user above 9,000 m³/month **in the dry season (Nov–Apr) only**. The rate is NT$3/m³, reduced to NT$2 or NT$1 if the user meets recycling benchmarks. TSMC reportedly pays NT$1. It was **halved (NT$1.5) through 2025 and charged in full from 2026**. If the engine applies `policy.surchargeRate` year-round, it overstates the surcharge by about 2×.
7. **Blackout claim is shaky.** Verdict (May 2021) attributes phased blackouts to low hydropower. Earth.org (2022) mentions two large blackouts in a week but does not mention hydropower. The 13 May 2021 blackout is widely attributed to an equipment failure at the Hsinta power plant, so do not say that "the drought caused blackouts" without qualifying it.
8. **"40–70% recycling (Swarajya)" could not be verified.** Use TSMC's own figure instead: about **87% of manufacturing water recycled (2019 CSR, via Fortune)**. Also, Fortune attributes the "3.5 times" reuse figure to **TSMC**, not to China Water Risk.

---

## 1. Fact-check table (`CASE_STUDY_FACTS` + `status: "sourced"` assumptions)

| id | claim | verified? | source URL | notes |
|---|---|---|---|---|
| drought-2021 | Worst drought in 50+ years; no typhoon landfall for first time since 1964 | **Yes** | Earth.org, "The Taiwan Water Shortage Dilemma", O. Lai, 8 Apr 2022: https://earth.org/the-taiwan-water-shortage-dilemma/ | The 1964 line is only in the **2022** Earth.org piece. The Apr 2021 piece (https://earth.org/taiwan-experiencing-its-worst-drought-in-nearly-60-years/) says "worst in 56 years". Change `year` to 2022, or cite both. Note that the typhoon gap was in **2020**, which caused the 2021 drought. |
| tsmc-use | TSMC 156,000 t/day across three science parks in 2019; UMC 31,500 t/day | **Partly** | Verdict, R. Scammell, 19 May 2021: https://www.verdict.co.uk/taiwan-drought-chip-supply/ ; Bangkok Post (Bloomberg), 2021: https://www.bangkokpost.com/business/2101575/taiwan-drought-threatens-to-make-chip-shortage-worse | 156,000 (2019, from TSMC's 2019 CSR report) is confirmed. Verdict says "across all its operations", not "three science parks". UMC 31,500 t/day (2019) appears in the Bangkok Post search snippet, which says "at its Taiwan facilities"; the full page is paywalled (tollbit redirect), so it could not be read in full. Better primary source: TSMC 2019 CSR report and UMC 2019 CSR report. |
| park-use | Hsinchu SP ≈ 170,000 t/day; STSP ≈ 175,000 t/day | **Yes** | Earth.org, 23 Apr 2021: https://earth.org/taiwan-experiencing-its-worst-drought-in-nearly-60-years/ ; Tom's Hardware (citing DigiTimes), Feb 2021: https://www.tomshardware.com/news/tsmc-umc-hit-by-drought-trucking-in-water | Both match. A better primary source would be the science park bureau's annual water statistics (not found online in English). |
| fab-use | Average fab ≈ 20,000 t/day | **Yes** | Fortune, "Taiwan's drought is exposing just how much water chipmakers like TSMC use (and reuse)", E. Barrett, 12 Jun 2021: https://fortune.com/2021/06/12/chip-shortage-taiwan-drought-tsmc-water-usage/ | Quote: "According to nonprofit China Water Risk (CWR), an average semiconductor factory consumes roughly 20,000 tons of water a day." |
| recycling | 40–70% of process water recycled (Swarajya); TSMC reuses each drop ~3.5× | **Partly** | Fortune (above) | "3.5 times" is confirmed but attributed to **TSMC**. The 40–70% (Swarajya) figure was **not found**. Fortune also gives TSMC's recycling rate as **87% (2019)**, so use that instead. |
| cuts | Hsinchu cuts 11%, possibly 15%; tanker ≈ 20 t; TSMC needs ~100 tankers/day | **11%/15%/20 t yes; "100/day" wrong** | DVHardware, "TSMC trucking in more water as droughts intensify", 19 Mar 2021: https://www.dvhardware.net/article74998.html ; Wccftech, 24 Feb 2021: https://wccftech.com/tsmc-using-water-tankers-for-chip-production-as-5nm-plant-faces-rationing/ ; Taipei Times, 1 Jun 2021: https://www.taipeitimes.com/News/front/archives/2021/06/01/2003758391 | 11% (Feb 2021, after an earlier 6%) is confirmed by Wccftech. 15% was a forecast by the economy minister (DVHardware, citing Liberty Times) and was **in force by 1 June** (Taipei Times, orange alert). Earth.org (Apr 2021) and AmCham (May 2021) report **13%** in between, and a 17% cut planned for 1 June was postponed after the rains (CNBC, 19 May 2021). **"100 tankers/day" is a contracted fleet size; 100 × 20 t = 2,000 t ≈ 1.3% of TSMC use.** DVHardware's "200 million yuan = US$30,750" conversion is also internally inconsistent; do not use it. |
| trucked | TSMC + UMC trucked ~3,600 t ≈ 2% of STSP daily use | **Yes (figure); ambiguous (period)** | Tom's Hardware (above) | 3,600 / 175,000 = 2.06% ✓. The article does not clearly say whether 3,600 t is per day or a cumulative purchase. Present it as "about 2% of a day's use". |
| reservoir | Baoshan II at 14.62% in Feb 2021 | **Yes** | The Register, 24 Feb 2021: https://www.theregister.com/2021/02/24/tsmc_drought/ | Other outlets give 14.35–14.7% for slightly different times. It later fell to 3.7% (Wccftech). Primary source: Water Resources Agency (WRA) reservoir dashboard. |
| desal-plant / `cap.desal` | New Hsinchu desal facility ≈ 13,000 t/day | **Yes (better source found)** | WRA (primary), "Seawater desalination" page: https://www.wra.gov.tw/wrapen/cp.aspx?n=44729 | Earth.org never actually calls the 13,000 t/day facility "desalination". **WRA does**: an emergency desal unit was completed in Hsinchu (13,000 t/day) and another in Taichung (15,000 t/day) during the 2021 drought. Cite WRA. Context: a 100,000 m³/day Hsinchu SWRO plant (SUEZ/CTCI, NT$17.7B contract, 2024) is due around 2028: https://www.suez.com/en/news/press-releases/suez-wins-contract-taiwan-large-scale-municipal-seawater-desalination-plant-enhance-water-supply-stability-hsinchu-city |
| desal-cost / `desal.costAnchor` | Desal ≈ US$1/t, affordable mainly to big firms | **Yes** | Al Jazeera, "Taiwan faces water wake-up call as climate change intensifies", E. Hale, 20 Aug 2021: https://www.aljazeera.com/news/2021/8/20/taiwan-water-woes | Quote: "At about $1 per tonne it could be unaffordable for anyone other than companies like TSMC." It is not stated whether this includes capex. The same article gives ordinary water at "roughly 30 US cents" per tonne, which supports `price.municipal`. |
| tsmc-reclaim / `cap.recycle` | STSP recycling plant (Sept 2022) ≈ 10,000 t/day | **Mismatch** | CTCI press release, 19 Sep 2022: https://technode.global/prnasia/ctci-helps-top-chipmaker-tsmc-save-water-with-the-industrys-first-industrial-wastewater-reclamation-plant-for-chip-use/ ; CTCI newsletter: https://www.ctci.com/e-newsletter/EN/481/discover-reliable/article-01.html | The operator says 5,000 t/day at start-up, 20,000 t/day about a year later, 30,000 by 2026, and 67,000 long-term. The Diplomat (Sept 2024, https://thediplomat.com/2024/09/how-water-scarcity-threatens-taiwans-semiconductor-industry/) returned **403 and could not be checked**. Rewrite the fact to the CTCI numbers. |
| blackouts | Drought caused blackouts via reduced hydropower | **Partly / risky** | Verdict, 19 May 2021 (above) | Verdict: "phased blackouts... insufficient water for hydropower plants". Earth.org 2022 mentions "two large-scale electricity blackouts in less than one week" but **not hydropower**. The 13 May 2021 outage is generally attributed to a Hsinta power plant fault. Reword as "drought-reduced hydropower was cited as a factor in May 2021 power rationing (Verdict)". |
| `demand.fab` | 20,000 m³/day | **Yes** | Fortune (above) | Context: TSMC's STSP site alone uses up to 99,000 t/day (2023 reports), so a leading-edge "gigafab" can be about 5× larger. |
| `truck.capacity` | 20 m³/tanker | **Yes** | DVHardware; Wccftech; Bloomberg Opinion ("only around 20 tons per delivery"): https://www.bloombergquint.com/gadfly/making-chips-requires-lots-of-water-and-gulp-taiwan-has-a-drought | Range 10–25. |
| `scenario.drought2021.cut` | 0.11 | **Yes** | Wccftech, 24 Feb 2021 (above) | Earlier 6%, then 11%, then 13%, then 15% by June. |
| `scenario.drought2021.cutEscalated` | 0.15 | **Yes** | Taipei Times, 1 Jun 2021 (above); DVHardware (above) | Planned 17% was postponed (CNBC 19 May 2021: https://www.cnbc.com/2021/05/19/taiwan-steps-up-curbs-on-water-use-by-chip-hub-hsinchu-during-drought.html). |
| Surcharge (`policy.*`) | STSP surcharge above 9,000 m³/month | **Real, but national and seasonal** | Focus Taiwan, 6 Jan 2023: https://focustaiwan.tw/business/202301060016 ; Taipei Times, 8 Feb 2023: https://www.taipeitimes.com/News/feat/archives/2023/02/08/2003793941 ; UDN 2026 (full levy from 2026): https://udn.com/news/story/7238/9579443 | MOEA water consumption fee (耗水費): >9,000 m³ in a month **during Nov–Apr**, NT$3/m³, reduced to NT$2/NT$1 if the user meets recycling benchmarks. Halved through 2025, full from 2026 (about 1,300 users, about NT$600M/yr). The STSP saw an 18.9% drop in use in the first 5 months of 2023 (CommonWealth). It is **not** STSP-specific. Relabel it in the UI. |

---

## 2. Assumptions table

Conf. = confidence. "Keep ill.?" = whether to keep the `illustrative` status.

### Currency, prices, policy

| key | current | proposed | range | unit | source + URL | conf. | keep ill.? |
|---|---|---|---|---|---|---|---|
| fx.twdPerUsd | 32 | **32** | 31.5–33 | NT$/USD | 2026 mid-market range 31.77–32.63 (TrendForce chart to Nov 2026: https://datatrack.trendforce.com/Chart/content/1012/taiwan-ntdusd ; Wise history: https://wise.com/us/currency-converter/usd-to-twd-rate/history) | high | no (sourced) |
| price.municipal | 0.35 | **0.38** | 0.29–0.45 | USD/m³ | Taiwan Water Corp top tier NT$12.075/m³ (Taiwan News: https://www.taiwannews.com.tw/news/6060912); WRA average NT$9.24/t in 2021 (AmCham 2023: https://topics.amcham.com.tw/2023/04/after-25-years-cost-of-water-rises/); price hike under review in 2025 (Focus Taiwan: https://focustaiwan.tw/business/202503160006). High end = top tier +17% heavy-user uplift. | med-high | no |
| price.groundwater | 0.10 | 0.10 | 0.03–0.20 | USD/m³ | No good public source for an industrial groundwater fee in Taiwan. Pumping energy is modelled separately. | low | **yes** |
| price.seawater | 0 | 0 | 0–0.02 | USD/m³ | No intake fee found; there may be marine-use permit costs. | low | **yes** |
| price.reclaimed | 0.55 | **0.70** | 0.36–0.97 | USD/m³ | NCKU-led study: municipal reclaimed water costs NT$18.8–30.9/t excluding construction; Fengshan plant O&M NT$11.5/m³ (Sustainable Environment Research, 2023: https://sustainenvironres.biomedcentral.com/articles/10.1186/s42834-023-00177-8). Actual contract prices (Yongkang/TSMC) are not public. | med | no (sourced, as a cost proxy) |
| price.discharge | 0.40 | **0.48** | 0.25–0.80 | USD/m³ | Taichung Tanzi Technology Industrial Park sewer fee NT$15.42/m³ (2024 regulation: https://www.laws.taipei.gov.tw/lawatt/Law/A040100071005100-20240221-3000-004.pdf). Only one park found; Hsinchu Science Park and STSP schedules not found. | low-med | no (flag: single park) |
| price.brine | 0.05 | 0.05 | 0–0.20 | USD/m³ | No public source. | low | **yes** |
| price.electricity | 0.11 | **0.134** | 0.118–0.15 | USD/kWh | Industrial average NT$3.81 before +12.5% on 16 Oct 2024, then about NT$4.29 (Taipei Times, 1 Oct 2024: https://www.taipeitimes.com/News/front/archives/2024/10/01/2003824615 ; Focus Taiwan: https://focustaiwan.tw/business/202409300022). Overall average frozen at NT$3.7823 in Mar 2026 and again in Sep 2026 (Focus Taiwan: https://focustaiwan.tw/business/202603270015). High end allows for summer peak rates. | med-high | no |
| policy.surchargeThreshold | 9,000 | **9,000** | — | m³/month per user | MOEA water consumption fee, see fact table (Focus Taiwan 2023). **Dry season Nov–Apr only.** | high | no → **sourced** |
| policy.surchargeRate | 0.10 | **0.094** | 0.031–0.094 | USD/m³ | NT$3/m³ statutory; NT$2 or NT$1 if the user meets recycling benchmarks (TSMC reportedly pays NT$1) (UDN 2026: https://udn.com/news/story/7238/9579443). **Engine change suggested:** apply it to 6 of 12 months, or multiply by 0.5 for an annual average. | high | no |

### Energy (kWh/m³)

| key | current | proposed | range | unit | source + URL | conf. | keep ill.? |
|---|---|---|---|---|---|---|---|
| energy.filter | 0.05 | 0.05 | 0.02–0.10 | kWh/m³ | Media filtration is mostly backwash plus pumping. No specific source. | low | **yes** |
| energy.process | 0.20 | 0.20 | 0.10–0.30 | kWh/m³ | Typical UF range; no single citable source found. | low | **yes** |
| energy.ro | 0.80 | **0.90** | 0.50–1.50 | kWh/m³ | RO on tap or groundwater feed: 0.83–1.20 kWh/m³ (Sustainable Environment Research 2022, Table 3: https://sustainenvironres.biomedcentral.com/articles/10.1186/s42834-022-00145-8) | med | no |
| energy.desal | 3.5 | **3.5** | 3.0–4.5 | kWh/m³ | Full-plant SWRO 3.5–4.5 kWh/m³ including pre- and post-treatment (Canary Islands study, *Water* 16:910, 2024: https://accedacris.ulpgc.es/bitstream/10553/129736/1/water-16-00910.pdf); best-practice membranes about 3 (EcoMENA: https://www.ecomena.org/economics-of-desalination-and-local-integration-capex-opex-and-industrial-dynamics) | high | no |
| energy.polish | 0.60 | **0.50** | 0.30–1.00 | kWh/m³ | EDI 0.35–0.66 kWh/m³ (OSTI, resin-wafer EDI: https://www.osti.gov/biblio/1638484), plus UV about 0.05–0.1. Real UPW loops with recirculation run higher. | low-med | no (low conf.) |
| energy.recycle | 1.2 | 1.2 | 0.8–2.5 | kWh/m³ | Fab wastewater UF+RO+polish. No public kWh figure found (IDE, Gradiant and Veolia pages give none). | low | **yes** |
| energy.groundwaterPump | 0.4 | 0.4 | 0.2–0.8 | kWh/m³ | **Derived:** E = ρgh/η, which gives 0.39 kWh/m³ for 100 m head at 70% pump efficiency. | med (physics) | derived |
| energy.seawaterPump | 0.3 | 0.3 | 0.1–0.5 | kWh/m³ | **Derived:** same formula, about 50–70 m total dynamic head including intake screens and pipeline. Often included in the SWRO 3.5–4.5 figure, so check for double counting. | low-med | derived; **check double count** |

### Treatment performance

| key | current | proposed | range | unit | source + URL | conf. | keep ill.? |
|---|---|---|---|---|---|---|---|
| recovery.filter | 0.98 | 0.98 | 0.95–0.99 | fraction | Backwash loss of 1–5% (standard practice) | med | **yes** |
| recovery.process | 0.95 | 0.95 | 0.90–0.98 | fraction | UF backwash and CEB losses (standard practice) | med | **yes** |
| recovery.ro | 0.75 | 0.75 | 0.65–0.90 | fraction | Conventional 2-stage RO recovery is about 75% (pilot UF + 2-stage RO targeting >75%); high-recovery semicon systems reach 96% (Gradiant: https://gradiant.com/success-stories/one-integrated-platform-zero-discharge-indias-first-semiconductor-fab/) | med | no |
| recovery.polish | 0.95 | 0.95 | 0.90–0.98 | fraction | EDI product recovery is typically 90–95% (vendor norm) | low-med | **yes** |
| recovery.recycle | 0.70 | 0.70 | 0.50–0.90 | fraction | TSMC recycled about 87% of manufacturing water in 2019 (Fortune); single-plant system recovery up to 96% (Gradiant). The 40–70% Swarajya figure could not be verified. Keep 0.7 as a mid-plant figure. | med | no |
| desal.brineFraction | 0.55 | 0.55 | 0.50–0.65 | fraction of feed | SWRO recovery is about 40–50%, so brine is about 50–60% of feed (standard; the Canary Islands study above) | med-high | no |
| varcost.filter | 0.01 | 0.01 | 0.005–0.03 | USD/m³ | No source | low | **yes** |
| varcost.process | 0.02 | 0.02 | 0.01–0.05 | USD/m³ | No source | low | **yes** |
| varcost.ro | 0.05 | 0.05 | 0.03–0.10 | USD/m³ | No source | low | **yes** |
| varcost.desal | 0.615 | **0.53** | 0.30–0.80 | USD/m³ | **Derived** to keep the US$1/t anchor: 1.0 − 3.5 kWh × 0.134. World Bank (2019) puts total SWRO opex at US$0.50–1.00/m³ with energy 30–50%. | med | derived |
| varcost.polish | 0.10 | 0.10 | 0.05–0.30 | USD/m³ | No source | low | **yes** |
| varcost.recycle | 0.15 | 0.15 | 0.10–0.40 | USD/m³ | Singapore PUB guide: total recycling opex US$0.20–1.40/m³ depending on stream (https://info.pub.gov.sg/Documents/Water_Efficiency_Wafer_Fabrication_Semiconductor_v2.pdf). 0.15 + 1.2 × 0.134 = 0.31, which is inside that range. | low-med | no (low conf.) |
| desal.costAnchor | 1.0 | **1.0** | 0.5–1.5 | USD/t | Al Jazeera 2021 (verified); World Bank opex US$0.5–1.0 | med | no |

### Capacity

| key | current | proposed | range | unit | source + URL | conf. | keep ill.? |
|---|---|---|---|---|---|---|---|
| cap.desal | 13,000 | **13,000** | 13,000–100,000 | m³/day | WRA (emergency Hsinchu unit, 2021); 100,000 m³/day plant due about 2028 (SUEZ) | high | no |
| cap.recycle | 10,000 | **20,000** | 5,000–30,000 | m³/day | CTCI (5,000 at start, then 20,000, then 30,000 by 2026) | high | no |
| cap.municipal, cap.groundwater, cap.seawater, cap.reclaimed, cap.filter, cap.process, cap.ro, cap.polish, storage.volume | as-is | as-is | — | m³/day, m³ | Site design choices; no public source applies. Note: STSP + Yongkang reclaimed supply is about 62,500 m³/day combined (market report), so a 15,000 m³/day neighbour supply is plausible. | — | **yes** |

### Capex (USD) and fixed O&M (USD/yr)

General rule: fixed O&M is about 2–5% of capex per year. All current O&M defaults fall inside this band (for example desal 1.5M / 40M = 3.75%).

| key | current | proposed | range | unit | source + URL | conf. | keep ill.? |
|---|---|---|---|---|---|---|---|
| capex.desal | 40M | **40M** | 20M–70M | USD | 13,000 m³/day × US$1,500 per m³/day (low end of the small-plant range; large SWRO is about US$800–1,500 per m³/day, per EcoMENA) gives about 20M. The Taiwan Hsinchu contract is NT$17.7B / 100,000 m³/day, about US$5,400 per m³/day, but that **includes long-term O&M**; government capex is about NT$12B, or about US$3,750 per m³/day (Taiwan News: https://www.taiwannews.com.tw/en/news/5895709). 40M ≈ US$3,080 per m³/day. | med | no (cite range) |
| capex.polish | 15M | 15M | 10M–40M | USD | Veolia: a complete fab UPW system costs US$25–40M (1–1.5% of fab capex): https://www.middle-east.veoliawatertechnologies.com/sites/g/files/dvc3051/files/document/2021/07/190432_VWT_SEA_Microelectronics_Industry_Brochure_LR.pdf. The polishing stage alone is a share of that. | low-med | no (low conf.) |
| capex.recycle | 25M | 25M | 15M–50M | USD | About US$2,500 per m³/day at 10,000 m³/day. No public $/m³/day figure for fab reclamation was found; the CTCI/TSMC contract value is not disclosed. | low | **yes** |
| capex.ro | 12M | 12M | 7M–25M | USD | About US$340 per m³/day at 35,000; industrial brackish RO is typically US$200–700 per m³/day (no single citable source found) | low | **yes** |
| capex.filter, .process, .storage, .brine, .seawater, .groundwater, .reclaimed (plus the new keys listed below) | as-is | as-is | ±50% | USD | No public source | low | **yes** |
| om.* (all) | as-is | as-is | 2–5% of capex/yr | USD/yr | Rule of thumb only | low | **yes** |

### Demand, efficiency and consumptive fractions

| key | current | proposed | range | unit | source + URL | conf. | keep ill.? |
|---|---|---|---|---|---|---|---|
| demand.fab | 20,000 | 20,000 | 10,000–99,000 | m³/day | Fortune/CWR (verified); TSMC STSP up to 99,000 t/day | high | no |
| demand.fabWet / fabCmp / fabCleanroom / coolingTower / office / fire / chiller / dcLiquid | as-is | as-is | — | m³/day | No public breakdown of fab water by bay. | — | **yes** |
| demand.evap | 3,500 | 3,500 | 400–5,000 | m³/day | 1.8 L/kWh (LBNL 2016 average WUE) gives about 43 m³/day per MW IT, so 3,500 ≈ an 80 MW campus. Evaporative sites can run 3–8 L/kWh (Data Center Knowledge: https://www.datacenterknowledge.com/cooling/data-center-water-use-from-efficiency-metrics-to-real-world-resilience). **Show the MW assumption in the UI.** | med | no (derived) |
| demand.neighborFab / neighborDc | as-is | as-is | — | m³/day | Follows fab/DC defaults | — | **yes** |
| eff.opt | 0.10 | 0.10 | 0.05–0.30 | fraction | Singapore PUB wafer-fab efficiency guide (above) lists rinse and process optimisation measures but gives no single % | low | **yes** |
| eff.leak / eff.meter | 0.05 / 0.02 | as-is | 0.01–0.10 | fraction | No public source for fab-campus leak or metering savings | low | **yes** |
| *(if a cooling-tower upgrade lever is re-added)* | — | 0.20 | 0.10–0.30 | fraction | US DOE FEMP BMP #10: raising cycles from 3 to 6 cuts makeup by 20% (https://www.energy.gov/node/849241) | high | sourced |
| consumptive.coolingTower | 0.75 | 0.75 | 0.67–0.83 | fraction | **Derived:** evaporation/makeup = (C−1)/C, which is 0.67 at 3 cycles and 0.83 at 6 (DOE BMP #10 mass balance). 0.75 means 4 cycles. | high (physics) | derived |
| consumptive.evap | 0.85 | 0.85 | 0.67–0.90 | fraction | Same formula; 0.85 means about 6.7 cycles, which is at the high end | med | derived |
| consumptive.chiller | 0.70 | 0.70 | 0.60–0.83 | fraction | Same formula (chiller condenser tower) | med | derived |
| consumptive.fab | 0.20 | 0.20 | 0.10–0.30 | fraction | No public source | low | **yes** |
| consumptive.office / fire / gate / dcLiquid | as-is | as-is | — | fraction | No source | low | **yes** |
| demand.gate | 5 | 5 | — | m³/day | No source | low | **yes** |

### Keys added by the engine session during this research (all keep illustrative)

`price.river`, `price.rain`, `energy.riverPump`, `energy.softener`, `energy.wwt`, `recovery.softener`, `recovery.wwt`, `varcost.softener`, `varcost.wwt`, `cap.river`, `cap.rain`, `cap.softener`, `cap.wwt`, `rain.droughtAvail`, `capex.river`/`rain`/`softener`/`wwt`/`leak`/`meter`/`opt`, and `om.river`/`rain`/`softener`/`wwt`/`leak`/`meter`/`opt`. No Taiwan-specific public source was found for these, so **keep them illustrative**. One contextual point: Taiwan's river-water abstraction is allocated by WRA water rights rather than priced per m³, so `price.river` is closer to 0 than to the municipal tariff.

### Downtime and drought response

| key | current | proposed | range | unit | source + URL | conf. | keep ill.? |
|---|---|---|---|---|---|---|---|
| downtime.fab | 500,000 | **1,000,000** | 500,000–5,000,000 | USD/hour | Schneider Electric: "more than $1 to $2 million per hour" for advanced fabs (Jul 2026: https://blog.se.com/energy-management-energy-efficiency/2026/07/30/why-is-power-quality-so-critical-in-semiconductor-fabs/); TSMC 2018 virus booked about NT$2.6B in Q3 2018 for about 3 days (TSMC 2018 Annual Report p.230: https://investor.tsmc.com/static/annualReports/2018/english/ebook/files/basic-html/page230.html), about US$1.2M/hour. Samsung reportedly lost about US$43M in a 30-minute 2019 outage (secondary source). | med | no |
| downtime.datacenter | 150,000 | **300,000** | 100,000–1,000,000 | USD/hour | Ponemon 2016: US$8,851/min ≈ US$531k/hour average (Statista: https://statista.com/statistics/666816/united-states-data-centers-unplanned-outage-cost-per-minute); Uptime 2024: 54% of last major outages cost >US$100k and 20% >US$1M (https://uptimeinstitute.com/resources/research-and-reports/annual-outage-analysis-2024) | med | no |
| downtime.support | 5,000 | 5,000 | 1,000–20,000 | USD/hour | No source | low | **yes** |
| downtime.fabArea | 150,000 | **300,000** | 150,000–1,500,000 | USD/hour | **Derived:** about 30% of the proposed whole-fab figure. No public sub-area figure. | low | derived |
| downtime.datacenterXL | 300,000 | **600,000** | 300,000–2,000,000 | USD/hour | **Derived:** 2× the proposed data-center default; Ponemon average US$531k/hour; Uptime 2024: 20% of outages >US$1M | low-med | derived |
| truck.capacity | 20 | 20 | 10–25 | m³/tanker | Verified, see fact table | high | no |
| truck.tripCost | 100 | **1,000** | 300–1,500 | USD/trip | Wccftech citing Liberty Times: "20 tons... at a cost of $1,000/truck" (NT$30,000) (https://wccftech.com/tsmc-using-water-tankers-for-chip-production-as-5nm-plant-faces-rationing/). This is a single secondary source; the Liberty Times original was not retrieved. | low-med | no (flag) |
| truck.maxPerDay | 200 | 200 | 50–500 | tankers/day | No source; site logistics limit. TSMC contracted a fleet of 100+ trucks (2021 reports). | low | **yes** |

### Scenarios

| key | current | proposed | range | unit | source + URL | conf. | keep ill.? |
|---|---|---|---|---|---|---|---|
| scenario.normal.* | 1 / 0 / 0 / 1 | as-is | — | — | Baseline definitions | — | **yes** (by definition) |
| scenario.drought2021.priceMultiplier | 1 | 1 | 1–1.1 | × | Tariffs were not raised during the 2021 drought; the dry-season surcharge came in 2023 | med | no |
| scenario.drought2021.droughtDays | 120 | **125** | 90–180 | days/yr | Hsinchu industrial cuts were in force by 24 Feb 2021 (Wccftech; an earlier 6% stage preceded them) and were lifted 30 Jun – 1 Jul 2021 (Taipei Times, 1 Jul 2021: https://taipeitimes.com/News/biz/archives/2021/07/01/2003760077), about 125 days. Counting from the earlier 6% stage gives up to about 180. | med | no |
| scenario.drought2021.cut / cutEscalated | 0.11 / 0.15 | 0.11 / 0.15 | 0.06–0.17 | fraction | Verified, see fact table | high | no |
| scenario.drought2021.groundwaterAvail | 0.9 | 0.9 | 0.7–1.0 | fraction | No source (chipmakers drilled emergency wells in 2021) | low | **yes** |
| scenario.stress2035.* / stress2050.* | as-is | as-is | price × 1.1–1.5 (2035), 1.2–2.0 (2050); drought days 30–150 | — | **No published projection gives these directly.** Context that can be cited: (a) TCCIP 2024 National Scientific Report: dry-season (Nov–Apr) rainfall projected to fall in most regions, longer dry seasons in the south (Tainan), and under RCP8.5 supply falls 3.3–6.0% in the north and 2.7% in the south (https://tccip.ncdr.nat.gov.tw/ScientificReport2024/dl_chapter_4.aspx); (b) Taoyuan study: 40 extreme meteorological drought events projected for 2041–2060 (EGU25-6162: https://meetingorganizer.copernicus.org/EGU25/EGU25-6162.html); (c) a pending tariff review targets heavy users +10–17%; (d) severe droughts recurred in 2015, 2021 and 2023. | low | **yes**, but cite the TCCIP context in the UI |

### Disruption risk, energy-water coupling, finance

| key | current | proposed | range | unit | source | conf. | keep ill.? |
|---|---|---|---|---|---|---|---|
| risk.hours.* (5) | as-is | as-is | 12–168 | hours | No public outage statistics by source type | low | **yes** |
| risk.p.* (20) | as-is | as-is | — | per year | No public source. One defensible anchor: three severe Taiwan droughts in 9 years (2015, 2021, 2023) means about 0.3/yr for a drought-type supply event. This roughly supports `risk.p.municipal.stress2050 = 0.3`. | low | **yes** |
| coupling.elecMultiplier | 1.25 | 1.25 | 1.0–1.5 | × | No drought-linked electricity price exists in Taiwan (tariffs are regulated and were frozen in 2026). The real coupling is rationing or blackout risk, not price. | low | **yes** |
| coupling.energyIntensiveAvail | 0.85 | 0.85 | 0.7–1.0 | fraction | No source | low | **yes** |
| finance.discountRate | 0.08 | 0.08 | 0.05–0.12 | fraction/yr | Corporate WACC convention; no Taiwan-specific source pulled | low | **yes** |
| finance.horizonYears | 10 | 10 | 10–20 | years | Convention; the CTCI/TSMC reclamation contract runs 20 years | med | **yes** |

---

## 3. Riskiest numbers for a live pitch

1. **"~100 tankers/day would cover TSMC."** This is arithmetically false (100 × 20 t = 2,000 t vs 156,000 t/day). Replace it with: "an 11% cut at one average fab (20,000 m³/day) is about 110 tanker trips a day."
2. **Trucked water at US$1,000 per trip (US$50/m³).** This comes from a single secondary source (Wccftech citing Liberty Times). It drives the "cost of doing nothing" headline, so present it as a range (US$300–1,500/trip).
3. **The TSMC STSP reclamation plant at 10,000 t/day.** The operator says 20,000 now and 30,000 targeted, so it is easy for a judge to catch. Use the CTCI figures.
4. **"Drought caused blackouts."** This is contested; the May 2021 blackout is usually blamed on a power plant fault. Hedge it or drop it.
5. **Fab downtime of US$1M/hour.** It is defensible (Schneider; the TSMC 2018 virus loss) but varies about 10× by fab node and size. Show it as an editable input, not a fact.
6. **The surcharge.** Say "Taiwan's MOEA dry-season water consumption fee (Nov–Apr), NT$3/m³ over 9,000 m³/month", not "Southern Taiwan Science Park surcharge", and do not apply it all year.
7. **2035/2050 scenario multipliers.** No source gives them. Label them clearly as stress tests and cite TCCIP only as directional context.
8. **"40–70% recycling (Swarajya)."** Not verified; use TSMC's 87% (2019).
