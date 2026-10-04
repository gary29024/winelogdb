"""Which wine region the vintage pipeline is building, and what differs between regions.

Every pipeline script reads its paths and region facts from here. The region is
chosen with the VINTAGE_REGION environment variable (default: burgundy):

    VINTAGE_REGION=bordeaux python scripts/vintages/pipeline/build.py

Grape parameters: véraison is the GFV heat sum from 1 March (Parker et al. 2013,
Agric. For. Meteorol. 180:249); sugar200 the GSR heat sum from 1 April to reach
200 g/L (Parker et al. 2020, Agric. For. Meteorol. 285-286:107902). Both use the
daily mean temperature above 0 °C.
"""
from __future__ import annotations

import csv
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
# Sémillon's heat sum to 200 g/L is not published; see the Bordeaux 'sources' note.
SEMILLON_SUGAR200 = 2963.0

REGIONS: dict[str, dict] = {
    'burgundy': {
        'data': ROOT / 'scripts/vintages/data',
        'out': ROOT / 'public/data/vintages/burgundy',
        'cache': ROOT / 'scripts/vintages/cache',
        'areas': ['chablis-auxerrois', 'cote-de-nuits', 'hautes-cotes', 'cote-de-beaune', 'cote-chalonnaise', 'maconnais'],
        'grapes': {
            'pinot-noir': {'sugar200': 2840.0, 'veraison': 2511.0, 'colour': 'red'},
            'chardonnay': {'sugar200': 2890.0, 'veraison': 2547.0, 'colour': 'white'},
        },
        # The grape whose ripeness sets estimated harvest dates.
        'harvest_grape': 'pinot-noir',
        # The area whose recorded dates anchor the others' estimates.
        'anchor_area': 'cote-de-beaune',
        # Fallback calibration: a village and its long-run mean harvest start (day of year).
        # Beaune, 15 September: Labbé et al. 2019, 1988-2018.
        'calibration': ('beaune', 258),
        'blends': {},
        # Quality outlook: per grape, the critics' group it is fitted on (Burgundy: by colour,
        # rated for the Côte d'Or as a whole), the areas that group covers, and its inputs.
        'quality': {
            'pinot-noir': {'groups': {'red': ['cote-de-nuits', 'cote-de-beaune']}, 'min_sugar': 180,
                           'inputs': ['ripeness', 'warmth', 'heat', 'wet', 'harvestRain', 'hail']},
            'chardonnay': {'groups': {'white': ['cote-de-nuits', 'cote-de-beaune']}, 'min_sugar': 178,
                           'inputs': ['ripeness', 'warmth', 'heat', 'wet', 'harvestRain', 'acidity', 'hail']},
        },
        # Method notes shown under "How we estimate", after the shared weather sources.
        'sources': [
            {'label': 'Sugar', 'detail': 'Grapevine Sugar Ripeness model (Parker et al., 2020): 200 g/L at a temperature sum from 1 April of 2840 (Pinot Noir) and 2890 (Chardonnay), then matched to the must sugar measured by the BIVB maturity network (maturite.bivb.com) in every area of the page from about 1990 (1988 in the Côte d’Or). Earlier years use a correction from the season’s warmth, rain and year, fitted on those measurements (held-out error about 10 g/L, against 14 for the model alone).'},
            {'label': 'Véraison', 'detail': 'Grapevine Flowering Véraison model (Parker et al., 2013): temperature sum above 0 °C from 1 March of 2511 (Pinot Noir) and 2547 (Chardonnay). Vineyard temperatures are raised 1.1 °C for this model to match the stations it was fitted on; that offset was fitted on BIVB flowering dates and lands véraison within 4.3 days of BIVB’s observed 2016–2025 dates on average.'},
            {'label': 'Harvest', 'detail': 'Official or reported start dates where a source records one — an official ban, the Hospices de Beaune, the BIVB or the wine press. Other years are estimated as the day Pinot Noir reaches the sugar level that area’s recorded starts were picked at, or, without enough records, the level that matches Beaune’s recorded 1988–2018 average start of 15 September (Labbé et al., 2019).'},
            {'label': 'Frost and hail', 'detail': 'Spring frosts and hailstorms a grower body or the wine press dates to at least the month, kept by hand because an 8 km grid cannot see them; each links to its source.'},
        ],
    },
    'bordeaux': {
        'data': ROOT / 'scripts/vintages/data/bordeaux',
        'out': ROOT / 'public/data/vintages/bordeaux',
        'cache': ROOT / 'scripts/vintages/cache/bordeaux',
        # Harvest areas. The red communes sit on either bank; Pessac-Léognan's white grapes are
        # picked weeks before its reds and keep their own dates ('dry-white'); Sauternes and Barsac
        # pick their botrytised Sémillon by successive passes from about mid-September.
        'areas': ['left-bank', 'right-bank', 'dry-white', 'sauternes'],
        # A white grape grown in a red area is harvested on that colour's own dates.
        'colour_areas': {'white': {'left-bank': 'dry-white'}},
        # SAFRAN relative humidity, for Sauternes' noble-rot days.
        'humidity': True,
        'noble_rot_areas': ['sauternes'],
        # Sauternes is picked once noble rot has set in, never below the legal 221 g/L (INAO).
        'pick_sugar': {'sauternes': {'sugar': 221, 'basis': 'legal minimum'}},
        # GFV véraison: Parker 2012 thesis Table 3-2 (= AFM 2013). GSR 200 g/L: read from Fig. 3 of
        # van Leeuwen et al. 2019 (Agronomy 9:514), as for Pinot noir and Chardonnay (±5 °C·d).
        'grapes': {
            'merlot': {'sugar200': 2856.0, 'veraison': 2636.0, 'colour': 'red'},
            'cabernet-sauvignon': {'sugar200': 3030.0, 'veraison': 2689.0, 'colour': 'red'},
            'cabernet-franc': {'sugar200': 2909.0, 'veraison': 2692.0, 'colour': 'red'},
            'sauvignon-blanc': {'sugar200': 2820.0, 'veraison': 2528.0, 'colour': 'white'},
            'semillon': {'sugar200': SEMILLON_SUGAR200, 'veraison': 2537.0, 'colour': 'white'},
        },
        # The grape whose ripeness dates each area's harvest estimates.
        'harvest_grape': {'left-bank': 'merlot', 'right-bank': 'merlot', 'dry-white': 'sauvignon-blanc', 'sauternes': 'semillon'},
        # Measured must sugar: Bordeaux Raisins (bordeaux_raisins.py), Merlot and Cabernet
        # Sauvignon from 2013. Cabernet Franc is not sampled and takes the mean of their shifts;
        # fourteen seasons are too few to fit a drift over time.
        'measured_sugar': 'measured_sugar.csv',
        'sugar_stand_in': {'cabernet-franc': ['merlot', 'cabernet-sauvignon']},
        'sugar_gap_drift': False,
        # Growers pick riper than they did: estimates read the sugar recorded starts were picked
        # at within 10 years of the season (since 2000 this cuts a 4-day early bias to under 1).
        'harvest_sugar_window': 10,
        'anchor_area': 'left-bank',
        'calibration': None,
        'blends': {},
        # The chart areas that rate each bank (0: the bank, or communes in it; 1: Bordeaux as a whole).
        'consensus_groups': {
            'left-bank': {'left-bank': 0, 'medoc-graves': 0, 'medoc': 0, 'graves': 0, 'margaux': 0,
                          'pauillac-saint-julien-saint-estephe': 0, 'graves-pessac-leognan': 0, 'bordeaux': 1},
            'right-bank': {'right-bank': 0, 'saint-emilion-pomerol': 0, 'pomerol-saint-emilion': 0,
                           'pomerol': 0, 'saint-emilion': 0, 'bordeaux': 1},
            # Dry whites: Graves / Pessac-Léognan rows, else a chart's dry white Bordeaux row.
            'dry-white': {'graves-pessac-leognan': 0, 'bordeaux-white': 1},
            # Sweet whites: Sauternes / Barsac rows, else a chart's sweet Bordeaux row.
            'sauternes': {'sauternes': 0, 'bordeaux-sweet': 1},
        },
        # The wine colour each group's ratings are for (red unless named).
        'consensus_colours': {'dry-white': 'white', 'sauternes': 'sweet'},
        # Critics rate Bordeaux by bank: the blend is fitted on both banks' ratings together.
        # Minimum sugar: each appellation's cahier des charges (INAO), Merlot / other grapes.
        'quality': {
            'blend': {'groups': {'left-bank': ['left-bank'], 'right-bank': ['right-bank']},
                      'min_sugar': {'merlot': 189, 'cabernet-sauvignon': 180, 'cabernet-franc': 180,
                                    'saint-emilion': {'merlot': 194, 'cabernet-sauvignon': 189, 'cabernet-franc': 189},
                                    'pomerol': {'merlot': 194}},
                      'inputs': ['ripeness', 'warmth', 'heat', 'wet', 'harvestRain', 'hail']},
            # Pessac-Léognan's dry whites: Sauvignon 187 g/L, Sémillon 178 (INAO 2024). Rated by
            # critics for Graves and Pessac-Léognan, or dry white Bordeaux as a whole.
            'blend-white': {'groups': {'dry-white': ['dry-white']},
                            'min_sugar': {'sauvignon-blanc': 187, 'semillon': 178},
                            'inputs': ['ripeness', 'warmth', 'heat', 'wet', 'harvestRain', 'acidity']},
            # Sauternes and Barsac: 221 g/L for every grape (INAO), and the noble-rot season.
            'blend-sweet': {'groups': {'sauternes': ['sauternes']},
                            'min_sugar': {'sauvignon-blanc': 221, 'semillon': 221},
                            'inputs': ['ripeness', 'warmth', 'heat', 'wet', 'nobleRot', 'greyRot']},
        },
        'sources': [
            {'label': 'Sugar', 'detail': 'Grapevine Sugar Ripeness model (Parker et al., 2020): 200 g/L at a temperature sum from 1 April of 2856 (Merlot), 3030 (Cabernet Sauvignon), 2909 (Cabernet Franc) and 2820 (Sauvignon Blanc), read from van Leeuwen et al. 2019, Fig. 3. Sémillon has no published 200 g/L value: 2963 is its 190 g/L value (2886, read from Parker et al. 2020 in OENO One 54:955, Fig. 1) plus the mean step from 190 to 200 g/L of the six grapes with both (77). The red curves are then matched from 2013 to the must sugar the Bordeaux Raisins maturity network (ISVV / Université de Bordeaux with the CIVB, bordeauxraisins.fr) measured on its Médoc and Graves plots (left bank) and Libournais plots (right bank). Cabernet Franc is not sampled and takes the mean of the other two grapes’ correction; earlier years use a correction from the season’s warmth and rain, fitted on those measurements. The white grapes are not sampled and stay as modelled.'},
            {'label': 'Véraison', 'detail': 'Grapevine Flowering Véraison model (Parker et al., 2013): temperature sum above 0 °C from 1 March of 2636 (Merlot), 2689 (Cabernet Sauvignon), 2692 (Cabernet Franc), 2528 (Sauvignon Blanc) and 2537 (Sémillon). The 1.1 °C vineyard-to-station offset was fitted on Burgundy’s BIVB dates and is used unchanged here.'},
            {'label': 'Harvest', 'detail': 'Recorded red harvest starts: the left bank 1959–1998 from Jane Anson’s vintage notes, built on the Tastet-Lawton brokerage records for the Médoc, plus Decanter vintage guides and harvest reports for both banks. Pessac-Léognan’s white grapes keep their own dates: the first Sauvignon picked in the Graves, 2010–2016, from the Bordeaux faculty of oenology’s annual vintage reports (ISVV). Sauternes and Barsac: the first pass picking overripe or botrytised grapes, from Decanter’s Sauternes guide and the ISVV reports. Other years are estimated as the day the area’s grape (Merlot, Sauvignon Blanc, Sémillon) reaches the sugar its recorded starts were picked at, or from the left-bank date where that was closer.'},
            {'label': 'Planted mix', 'detail': 'The red blend weighs Merlot, Cabernet Sauvignon and Cabernet Franc by each appellation’s planted share: the Bordeaux wine council (CIVB) for Saint-Estèphe and Pomerol, the Maison du Vin de Margaux via Decanter for Margaux, and the Wine Folly Bordeaux guide for Pauillac, Saint-Julien, Pessac-Léognan and Saint-Émilion, where no official breakdown was found. The white blends weigh Sémillon and Sauvignon Blanc: Pessac-Léognan by the CIVB’s figures for all white Bordeaux (no appellation figure was found), Sauternes and Barsac at 75 / 20 (with 5% Muscadelle, not modelled) from vinsvignesvignerons.com.'},
            {'label': 'Noble rot', 'detail': 'Sauternes and Barsac, from the area’s harvest start to 31 October: a noble-rot day is a dry day (under 1 mm, mean humidity under 80%) within five days of a day favourable to Botrytis — the berry-to-berry infection term of González-Domínguez et al. 2015 (PLoS ONE 10:e0140444), 0.5 or more, from the day’s mean temperature and SAFRAN humidity; a grey-rot day has 2 mm of rain or more at a mean of 10 °C or more. The thresholds were fixed before testing and not tuned.'},
            {'label': 'Critics', 'detail': 'Reds are rated by bank, dry whites for Graves and Pessac-Léognan, sweet wines for Sauternes and Barsac; where a critic gives only one Bordeaux row for a colour, that row stands in. Decanter rates too few dry-white vintages to set their star scale, so dry whites are put on it through iDealwine, which rates both colours on one 20-point scale.'},
        ],
    },
}


