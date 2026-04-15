.PHONY: install dev build lint typecheck

install:
	pip install -r backend/requirements.txt
	cd frontend && npm install

dev:
	cd frontend && npm run dev &
	uvicorn backend.main:app --reload --port 8000

build:
	cd frontend && npm run build

lint:
	cd frontend && npm run typecheck

typecheck:
	cd frontend && npm run typecheck
