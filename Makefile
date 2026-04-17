# envmon — build & deploy
#
# Delegates to deploy.sh for full deployment (no envsubst / mktemp required).
# Usage:
#   make deploy            # deploy to UAT (default)
#   make deploy PROFILE=prod TARGET=prod
#   bash deploy.sh [PROFILE] [TARGET]

PROFILE ?= uat
TARGET  ?= uat

.PHONY: deploy build install dev

deploy:
	bash deploy.sh $(PROFILE) $(TARGET)

build:
	cd frontend && npm run build

install:
	pip install -r backend/requirements.txt
	cd frontend && npm install

dev:
	cd frontend && npm run dev &
	uvicorn backend.main:app --reload --port 8000
