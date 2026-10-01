"""Generate the app's cru/bundle registry, holder imports and lazy evidence loaders.

Only crus with a committed commune-edge audit are wired into the app (grand_cru.app_cru_slugs);
the others keep their research and history files but stay off the maps until that audit passes.

Only registry declarations are replaced; the runtime lookup/merge/cache functions
remain normal TypeScript. Run after adding a config; --check detects stale wiring.
"""
import argparse
import json

from grand_cru import APP_DIR, app_bundle_ids, app_cru_slugs, load_cru, read_json, write_or_check


def generate(check=False):
    bundles = app_bundle_ids()
    crus = [load_cru(s)[0] for s in app_cru_slugs()]
    path = APP_DIR / 'registry.ts'
    source = path.read_text(encoding='utf-8')
    start = source.index('/** A commune bundle')
    source = ''.join(f"import bundle{i} from './{b}.manifest.json';\n" for i, b in enumerate(bundles)) + '\n' + source[start:]
    type_start = source.index('export type ParcelManifest=')
    type_end = source.index(';', type_start) + 1
    source = source[:type_start] + 'export type ParcelManifest=typeof bundle0;' + source[type_end:]
    start = source.index('export const parcelBundles=')
    end = source.index(';', start) + 1
    declaration = "export const parcelBundles={" + ','.join(f"'{b}':bundle{i}" for i, b in enumerate(bundles)) + "} satisfies Record<string,ParcelManifest>;"
    source = source[:start] + declaration + source[end:]
    start = source.index('export type EvidenceSourceId=')
    end = source.index(';', start) + 1
    source = source[:start] + 'export type EvidenceSourceId=' + '|'.join("'" + c['slug'] + "'" for c in crus if c['evidenceFrom']) + ';' + source[end:]
    start = source.index('export const grandCrus:')
    end = source.index('\n];', start) + 3
    fields = ('slug', 'name', 'parentFeatureId', 'villageMaps', 'bundle', 'evidenceFrom')
    rows = []
    for cru in crus:
        # The control appears only when the generated evidence links legal holders to domaines.
        grouped = any(read_json(APP_DIR / f'{slug}.evidence.json').get('holderDomains')
                      for slug in cru['evidenceFrom'])
        values = {**{key: cru[key] for key in fields}, 'domaineGrouping': grouped}
        rows.append(' {' + ','.join(key + ':' + json.dumps(value, ensure_ascii=False)
                                   for key, value in values.items()) + '},')
    source = source[:start] + 'export const grandCrus:readonly GrandCru[]=[\n' + '\n'.join(rows) + '\n];' + source[end:]
    write_or_check(path, source, check)

    path = APP_DIR / 'holders.ts'
    source = path.read_text(encoding='utf-8')
    source = ''.join(f"import bundle{i} from './{b}.holders.json';\n" for i, b in enumerate(bundles)) + source[source.index('import {grandCruFor'):]
    start = source.index('const holderIndexes:')
    end = source.index(';', start) + 1
    source = source[:start] + 'const holderIndexes:Record<ParcelBundleId,Record<string,string[]>>={' + ','.join(f"'{b}':bundle{i}" for i, b in enumerate(bundles)) + '};' + source[end:]
    write_or_check(path, source, check)

    path = APP_DIR / 'evidence.ts'
    source = path.read_text(encoding='utf-8')
    start = source.index('const loaders:')
    end = source.index('\n};', start) + 3
    loaders = ''.join(f" '{c['slug']}':()=>import('./{c['slug']}.evidence.json'),\n" for c in crus if c['evidenceFrom'])
    source = source[:start] + 'const loaders:Record<EvidenceSourceId,()=>Promise<{default:unknown}>>={\n' + loaders + '};' + source[end:]
    write_or_check(path, source, check)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    generate(parser.parse_args().check)
