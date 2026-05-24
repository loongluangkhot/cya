.PHONY: dev install server client build start clean

# Default target: run both backend and frontend.
dev:
	@trap 'kill 0' INT TERM EXIT; \
	$(MAKE) -j2 --no-print-directory server client

server:
	cd server && uv run uvicorn main:asgi_app --reload --port 3001

client:
	npm run dev --prefix client

install:
	npm install
	npm install --prefix client
	cd server && uv sync

build:
	npm run build --prefix client

start:
	cd server && uv run uvicorn main:asgi_app --port 3001

clean:
	rm -rf client/dist client/node_modules node_modules server/.venv server/__pycache__
