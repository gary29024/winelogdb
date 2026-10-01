"""Reproduce/check every configured history delivery, once per shared bundle.

  python scripts/build_grand_cru_history_rollout.py
  python scripts/build_grand_cru_history_rollout.py --check

Downloads are a separate inventory step. This command uses only pinned local
inputs, preserves curation, and processes bundle observations once per bundle.
"""
import argparse
import json
import subprocess
import sys

from build_grand_cru_notice_history import build as notices
from build_grand_cru_research import run as register
from build_grand_cru_rights_history import build as history
from build_grand_cru_sale_records import build as sales
from grand_cru import (bundle_ids, load_bundle, load_cru, load_manifest, research_path, source_dir, write_or_check)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--bundle')
    parser.add_argument('--history-only', action='store_true')
    args = parser.parse_args()
    for bundle_id in [args.bundle] if args.bundle else bundle_ids():
        bundle = load_bundle(bundle_id)
        cmd = [sys.executable, str(__file__).replace('build_grand_cru_history_rollout.py', 'build_grand_cru_parcels.py'),
               '--cru', bundle['crus'][0]] + (['--check'] if args.check else [])
        subprocess.run(cmd, check=True)
        manifest, directory = load_manifest(bundle), source_dir(bundle)
        for slug in bundle['crus']:
            cru, _ = load_cru(slug)
            result = history(cru, bundle, manifest, directory)
            write_or_check(research_path(cru, 'rights-history.json'), json.dumps(result, ensure_ascii=False, indent=1) + '\n', args.check)
            print(json.dumps({'cru': slug, 'history': result['counts'],
                              'earliestDfi': result['coverage']['earliestReachableDfiValidationDate']}), flush=True)
            if args.history_only:
                continue
            sale_records = sales(cru, bundle, manifest, directory)
            write_or_check(research_path(cru, 'sale-records.json'), json.dumps(sale_records, ensure_ascii=False, indent=1) + '\n', args.check)
            notice_records = notices(cru, bundle, result)
            write_or_check(research_path(cru, 'notice-history.json'), json.dumps(notice_records, ensure_ascii=False, indent=1) + '\n', args.check)
            register(slug, args.check)
    if not args.bundle and not args.history_only:
        for script in ('build_grand_cru_app_registry.py', 'audit_grand_cru_history_rollout.py'):
            subprocess.run([sys.executable, str(__file__).replace('build_grand_cru_history_rollout.py', script)]
                           + (['--check'] if args.check else []), check=True)


if __name__ == '__main__':
    main()
