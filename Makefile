ML_VENV ?= .venv
PYTHON ?= python3.11

.PHONY: frontend-install frontend-start frontend-build frontend-test api-install api-start training-install ml-install ml-test ml-start verify-models

frontend-install:
	cd frontend && npm ci

frontend-start:
	cd frontend && npm start

frontend-build:
	cd frontend && npm run build

frontend-test:
	cd frontend && CI=true npm test -- --watchAll=false --watchman=false

api-install:
	cd ml_services && $(PYTHON) -m venv $(ML_VENV) && $(ML_VENV)/bin/pip install -r requirements-dev.txt

training-install:
	cd ml_services && $(PYTHON) -m venv $(ML_VENV) && $(ML_VENV)/bin/pip install -r requirements-train.txt

ml-install: training-install

ml-test:
	cd ml_services && MPLCONFIGDIR=/tmp/curenet-matplotlib $(ML_VENV)/bin/python -m pytest -q

api-start:
	cd ml_services && $(ML_VENV)/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8000

ml-start: api-start

verify-models:
	python3 scripts/verify_models.py
