# envmon — build & deploy
#
# Always use `make deploy` instead of `databricks bundle deploy` directly.
# The deploy target:
#   1. Verifies Databricks CLI auth
#   2. Builds the React frontend (ensures dist/ is fresh before upload)
#   3. Renders app.yaml from app.template.yaml
#   4. Runs databricks bundle deploy
#   5. Applies the em_location_coordinates migration (idempotent)

PROFILE                    ?= uat
APP_NAME                   ?= envmon
MIGRATIONS_DIR             ?= scripts/migrations
APP_CONFIG_TEMPLATE        ?= app.template.yaml
APP_CONFIG_OUTPUT          ?= app.yaml
WAREHOUSE_HTTP_PATH_DEFAULT ?= /sql/1.0/warehouses/e76480b94bea6ed5
WAREHOUSE_ID               ?= e76480b94bea6ed5
TRACE_CATALOG_DEFAULT      ?= connected_plant_uat
TRACE_SCHEMA_DEFAULT       ?= gold
EM_PLANT_ID_DEFAULT        ?= P225
COORDINATES_MIGRATION      ?= $(MIGRATIONS_DIR)/000_create_em_location_coordinates.sql

.PHONY: apply-migration build check-env deploy render-app-config setup-coordinates

# ---------------------------------------------------------------------------
# Auth check
# ---------------------------------------------------------------------------

check-env:
	@databricks current-user me --profile $(PROFILE) -o json > /dev/null 2>&1 || \
	  (echo "ERROR: Cannot authenticate with Databricks. Run: databricks configure --profile $(PROFILE)" && exit 1)
	@echo "✓ Databricks auth OK (profile: $(PROFILE))"

# ---------------------------------------------------------------------------
# Frontend build
# ---------------------------------------------------------------------------

build:
	cd frontend && npm run build

# ---------------------------------------------------------------------------
# Render app.yaml from template
# ---------------------------------------------------------------------------

render-app-config:
	@echo "Rendering $(APP_CONFIG_OUTPUT) from $(APP_CONFIG_TEMPLATE)..."
	@export DATABRICKS_WAREHOUSE_HTTP_PATH="$${DATABRICKS_WAREHOUSE_HTTP_PATH:-$(WAREHOUSE_HTTP_PATH_DEFAULT)}" && \
	 export TRACE_CATALOG="$${TRACE_CATALOG:-$(TRACE_CATALOG_DEFAULT)}" && \
	 export TRACE_SCHEMA="$${TRACE_SCHEMA:-$(TRACE_SCHEMA_DEFAULT)}" && \
	 export EM_PLANT_ID="$${EM_PLANT_ID:-$(EM_PLANT_ID_DEFAULT)}" && \
	 MSYS_NO_PATHCONV=1 envsubst '$$DATABRICKS_WAREHOUSE_HTTP_PATH $$TRACE_CATALOG $$TRACE_SCHEMA $$EM_PLANT_ID' \
	   < $(APP_CONFIG_TEMPLATE) > $(APP_CONFIG_OUTPUT)
	@echo "✓ $(APP_CONFIG_OUTPUT) rendered"

# ---------------------------------------------------------------------------
# Full deployment
# ---------------------------------------------------------------------------

deploy: check-env build render-app-config
	databricks bundle deploy --profile $(PROFILE)
	$(MAKE) setup-coordinates PROFILE=$(PROFILE)
	@echo ""
	@echo "✓ envmon deployed to $(PROFILE)"
	@echo "  Run: databricks apps start $(APP_NAME) --profile $(PROFILE)"

# ---------------------------------------------------------------------------
# Generic migration runner
#
# Usage: make apply-migration NAME=<table_name> FILE=<path/to/migration.sql>
#
# Substitutes $${TRACE_CATALOG} and $${TRACE_SCHEMA} in the SQL file then
# executes it via the Databricks SQL Statement API using the configured
# warehouse. Safe to re-run — all migrations use CREATE TABLE IF NOT EXISTS.
# ---------------------------------------------------------------------------

apply-migration: check-env
	@echo "Applying $(NAME) migration from $(FILE)..."
	@export TRACE_CATALOG="$${TRACE_CATALOG:-$(TRACE_CATALOG_DEFAULT)}" && \
	 export TRACE_SCHEMA="$${TRACE_SCHEMA:-$(TRACE_SCHEMA_DEFAULT)}" && \
	 SQL=$$(envsubst '$$TRACE_CATALOG $$TRACE_SCHEMA' < $(FILE)) && \
	 TMPFILE=$$(mktemp /tmp/em_mig_XXXXXX.json) && \
	 python3 -c "import json,sys; print(json.dumps({'warehouse_id':sys.argv[1],'statement':sys.argv[2],'wait_timeout':'30s'}))" \
	   "$(WAREHOUSE_ID)" "$$SQL" > "$$TMPFILE" && \
	 MSYS_NO_PATHCONV=1 databricks api post /api/2.0/sql/statements \
	   --profile $(PROFILE) --json "@$$TMPFILE" && \
	 rm -f "$$TMPFILE"
	@echo "✓ $(NAME) ready"

# ---------------------------------------------------------------------------
# Individual migration targets
# ---------------------------------------------------------------------------

setup-coordinates:
	@$(MAKE) apply-migration NAME=em_location_coordinates FILE=$(COORDINATES_MIGRATION) PROFILE=$(PROFILE)

# ---------------------------------------------------------------------------
# Local dev (no Databricks connection required)
# ---------------------------------------------------------------------------

dev:
	cd frontend && npm run dev &
	uvicorn backend.main:app --reload --port 8000

install:
	pip install -r backend/requirements.txt
	cd frontend && npm install
