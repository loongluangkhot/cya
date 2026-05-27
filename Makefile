.PHONY: dev backend frontend dev-remote backend-remote frontend-remote install clean

# Default target: run both backend and frontend.
dev:
	@trap 'kill 0' INT TERM EXIT; \
	$(MAKE) -j2 --no-print-directory backend frontend

backend:
	cd backend && uv run uvicorn main:asgi_app --reload --port 8001

frontend:
	export BACKEND_URL=http://localhost:8001
	npm run dev -- --port 3001

dev-remote:
	@trap 'kill 0' INT TERM EXIT; \
	$(MAKE) -j2 --no-print-directory backend-remote frontend-remote

backend-remote:
	cd backend && uv run uvicorn main:asgi_app --reload --host 0.0.0.0 --port 8001

frontend-remote:
	export BACKEND_URL=${CYA_BACKEND_URL} && cd frontend && npm run dev -- --host 0.0.0.0 --port 3001

install:
	cd frontend && npm install
	cd backend && uv sync

clean:
	rm -rf frontend/dist frontend/node_modules backend/.venv backend/__pycache__
