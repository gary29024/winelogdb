# Champagne label translation evaluation

The model translates complete statements in the existing extraction request.
Deterministic cleanup only formats whitespace, dosage categories and complete
month/year values. Do not add producer phrases to a replacement dictionary.

Results retain literal `sourceText`, translated `details`, and `reviewFields` in
the existing extraction JSON. Uncertain or overlong text is withheld from bulk
suggestions. Any withheld model output is retained separately as `reviewText`;
it must not be presented as literal label evidence. Older stored results and
already-queued jobs without this metadata remain readable.

## Model evaluation cases

Use these synthetic cases alongside consented bottle photos when changing the
prompt or model. They are evaluation inputs, not claims about a named producer.
Judge preservation of meaning rather than an exact English string.

| Label wording | Required distinction |
| --- | --- |
| MALOLACTIQUE RECHERCHÉE | Encouraged does not mean completed. |
| MALOLACTIQUE NON RECHERCHÉE | Preserve the negation. |
| FERMENTATION MALOLACTIQUE NON SOUHAITÉE | Translate the complete statement, including negation. |
| VIN NON COLLÉ NI FILTRÉ | Both fining and filtration are negated. |
| ÉLEVAGE EN FÛTS DE CHÊNE PENDANT 12 MOIS | Preserve oak vessels and the 12-month duration. |
| 30% EN FÛTS, 70% EN CUVES | Keep each percentage attached to its vessel. |
| FERMENTATION INDIGÈNE, ENTONNAGE PAR GRAVITÉ | Distinguish fermentation from barrel filling. |
| TIRAGE COURANT D'ÉTÉ | Preserve seasonal date precision; invent no date. |
| MALOLACTIQUE [illegible] | Retain readable evidence and flag uncertainty. |

Also include mixed-case names, literal lot codes, line breaks, degraded accents,
and English translations close to each field limit. For photo evaluation, compare
the literal source against the photo as well as the English against the source.

Record the model, prompt commit, photo identifiers, incorrect meanings,
untranslated prose, missed review flags, and token usage. A model's self-reported
certainty is not independent proof that its translation is correct.

## Automated coverage and limits

The unit tests exercise wording preservation, idempotence, field length handling,
source persistence, legacy responses, exclusion of flagged fields, manual review,
and existing request accounting through Flex and Batch paths. Model responses
are mocked: passing these tests does not measure live translation or OCR quality.
No live photo evaluation was performed for this change.

There is no additional AI request or database migration. Returning source text
does increase response tokens within the existing output-token budget.
