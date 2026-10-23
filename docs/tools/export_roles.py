"""
Exports the DEFAULT role x permission matrix straight from the code:
  - default roles   : CANONICAL_ROLES in apps/server/prisma/seed-admin.ts
  - permission names: packages/types (permission-labels.ts)
build_docs.py calls export_roles() and turns the JSON into the Roles sheet.

    python docs/tools/export_roles.py [output.json]
"""
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SERVER = REPO / "apps" / "server"


def export_roles(out: Path) -> None:
    seed = (SERVER / "prisma" / "seed-admin.ts").read_text(encoding="utf-8").splitlines()
    start = next(i for i, l in enumerate(seed) if l.startswith("const RM = PERMS.MASTERS"))
    end = next(i for i, l in enumerate(seed) if l.startswith("async function syncPermissionCatalog"))
    body = "\n".join(seed[start:end])

    script = f'''import {{ writeFileSync }} from "node:fs";
import {{ ALL_PERMISSION_KEYS, PERMS, permissionLabel, permissionAreaLabel, permissionAreaOf, type PermissionKey }} from "@skerp/types";
{body}
const rows = ALL_PERMISSION_KEYS.map((key) => ({{
  area: permissionAreaLabel(permissionAreaOf(key)),
  key,
  label: permissionLabel(key),
  roles: Object.fromEntries(CANONICAL_ROLES.map((r) => [r.name, r.permissions === "*" || (r.permissions as string[]).includes(key)])),
}}));
writeFileSync({str(out)!r}, JSON.stringify({{ roles: CANONICAL_ROLES.map((r) => r.name), rows }}, null, 1));
console.log("Roles export: " + rows.length + " permissions x " + CANONICAL_ROLES.length + " roles");
'''
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = SERVER / "_tmp_roles_export.mts"
    tmp.write_text(script, encoding="utf-8")
    try:
        subprocess.run("npx tsx _tmp_roles_export.mts", cwd=SERVER, shell=True, check=True)
    finally:
        tmp.unlink(missing_ok=True)


if __name__ == "__main__":
    export_roles(Path(sys.argv[1]) if len(sys.argv) > 1 else REPO / "docs" / "exports" / "roles.json")
