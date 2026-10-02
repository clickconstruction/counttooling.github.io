#!/usr/bin/env python3
"""The market model behind the deck's "Ways to get paid" slide (slides/revenue-paths.html).

Run it to reprint the table; change a constant to re-plan. Every cell on the slide reads low
(pessimistic) to high (optimistic). Sources and the day they were read are in the comments.

    python3 deck/model/revenue_paths.py
"""

# US plumbing + HVAC + electrical contractor establishments by size class, private employers.
# BLS QCEW, first quarter 2024, NAICS 23821 + 23822 (data.bls.gov/cew/data/api/2024/1/size/<n>.csv).
SHOPS = {'<5': 132821, '5-9': 38131, '10-19': 24434, '20-49': 15981, '50-249': 7706, '250+': 695}
# March 2024 employment in those classes, same source; the total is 2,336,726.
EMP = {'<5': 208464, '5-9': 251435, '10-19': 329199, '20-49': 481929, '50-249': 729195}
EMP_TOTAL = 2_336_726
MEP_REVENUE = 390e9          # electrical ~$173B + plumbing/HVAC ~$218B a year (Vertical IQ, 2024)
ALL_TRADE_SHOPS = 588_440    # every specialty trade contractor establishment, NAICS 238, QCEW 2024
COMMERCIAL_GCS = 57_264      # nonresidential building construction establishments, NAICS 236220, QCEW 2024
INTERNATIONAL = 1.45         # Canada, the UK and Australia on top of the US, path 1's high case only

# Annual contract value per shop by size. Low = seat pricing like STACK/PlanSwift plus a bid platform
# priced under ServiceTitan; high = the same plus robot bids at ~$250 each, 60 to 1,000 bids a year.
SOFTWARE = {'10-19': 5e3, '20-49': 10e3, '50-249': 20e3, '250+': 50e3}
ROBOT = {'10-19': 20e3, '20-49': 45e3, '50-249': 120e3, '250+': 300e3}

TEN_PLUS = sum(SHOPS[k] for k in SOFTWARE)                  # 48,816
MID = {k: SHOPS[k] for k in ('10-19', '20-49', '50-249')}  # 48,121: the shops a sales team can reach
TINY = SHOPS['<5'] + SHOPS['5-9']                           # 170,952: shops with no estimator
MID_SHARE = sum(EMP[k] for k in MID) / EMP_TOTAL            # 0.66 of MEP employment, so of revenue
TEN_PLUS_SHARE = 1 - (EMP['<5'] + EMP['5-9']) / EMP_TOTAL   # 0.80
BIDS_FROM_PLANS = (0.40, 0.70)                              # share of 10–249 shops that bid plan-and-spec work
SOM = (0.01, 0.05)                                          # share of SAM won in 3–5 years
SOM_SELF_SERVE = (0.02, 0.08)                               # path 2 sells itself


def fmt(x):
    if x >= 1e9:
        return f'${x / 1e9:.1f}B'
    if x >= 10e6:
        return f'${x / 1e6:.0f}M'
    return f'${x / 1e6:.1f}M'


def path(name, tam, sam, som=SOM):
    return (name, tam[0], tam[1], sam[0], sam[1], sam[0] * som[0], sam[1] * som[1])


rows = []
# 1 · shops with estimators: seats plus robot bids
tam = (sum(SHOPS[k] * SOFTWARE[k] for k in SOFTWARE),
       (sum(SHOPS[k] * ROBOT[k] for k in ROBOT) + SHOPS['5-9'] * 6e3) * INTERNATIONAL)
sam = (BIDS_FROM_PLANS[0] * sum(MID[k] * SOFTWARE[k] for k in MID),
       BIDS_FROM_PLANS[1] * sum(MID[k] * ROBOT[k] for k in MID))
rows.append(path('1 · Shops with estimators', tam, sam))
# 2 · shops with no estimator: audited robot bids, 10–15 a year at $250–$350
rows.append(path('2 · Shops with no estimator',
                 (SHOPS['5-9'] * 10 * 250, TINY * 15 * 350),
                 (0.25 * SHOPS['5-9'] * 10 * 250, 0.30 * TINY * 15 * 350), SOM_SELF_SERVE))
# 3 · the job after the win: the operating platform at $20k–$60k a shop
rows.append(path('3 · The job after the win',
                 (TEN_PLUS * 20e3, TEN_PLUS * 60e3 + SHOPS['5-9'] * 6e3),
                 (BIDS_FROM_PLANS[0] * sum(MID.values()) * 20e3, BIDS_FROM_PLANS[1] * sum(MID.values()) * 60e3)))
# 4 · a share of the work won: 0.5%–1.5% of plan-and-spec revenue (30%–40% of the trades' revenue)
tam = (0.30 * MEP_REVENUE * 0.005, 0.40 * MEP_REVENUE * 0.015)
rows.append(path('4 · A share of the work won', tam, (MID_SHARE * tam[0], MID_SHARE * tam[1])))
# 5 · every specialty trade: path 1 scaled to all of NAICS 238, same size mix, US only
scale = ALL_TRADE_SHOPS / sum(SHOPS.values())
rows.append(path('5 · Every specialty trade',
                 (rows[0][1] * scale, rows[0][2] / INTERNATIONAL * scale),
                 (rows[0][3] * scale, rows[0][4] * scale)))
# 6 · money on the flow: 0.3%–1% of the revenue flowing through path-3 customers
rows.append(path('6 · Money on the flow',
                 (TEN_PLUS_SHARE * MEP_REVENUE * 0.003, TEN_PLUS_SHARE * MEP_REVENUE * 0.010),
                 (BIDS_FROM_PLANS[0] * MID_SHARE * MEP_REVENUE * 0.003, BIDS_FROM_PLANS[1] * MID_SHARE * MEP_REVENUE * 0.010)))
# 7 · numbers for GCs: robot trade numbers for commercial general contractors, $10k–$35k a year
rows.append(path('7 · Numbers for GCs',
                 (0.30 * COMMERCIAL_GCS * 10e3, COMMERCIAL_GCS * 35e3),
                 (0.40 * 0.30 * COMMERCIAL_GCS * 10e3, 0.60 * COMMERCIAL_GCS * 35e3)))
# the stack the deck recommends: 2 + 3 + 6 (a plain sum; read its high SOM as a ceiling)
stack = [rows[i] for i in (1, 2, 5)]
rows.append(('Stack: 2 + 3 + 6', *[sum(r[j] for r in stack) for j in range(1, 7)]))

if __name__ == '__main__':
    print(f"{'Revenue path':30} {'TAM':>16} {'SAM':>16} {'SOM 3–5 yrs':>16}")
    for r in rows:
        print(f"{r[0]:30} {fmt(r[1]) + ' – ' + fmt(r[2]):>16} {fmt(r[3]) + ' – ' + fmt(r[4]):>16} {fmt(r[5]) + ' – ' + fmt(r[6]):>16}")