def planted_mix(path: Path, grapes: dict) -> dict[str, dict[str, dict[str, float]]]:
    """Each place's blends: {village: {blend: {grape: share 0-1, summing to 1}}} from a blends.csv
    (columns village, blend, then one per grape; columns that are not modelled grapes are ignored)."""
    if not path.exists():
        return {}
    out: dict[str, dict[str, dict[str, float]]] = {}
    with open(path) as source:
        for row in csv.DictReader(line for line in source if not line.startswith('#')):
            shares = {g: float(row[g]) for g in grapes if row.get(g)}
            total = sum(shares.values())
            out.setdefault(row['village'], {})[row['blend']] = {g: round(v / total, 3) for g, v in shares.items() if v}
    return out


REGIONS['bordeaux']['blends'] = planted_mix(REGIONS['bordeaux']['data'] / 'blends.csv', REGIONS['bordeaux']['grapes'])


def colour_of(grape: str) -> str:
    """'red' or 'white' (a blend takes its grapes' colour)."""
    grapes = config()['grapes']
    if grape in grapes:
        return grapes[grape].get('colour', 'red')
    mixes = [m[grape] for m in config()['blends'].values() if grape in m]
    return colour_of(next(iter(mixes[0]))) if mixes else 'red'


def grape_area(area: str, grape: str) -> str:
    """The harvest area a grape follows in a village of `area` (its colour's own dates where set)."""
    return config().get('colour_areas', {}).get(colour_of(grape), {}).get(area, area)


def village_grapes(village: str) -> list[str]:
    """The grapes a village is read for: its blends and their grapes, or every grape without blends."""
    mixes = config()['blends'].get(village)
    if not mixes:
        return list(config()['grapes'])
    parts = [g for g in config()['grapes'] if any(g in mix for mix in mixes.values())]
    return parts + list(mixes)


def harvest_grape(area: str) -> str:
    rule = config()['harvest_grape']
    return rule if isinstance(rule, str) else rule[area]


def name() -> str:
    region = os.environ.get('VINTAGE_REGION', 'burgundy')
    if region not in REGIONS:
        raise SystemExit(f'Unknown VINTAGE_REGION {region!r}; known: {", ".join(REGIONS)}')
    return region


def config() -> dict:
    return REGIONS[name()]
