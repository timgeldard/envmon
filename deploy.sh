#!/usr/bin/env bash
# envmon — deploy script
#
# Usage: bash deploy.sh [PROFILE] [TARGET]
#   PROFILE : Databricks CLI profile (default: uat)
#   TARGET  : Bundle target              (default: uat)
#
# Steps:
#   1. Verify Databricks CLI auth
#   2. Build the React frontend
#   3. Render app.yaml from app.template.yaml
#   4. databricks bundle deploy  (also triggers app deployment automatically)
#   5. Apply em_location_coordinates migration (idempotent)

set -euo pipefail

PROFILE="${1:-uat}"
TARGET="${2:-uat}"
APP_NAME="envmon"
WAREHOUSE_ID="e76480b94bea6ed5"
MIGRATIONS_DIR="scripts/migrations"
COORDINATES_MIGRATION="${MIGRATIONS_DIR}/000_create_em_location_coordinates.sql"

# Default variable values (can be overridden via env)
DATABRICKS_WAREHOUSE_HTTP_PATH="${DATABRICKS_WAREHOUSE_HTTP_PATH:-/sql/1.0/warehouses/${WAREHOUSE_ID}}"
TRACE_CATALOG="${TRACE_CATALOG:-connected_plant_uat}"
TRACE_SCHEMA="${TRACE_SCHEMA:-gold}"
EM_PLANT_ID="${EM_PLANT_ID:-P225}"

# ---------------------------------------------------------------------------
# 1. Auth check
# ---------------------------------------------------------------------------
echo "Checking Databricks auth (profile: ${PROFILE})..."
databricks current-user me --profile "${PROFILE}" -o json > /dev/null 2>&1 || {
  echo "ERROR: Cannot authenticate. Run: databricks configure --profile ${PROFILE}"
  exit 1
}
echo "✓ Auth OK"

# ---------------------------------------------------------------------------
# 2. Build frontend
# ---------------------------------------------------------------------------
echo "Building frontend..."
(cd frontend && npm run build)
echo "✓ Frontend built"

# ---------------------------------------------------------------------------
# 3. Render app.yaml from template (Python — no envsubst required)
# ---------------------------------------------------------------------------
echo "Rendering app.yaml..."
python3 - <<PYEOF
import pathlib, re

vals = {
    "DATABRICKS_WAREHOUSE_HTTP_PATH": "${DATABRICKS_WAREHOUSE_HTTP_PATH}",
    "TRACE_CATALOG": "${TRACE_CATALOG}",
    "TRACE_SCHEMA": "${TRACE_SCHEMA}",
    "EM_PLANT_ID": "${EM_PLANT_ID}",
}

template = pathlib.Path("app.template.yaml").read_text()
result = re.sub(r'\$\{(\w+)\}', lambda m: vals.get(m.group(1), m.group(0)), template)
pathlib.Path("app.yaml").write_text(result)
print("  Written app.yaml")
PYEOF
echo "✓ app.yaml rendered"

# ---------------------------------------------------------------------------
# 4. Deploy bundle (also triggers app redeployment automatically)
# ---------------------------------------------------------------------------
echo "Deploying bundle (target: ${TARGET})..."
databricks bundle deploy --profile "${PROFILE}" --target "${TARGET}"
echo "✓ Bundle deployed — app deployment triggered automatically"

# ---------------------------------------------------------------------------
# 5. Apply migration (idempotent)
# ---------------------------------------------------------------------------
echo "Applying migration: em_location_coordinates..."
python3 - <<PYEOF
import json, pathlib, re, subprocess, sys, tempfile, os

sql = pathlib.Path("${COORDINATES_MIGRATION}").read_text()
sql = sql.replace("\${TRACE_CATALOG}", "${TRACE_CATALOG}").replace("\${TRACE_SCHEMA}", "${TRACE_SCHEMA}")

payload = json.dumps({
    "warehouse_id": "${WAREHOUSE_ID}",
    "statement": sql,
    "wait_timeout": "30s",
})

with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
    f.write(payload)
    tmpfile = f.name

try:
    result = subprocess.run(
        ["databricks", "api", "post", "/api/2.0/sql/statements",
         "--profile", "${PROFILE}", "--json", "@" + tmpfile],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        print("Migration error:", result.stderr, file=sys.stderr)
        sys.exit(1)
    state = json.loads(result.stdout).get("status", {}).get("state", "?")
    print(f"  SQL state: {state}")
finally:
    os.unlink(tmpfile)
PYEOF
echo "✓ Migration applied"

echo ""
echo "✓ envmon deployed to ${PROFILE} — https://envmon-604667594731808.8.azure.databricksapps.com"
