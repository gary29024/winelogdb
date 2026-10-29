# Naming where a photo was taken

When a scanned photo carries EXIF GPS, WineLog suggests an **approximate place** for the tasting: the field the wine form labels "Approximate place". The coordinates themselves are stored exactly; the place is only a readable name for them, and the member can edit it.

## Why it is not the label model's job

Recognition used to send the photo's coordinates to the label model and ask it to name the place, in the same request that works out where the wine comes from. It answered with the wine's home. A batch photographed across Tokyo came back as "Yoichi, Hokkaido" (the wineries' town), "Hokkaido" and "Courmas" (a Champagne village), and identical coordinates got a different name for each wine.

The coordinates are now never sent to the model. Single, group and batch scans name the place with `photoPlaceName` (`src/lib/places/photoPlace.ts`): the nearest **GeoNames** populated place of over 500 people, labelled with its region, for example:

| Photo GPS | Approximate place |
| --- | --- |
| 35.608, 139.672 | Jiyūgaoka, Tokyo |
| 35.670, 139.773 | Chūō, Tokyo |
| 35.690, 139.692 | Tokyo, Japan (the region would only repeat the name) |
| 22.280, 114.192 | Tin Hau, Hong Kong (countries under 2,000 km² are named instead of their districts) |
| 45.199, -0.748 | Pauillac, New Aquitaine |

A photo more than 50 km from any such place, at sea for instance, gets no name.

## Importing the places

The place list lives in R2 beside the LWIN and ELID catalogues, and is imported once:

```powershell
npm run places:import
```

The command downloads three files from the [GeoNames dump](https://download.geonames.org/export/dump/) — `cities500.zip`, `admin1CodesASCII.txt` and `countryInfo.txt` — into `.tmp/geonames`, reads the zip itself (no unzip tool is needed), and uploads about 11 MB as 256 shards plus a names file:

```text
reference/
  places/
    current.json
    versions/<content-hash>/
      shard-000.json ... shard-255.json
      names.json
```

Each shard holds whole one-degree cells. A lookup reads the photo's own cell, and a neighbouring cell only when a nearer place could lie across the edge, so most photos cost one small R2 read.

Useful options:

- `--dry-run` builds the files under `.tmp/places-reference/` without uploading.
- `--source="C:\WineLogData\geonames"` reads the three files from a folder instead of downloading them. `cities500.txt` already extracted from the zip is accepted too.
- `--fresh` downloads again instead of reusing `.tmp/geonames`.
- `--bucket=<name>` uploads to another bucket than `winelog-private`.

Until the import has run, scans simply show no approximate place. Rerun it now and then to pick up GeoNames corrections; versions are immutable, and `current.json` switches only after every shard has uploaded.

Run the import by hand, not from the Cloudflare build. A build would download and upload all 258 files on every deploy, under a new version each time because GeoNames republishes daily, and a deploy would fail whenever GeoNames was unreachable. The build token would also need R2 and D1 write access.

## Correcting places already saved

Wines saved before this change still show the place the label model guessed. After the import, **Owner controls → Background jobs → Photo places** renames them from their GPS (`worker/photoPlaceBackfill.ts`). It covers every account, like the other background jobs.

A place is renamed only while it is still exactly what a recorded scan proposed:

| Saved place | What the job does |
| --- | --- |
| Still the scan's guess | Renamed from the GPS, or cleared if no place is within 50 km |
| Blank, and the scan proposed nothing | Named, as a new scan would be |
| Typed by the member, or cleared after a guess | Kept |
| No scan record (single scans from before credit operations were kept) | Kept: nothing tells a guess from typing |

The scan records are the batch and group scan results kept with the wines they became, and each single scan's reply, matched to the tasting by its exact GPS coordinates. Photos' own copies of the place follow the same rule, and Batch Scan results still waiting for review are renamed before anyone saves them.

Each rename is guarded on the name the job read, so a member's edit made while it runs wins. A chunk's renames, cursor and counts commit together. If a place file is missing, the chunk renames nothing and the job pauses with an error, rather than reading the gap as nothing nearby. The job runs once; new scans need no correction.

## Licence

GeoNames data is published under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). WineLog derives a subset of it (names, coordinates, region and country names) and credits GeoNames on the About page.
