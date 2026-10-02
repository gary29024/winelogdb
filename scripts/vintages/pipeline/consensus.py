"""Critics' consensus: one quality rating per year and colour from several critics.

Input: a long table of published vintage ratings (source,year,colour,area,score,
scale_min,scale_max,source_url,note), each on its own scale. The table itself
stays outside the repository; only the consensus is committed, as
scripts/vintages/data/critic_consensus.csv.

Each critic is treated as a noisy, linearly scaled view of one shared quality
per year:  score[critic, year] = a[critic] + b[critic] * quality[year] + noise.
The fit alternates between the critics' scales and the yearly qualities, and
weights each critic by how closely it agrees with the others, so no one
critic sets the answer. The result is expressed in Decanter-star equivalents
(1 poor ... 5 excellent), only to give the numbers a familiar scale.

    python scripts/vintages/pipeline/consensus.py <ratings.csv>
"""
from __future__ import annotations

import csv
import statistics as st
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'scripts/vintages/data/critic_consensus.csv'
# Two Decanter tables rate the same vintages: count Decanter once, preferring the vintage guide.
MERGE = {'Decanter (vintage guide)': 'Decanter', 'Decanter (en primeur report table)': 'Decanter'}
PREFER = ['Decanter (vintage guide)', 'Decanter (en primeur report table)']
# A single grower's blog, with some scores shared between colours: not a critic's chart.
EXCLUDE = {'Patrick Essa (degustateurs.pro)'}
# Côte d'Or rows where a source has them; whole-Burgundy rows otherwise.
AREA_RANK = {'cote-d-or': 0, 'cote-de-nuits': 0, 'cote-de-beaune': 0, 'burgundy': 1}
SCALE_SOURCE = 'Decanter'


def load(path: str) -> dict[str, dict[tuple[str, int], float]]:
    rows = defaultdict(list)
    for r in csv.DictReader(open(path)):
        if r['source'] in EXCLUDE or not r['score']:
            continue
        rows[(r['source'], r['colour'], int(r['year']))].append(r)
    picked: dict[tuple[str, str, int], tuple[int, float]] = {}
    for (source, colour, year), rs in rows.items():
        best = min(AREA_RANK.get(r['area'], 2) for r in rs)
        value = st.mean(float(r['score']) for r in rs if AREA_RANK.get(r['area'], 2) == best)
        critic = MERGE.get(source, source)
        rank = PREFER.index(source) if source in PREFER else 0
        key = (critic, colour, year)
        if key not in picked or rank < picked[key][0]:
            picked[key] = (rank, value)
    out: dict[str, dict[tuple[str, int], float]] = defaultdict(dict)
    for (critic, colour, year), (_, value) in picked.items():
        out[colour][(critic, year)] = value
    return out


def consensus(scores: dict[tuple[str, int], float]):
    critics = sorted({c for c, _ in scores})
    years = sorted({y for _, y in scores})
    # Start: each critic's scores standardised, averaged per year.
    z = {}
    for c in critics:
        vals = [v for (cc, _), v in scores.items() if cc == c]
        m, s = st.mean(vals), st.pstdev(vals) or 1
        for (cc, y), v in scores.items():
            if cc == c:
                z[(c, y)] = (v - m) / s
    q = {y: st.mean(z[(c, yy)] for (c, yy) in z if yy == y) for y in years}
    weight = {c: 1.0 for c in critics}
    for _ in range(200):
        scale = {}
        for c in critics:
            pts = [(q[y], v) for (cc, y), v in scores.items() if cc == c]
            mx, my = st.mean(p[0] for p in pts), st.mean(p[1] for p in pts)
            b = sum((x - mx) * (v - my) for x, v in pts) / (sum((x - mx) ** 2 for x, _ in pts) or 1)
            scale[c] = (my - b * mx, b)
            resid = [v - scale[c][0] - b * x for x, v in pts]
            weight[c] = 1 / max(st.mean(r * r for r in resid) / (b * b or 1), 0.05)   # noise in quality units
        new = {}
        for y in years:
            terms = [(c, v) for (c, yy), v in scores.items() if yy == y]
            num = sum(weight[c] * (v - scale[c][0]) / scale[c][1] for c, v in terms if scale[c][1])
            den = sum(weight[c] for c, _ in terms if scale[c][1])
            new[y] = num / den
        m, s = st.mean(new.values()), st.pstdev(new.values())
        new = {y: (v - m) / s for y, v in new.items()}
        if max(abs(new[y] - q[y]) for y in years) < 1e-6:
            q = new
            break
        q = new
    a, b = scale[SCALE_SOURCE]
    rating = {y: min(max(a + b * q[y], 1.0), 5.0) for y in years}
    members = {y: sorted(c for (c, yy) in scores if yy == y) for y in years}
    agreement = {}
    for c in critics:
        pts = [(v, q[y]) for (cc, y), v in scores.items() if cc == c]
        agreement[c] = (round(st.correlation([p[0] for p in pts], [p[1] for p in pts]), 2) if len(pts) > 2 else None, len(pts))
    return rating, members, agreement, weight


def main() -> None:
    by_colour = load(sys.argv[1])
    with open(OUT, 'w', newline='') as sink:
        sink.write('# Critics\' consensus quality per vintage (Côte d\'Or where rated, else Burgundy), from\n'
                   '# scripts/vintages/pipeline/consensus.py. rating: Decanter-star equivalents, 1 poor ... 5 excellent.\n'
                   '# sources: the critics averaged that year, each weighted by its agreement with the others.\n')
        w = csv.writer(sink, lineterminator='\n')
        w.writerow(['year', 'colour', 'rating', 'n_sources', 'sources'])
        for colour in ('red', 'white'):
            rating, members, agreement, weight = consensus(by_colour[colour])
            total = sum(weight.values())
            print(colour, 'critics (correlation with consensus, years, share of weight):')
            for c, (r, n) in sorted(agreement.items(), key=lambda kv: -(kv[1][0] or 0)):
                print(f'   {c}: r={r}, {n} years, weight {weight[c] / total:.0%}')
            for y in sorted(rating):
                w.writerow([y, colour, round(rating[y], 2), len(members[y]), '|'.join(members[y])])


if __name__ == '__main__':
    main()
