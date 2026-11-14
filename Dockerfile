# A.R.E.S. Twin — backend FastAPI + estáticos del repo, listo para Cloud Run.
# Build:  docker build -t ares-twin .
# Run:    docker run --rm -p 8080:8080 ares-twin   (http://localhost:8080)
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8080

WORKDIR /app

COPY server/requirements.txt server/requirements.txt
RUN pip install -r server/requirements.txt

# El contexto lo filtra .dockerignore (sin .git, .venv*, credenciales, tests ni datos crudos).
COPY . .

RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin ares \
    && chmod -R a+rX /app
USER 10001

EXPOSE 8080

# Cloud Run inyecta $PORT. --proxy-headers para que el rate-limit vea la IP real del cliente.
CMD ["sh", "-c", "exec uvicorn server.main:app --host 0.0.0.0 --port ${PORT:-8080} --proxy-headers --forwarded-allow-ips='*' --no-server-header"]
