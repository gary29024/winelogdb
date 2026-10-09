"""Remove embedded Google API keys from research HTML without decoding its bytes.

  python scripts/redact_grand_cru_html.py original.html sanitized.html

Prints safe hash/size/redaction metadata for the source-review entry. Keep the
original retrieval/transport metadata; its hashes describe the downloaded bytes,
while the returned sha256 and size describe the committed, sanitized snapshot.
This does not fetch a page, execute its scripts or call the embedded API.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re


GOOGLE_API_KEY = re.compile(rb'AIza[0-9A-Za-z_-]{35}')
REPLACEMENT = b'[REDACTED_GOOGLE_API_KEY]'


def redact_html(original):
    sanitized, count = GOOGLE_API_KEY.subn(REPLACEMENT, original)
    metadata = {'sha256': hashlib.sha256(sanitized).hexdigest(), 'size': len(sanitized)}
    if count:
        metadata['redaction'] = {
            'method': 'google-api-key-v1',
            'replacement': REPLACEMENT.decode('ascii'),
            'occurrences': count,
            'originalSha256': hashlib.sha256(original).hexdigest(),
            'originalSize': len(original),
        }
    return sanitized, metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve():
        parser.error('Use a separate output path to preserve the acquisition source.')
    sanitized, metadata = redact_html(args.source.read_bytes())
    args.output.write_bytes(sanitized)
    print(json.dumps(metadata, indent=2))


if __name__ == '__main__':
    main()
