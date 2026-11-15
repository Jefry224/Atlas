# A.R.E.S. Twin · backend

FastAPI que sirve la API de `docs/contracts.md` §3 y, en el mismo origen, los estáticos del repo.

| Endpoint | Descripción |
| --- | --- |
| `GET /api/health` | Estado, versión y proveedores activos (`weather`: `meteomatics` \| `open-meteo`; `ai`: `openai` \| `none`). |
| `GET /api/telemetry?lat=&lon=&site=` | Meteorología actual del gemelo terrestre. Caché de 10 min por (lat, lon) redondeados a 0.01°. Si el proveedor falla: caché vieja (`live:false`, `cached:true`) y después `assets/data/telemetry-snapshot.json` (`provider:"snapshot"`, `live:false`). Sin nada disponible: `503 {"error":"telemetry-unavailable"}`. Entrada inválida: `422 {"error":"invalid-input","fields":[…]}`. |
| `POST /api/copilot` | Copiloto «Flight Director» (`server/prompts/flight_director.md`) mediante API compatible con OpenAI. Sin clave: `503 {"error":"no-ai-provider"}`; fallo del proveedor: `503 {"error":"ai-provider-unavailable"}`; rate-limit: `429 {"error":"rate-limited"}`; entrada superior a 272.000 tokens estimados: `413 {"error":"context-too-large"}`. |
| `POST /api/copilot` | Acepta hasta 20 mensajes recientes en `history`, enviados desde memoria de la pestaña para mantener contexto conversacional. No se persisten en servidor. |
| `GET /api/docs` | OpenAPI interactivo. |
| `/` | Estáticos del repo (`index.html`, `assets/…`). Nunca sirve `server/`, `scripts/`, dotfiles (`.git`, `.venv*`, `.env`, `.aws`…), `Dockerfile`, `*.py`, `*.sh`. |

`grounded` del copiloto usa rutas del contexto §5; la telemetría se cita en la forma del contrato (`earth.telemetry.temperatureC`, sin `.values`). El servidor descarta cualquier ruta que no exista en el contexto enviado.

## Correr en local

> Para una guía paso a paso utilizando **`mise`** en Windows, macOS o Linux, consulta [docs/ejecucion-mise.md](../docs/ejecucion-mise.md).

```bash
# Una vez (Python 3.14 de Debian/Ubuntu sin ensurepip: se usa el pip de usuario)
python3.14 -m venv --without-pip .venv-server
python3.14 -m pip --python .venv-server/bin/python install -r server/requirements-dev.txt
# (con python3-venv instalado basta: python3 -m venv .venv-server && .venv-server/bin/pip install -r server/requirements-dev.txt)

# Servidor (desde la raíz del repo) → http://localhost:8000
.venv-server/bin/uvicorn server.main:app --reload --port 8000

# Tests (sin red: proveedores simulados con respx)
.venv-server/bin/python -m pytest server/tests -q

# Regenerar la instantánea de telemetría (1 consulta real a Open-Meteo para los 15 sitios)
.venv-server/bin/python -m server.snapshot
```

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `METEOMATICS_USERNAME`, `METEOMATICS_PASSWORD` | Activan Meteomatics (`global_rad:W`, `t_2m:C`, `wind_speed_10m:ms`, `wind_gusts_10m_1h:ms`, `relative_humidity_2m:p`, `total_cloud_cover:p`). Si falla o se agota el presupuesto, se usa Open-Meteo. |
| `METEOMATICS_DAILY_BUDGET` | Máximo de consultas Meteomatics por día UTC y por instancia (por defecto 900, margen sobre el límite de 1000). Con la caché de 10 min y `max-instances 3`, cabe de sobra. |
| `OPENAI_API_KEY` | Clave del proveedor compatible con OpenAI. Solo se utiliza en el backend; no la incluyas en JavaScript ni la publiques. |
| `OPENAI_BASE_URL` | Base de la API (por defecto `https://ai.edream.dev/v1`). |
| `OPENAI_MODEL`, `OPENAI_FALLBACK_MODEL` | Modelo principal (`gpt-6.1-sol`) y respaldo (`gemini-3.8-flash`). Si falla el principal, el backend intenta el respaldo en la misma API. El backend estima la entrada por tamaño UTF-8 (aprox. 4 bytes/token) y rechaza entradas mayores a 272.000 tokens estimados. |
| `ALLOWED_ORIGINS` | Orígenes CORS separados por coma. Vacío ⇒ solo mismo origen + `localhost`/`127.0.0.1` en cualquier puerto. |
| `COPILOT_RATE_PER_MIN`, `COPILOT_GLOBAL_RATE_PER_MIN` | Rate-limit del copiloto por IP (8/min) y global por instancia (60/min). |
| `SERVE_STATIC` | `0` para servir solo la API. |
| `PORT` | Puerto del contenedor (Cloud Run lo inyecta; por defecto 8080). |

