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

REGIONS: dict[str, dict] = {
    'burgundy': {
        'data': ROOT / 'scripts/vintages/data',
        'out': ROOT / 'public/data/vintages/burgundy',
        'cache': ROOT / 'scripts/vintages/cache',
        'areas': ['chablis-auxerrois', 'cote-de-nuits', 'hautes-cotes', 'cote-de-beaune', 'cote-chalonnaise', 'maconnais'],
        'grapes': {
            'pinot-noir': {'sugar200': 2840.0, 'veraison': 2511.0},
            'chardonnay': {'sugar200': 2890.0, 'veraison': 2547.0},
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
        'areas': ['left-bank', 'right-bank'],
        # GFV véraison: Parker 2012 thesis Table 3-2 (= AFM 2013). GSR 200 g/L: read from Fig. 3 of
        # van Leeuwen et al. 2019 (Agronomy 9:514), as for Pinot noir and Chardonnay (±5 °C·d).
        'grapes': {
            'merlot': {'sugar200': 2856.0, 'veraison': 2636.0},
            'cabernet-sauvignon': {'sugar200': 3030.0, 'veraison': 2689.0},
            'cabernet-franc': {'sugar200': 2909.0, 'veraison': 2692.0},
        },
        'harvest_grape': 'merlot',
        # Growers pick riper than they did: estimates read the sugar recorded starts were picked
        # at within 10 years of the season (since 2000 this cuts a 4-day early bias to under 1).
        'harvest_sugar_window': 10,
        'anchor_area': 'left-bank',
        'calibration': None,
        'blends': {},
        # Critics rate Bordeaux by bank: the blend is fitted on both banks' ratings together.
        # Minimum sugar: each appellation's cahier des charges (INAO), Merlot / other grapes.
        'quality': {
            'blend': {'groups': {'left-bank': ['left-bank'], 'right-bank': ['right-bank']},
                      'min_sugar': {'merlot': 189, 'cabernet-sauvignon': 180, 'cabernet-franc': 180,
                                    'saint-emilion': {'merlot': 194, 'cabernet-sauvignon': 189, 'cabernet-franc': 189},
                                    'pomerol': {'merlot': 194}},
                      'inputs': ['ripeness', 'warmth', 'heat', 'wet', 'harvestRain', 'hail']},
        },
        'sources': [
            {'label': 'Sugar', 'detail': 'Grapevine Sugar Ripeness model (Parker et al., 2020): 200 g/L at a temperature sum from 1 April of 2856 (Merlot), 3030 (Cabernet Sauvignon) and 2909 (Cabernet Franc), read from van Leeuwen et al. 2019, Fig. 3. No measured sugar is matched in for Bordeaux yet, so hot, dry years may read low.'},
            {'label': 'Véraison', 'detail': 'Grapevine Flowering Véraison model (Parker et al., 2013): temperature sum above 0 °C from 1 March of 2636 (Merlot), 2689 (Cabernet Sauvignon) and 2692 (Cabernet Franc). The 1.1 °C vineyard-to-station offset was fitted on Burgundy’s BIVB dates and is used unchanged here.'},
            {'label': 'Harvest', 'detail': 'Recorded red harvest starts: the left bank 1959–1998 from Jane Anson’s vintage notes, built on the Tastet-Lawton brokerage records for the Médoc, plus Decanter vintage guides and harvest reports for both banks. Other years are estimated as the day Merlot reaches the sugar level that bank’s recorded starts were picked at, or from the left-bank date where that was closer.'},
            {'label': 'Planted mix', 'detail': 'The blend weighs Merlot, Cabernet Sauvignon and Cabernet Franc by each appellation’s planted share: the Bordeaux wine council (CIVB) for Saint-Estèphe and Pomerol, the Maison du Vin de Margaux via Decanter for Margaux, and the Wine Folly Bordeaux guide for Pauillac, Saint-Julien, Pessac-Léognan and Saint-Émilion, where no official breakdown was found.'},
        ],
    },
}


def planted_mix(path: Path) -> dict[str, dict[str, float]]:
    """Each place's share of the modelled grapes (0-1, summing to 1) from a blends.csv."""
    if not path.exists():
        return {}
    out: dict[str, dict[str, float]] = {}
    with open(path) as source:
        for row in csv.DictReader(line for line in source if not line.startswith('#')):
            shares = {g: float(row[g]) for g in ('merlot', 'cabernet-sauvignon', 'cabernet-franc')}
            total = sum(shares.values())
            out[row['village']] = {g: round(v / total, 3) for g, v in shares.items()}
    return out


REGIONS['bordeaux']['blends'] = planted_mix(REGIONS['bordeaux']['data'] / 'blends.csv')


def name() -> str:
    region = os.environ.get('VINTAGE_REGION', 'burgundy')
    if region not in REGIONS:
        raise SystemExit(f'Unknown VINTAGE_REGION {region!r}; known: {", ".join(REGIONS)}')
    return region


def config() -> dict:
    return REGIONS[name()]
