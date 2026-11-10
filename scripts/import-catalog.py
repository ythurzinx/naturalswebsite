"""Convert a Mundo Natural POS report into private server seed batches.

Run: python3 scripts/import-catalog.py /path/report.csv /private/seed-directory
Uses the same validation and normalization as the dashboard CSV import.
"""
import argparse
import json
import subprocess
from pathlib import Path


def write_catalog(source, output):
    project = Path(__file__).resolve().parents[1]
    proc = subprocess.run(
        ["node", "--input-type=module", "-e", """
import { readFileSync } from 'node:fs'
import { parseCatalogCsv } from './lib/import-catalog.mjs'
process.stdout.write(JSON.stringify(parseCatalogCsv(readFileSync(process.argv[1], 'utf8'))))
""", str(source.resolve())],
        cwd=project,
        check=True,
        stdout=subprocess.PIPE,
    )
    products = json.loads(proc.stdout)
    output.mkdir(parents=True, exist_ok=True)
    groups, group, size = [], [], 0
    for product in products:
        line = json.dumps(product, ensure_ascii=False, separators=(",", ":"))
        added = len(line.encode()) + 2
        if size + added > 86000 and group:
            groups.append(group)
            group, size = [], 0
        group.append(line)
        size += added
    if group:
        groups.append(group)
    generated = set()
    for number, group in enumerate(groups, 1):
        path = output / f"catalog-{number:02d}.json"
        path.write_text("[\n" + ",\n".join(group) + "\n]\n", encoding="utf-8")
        generated.add(path)
    for path in output.glob("catalog-[0-9][0-9].json"):
        if path not in generated:
            path.unlink()
    print(f"{len(products)} produtos, {sum(row[6] for row in products)} liberados, {len(groups)} arquivos.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    write_catalog(args.source, args.output)