## Docker

```bash
docker build -t ares-twin .
docker run --rm -p 8080:8080 -e OPENAI_API_KEY=… ares-twin
curl localhost:8080/api/health
```

Imagen `python:3.14-slim`, usuario no root (uid 10001), `uvicorn --proxy-headers`. `.dockerignore` excluye todos los dotfiles (`.git`, `.venv*`, `.aws`, `.env`…), tests, `scripts/` y datos crudos.

## Despliegue en Cloud Run (manual)

1. Instalar [gcloud](https://cloud.google.com/sdk/docs/install), `gcloud auth login`, `gcloud config set project <PROJECT_ID>` (proyecto con facturación).
2. Ejecutar (las claves se guardan en Secret Manager, nunca como variables en claro):
   ```bash
   PROJECT_ID=<id> REGION=us-central1 \
   ALLOWED_ORIGINS=https://ares.tudominio.com \
   OPENAI_API_KEY=<clave> \
   ./scripts/deploy-cloudrun.sh
   # DRY_RUN=1 para ver los comandos sin ejecutarlos
   ```
   El script es idempotente: habilita APIs, crea/actualiza los secretos `openai-api-key`, `meteomatics-username`, `meteomatics-password` (solo los que pases), da `secretAccessor` a la cuenta de servicio de ejecución y lanza `gcloud run deploy --source .` (Cloud Build usa el `Dockerfile`). En ejecuciones posteriores sin las variables reutiliza los secretos ya existentes.
3. Comprobar: `curl https://<servicio>-<hash>.<región>.run.app/api/health`.

## Dominio de GoDaddy + SSL (manual)

Cloud Run emite y renueva el certificado TLS automáticamente (Google-managed) una vez que el DNS apunta al servicio.

1. **Verificar el dominio** en Google: `gcloud domains verify tudominio.com` (abre Search Console) → añadir en GoDaddy el registro **TXT** `@` con el valor `google-site-verification=…` que indique Search Console → «Verificar».
2. **Crear el mapeo** (regiones con soporte de domain mappings, p. ej. `us-central1`, `europe-west1`, `asia-east1`):
   ```bash
   gcloud beta run domain-mappings create --service ares-twin \
     --domain ares.tudominio.com --region us-central1
   gcloud beta run domain-mappings describe --domain ares.tudominio.com --region us-central1
   ```
   `describe` lista los registros DNS que hay que crear.
3. **En GoDaddy → Mis productos → DNS → Administrar registros**:
   - Subdominio (recomendado, `ares.tudominio.com`): registro **CNAME**, nombre `ares`, valor `ghs.googlehosted.com.`, TTL 1 h.
   - Dominio raíz (`tudominio.com`): registros **A** `@` → `216.239.32.21`, `216.239.34.21`, `216.239.36.21`, `216.239.38.21` y **AAAA** `@` → `2001:4860:4802:32::15`, `…:34::15`, `…:36::15`, `…:38::15` (usar los valores exactos que devuelva `describe`). Borrar el registro A «Parked» de GoDaddy si existe.
4. Esperar la propagación (minutos a ~24 h). El estado del certificado se ve en `describe` (`CertificateProvisioned: True`) o en la consola de Cloud Run → «Administrar dominios personalizados».
5. Redesplegar con `ALLOWED_ORIGINS=https://ares.tudominio.com` si el frontend se sirve desde otro origen (si se sirve desde el mismo contenedor no hace falta).

Alternativa si la región no admite domain mappings: un balanceador HTTPS externo con NEG serverless y certificado gestionado, apuntando el registro A de GoDaddy a la IP del balanceador.
