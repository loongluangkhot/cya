# cya-backend/Dockerfile
FROM python:3.12-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/

WORKDIR /app

# Copy everything and install dependencies
COPY . .
RUN uv sync --frozen --no-dev

# Use the venv's executables directly
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8001
CMD ["uvicorn", "main:asgi_app", "--host", "0.0.0.0", "--port", "8001"]