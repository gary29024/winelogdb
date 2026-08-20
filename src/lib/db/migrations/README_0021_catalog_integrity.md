# 0021 producer catalog integrity cleanup

This migration repairs only obvious structured-response leakage already stored inside producer `catalog_json` string fields, such as a style value that contains a swallowed `},{` next-record delimiter or `notes null` fragment.

It does not invent replacement research. Core wine identity fields are retained when they remain readable. Contaminated optional metadata is set to `null`, and an entry is omitted only when its `name` itself contains a structural record delimiter.

Future model responses are protected separately by `parseStructuredJsonText`, which rejects the same embedded-record signatures before any producer catalog write occurs.
