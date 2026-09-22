# Wine detail preview

Screenshots of the implemented page at a 390 × 844 mobile viewport, using a member account, sample wine data and the no-photo placeholder. The same layout applies to owner accounts and received wines. The reference has been manually confirmed, so the LWIN review controls are hidden.

The mobile page restores the compact card layout, typography and spacing from commit c72632f. Type/Alcohol and LWIN7/LWIN11 each share a row. Actions retain accessible touch targets and safe-area spacing.

The action row contains Favourite, Tag friends (person icon), Edit tasting, and Wine-Searcher.

| Light | Dark |
| --- | --- |
| ![Light mobile preview](compact-wine-detail-light.png) | ![Dark mobile preview](compact-wine-detail-dark.png) |

The person icon is coloured when your wine has saved recipients. The sharing sheet shows the selected people without repeating a “Shared with” summary. For a wine shared with you, the neutral icon opens a read-only sheet headed “Tagged friends”, followed by “Shared by Gary” and a Close button. It never loads the sharer's recipient list.

| Your wine: sharing sheet | Received wine: sharing sheet |
| --- | --- |
| ![Member sharing their own wine](compact-wine-sharing-owner.png) | ![Member viewing the sharer](compact-wine-sharing-recipient.png) |

[Received wine detail preview](compact-wine-detail-shared.png)
