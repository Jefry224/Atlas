# Módulo 2: presión local y vigencia del backend

Resultado: completado localmente. Sin commit, push, deploy ni regeneración de
`assets/data/telemetry-snapshot.json`. No se leyeron ni imprimieron credenciales,
ni se hicieron consultas reales a Meteomatics.

## Archivos propios modificados

- `Atlas/server/telemetry.py`
- `Atlas/server/tests/test_api.py`
- `Atlas/server/tests/test_telemetry.py` (nuevo)
- `Atlas/server/README.md`

El repositorio ya tenía numerosos cambios locales ajenos, incluido
`server/prompts/flight_director.md`; se conservaron. No se editaron main.py,
frontend, contratos generales, launcher, package.json ni variables de entorno.

## Contrato implementado y coordinado

- `values.surfacePressurePa`: Pa absolutos locales, número válido o null. Siempre
  está presente en respuestas de la API, incluso archivos/cachés anteriores.
- Open-Meteo solicita surface_pressure y comprueba unidad devuelta (hPa × 100 o
  Pa explícito); los demás campos también verifican sus unidades conocidas.
- Meteomatics añade sfc_pressure:Pa a la petición agrupada; se confirmó el nombre,
  significado QFE y unidad Pa en su documentación oficial antes de implementarlo.
- Valores nulos, booleanos, cadenas, NaN/inf, sentinelas, unidad desconocida o
  presión fuera de 10000–120000 Pa quedan null, nunca cero. La conversión se
  redondea después de multiplicar, a una décima de Pa.
- La presión faltante o malformada no elimina el resto de la meteorología.
  HTTP 400/403/422 con presión desactiva el parámetro por instancia y permite
  un reintento sin presión; cada intento consume el presupuesto existente y
  el reintento se omite si no queda cuota. Luego aplica respaldo habitual.
- `observedAt`: hora real del proveedor en UTC o null si desconocida/inválida.
  En MM se usa la más antigua de los valores disponibles; tiempo faltante en
  uno de esos valores hace desconocida la hora conjunta.
- Añadidos `fetchedAt` y `observationAgeSeconds`: hora del fetch exitoso y edad
  de la observación, respectivamente. La caché conserva fetchedAt.
- `ageSeconds` conserva semántica previa: edad de fetch para proveedor/caché y
  edad de observación para snapshot; null si snapshot no tiene fecha válida.
- `live` requiere proveedor exitoso y fecha entre ahora−1800 s y ahora+300 s;
  se recalcula al servir la caché. Es política de la aplicación, no promesa del
  proveedor. Fallo explícito o snapshot nunca live; fuente y observación se
  conservan al devolver caché vieja. Fuentes siguen rotuladas como modelos.
- TTL 600 s y presupuesto diario MM se conservan. No se añaden paquetes runtime.

Contrato comunicado primero al coordinador y aceptado; enviado directamente al
frontend dispatch ctx_a8ba49b467bc, incluida la evidencia real y entorno Python.

## Pruebas y comandos

Desde `/home/jefry/dev/personal/S.E.L.E.N.E/Atlas`:

1. `python3 -m venv /tmp/selene-m2-backend-venv` → exit 0.
2. `/tmp/selene-m2-backend-venv/bin/pip install -r server/requirements-dev.txt`
   → exit 0, dependencias existentes del repositorio instaladas en /tmp.
3. `/tmp/selene-m2-backend-venv/bin/python -m pytest server/tests -q`
   → primera ejecución API actualizada: **53 passed in 1.15s**, exit 0.
4. Mismo comando con nuevas pruebas: **131 passed in 2.82s**, exit 0.
5. Mismo comando final tras cubrir enteros enormes, fecha extrema, caché antigua
   y MM sin campo de presión: **135 passed in 3.04s**, exit 0.
6. `git diff --check -- server/telemetry.py server/tests/test_api.py server/README.md`
   → exit 0, sin errores de espacios.
7. `/tmp/selene-m2-backend-venv/bin/python --version` → Python 3.12.3.

Las 135 pruebas completas de backend bloquean conexiones reales en conftest y
simulan HTTP con respx. Cubren conversión y precisión, unidades ausentes,
desconocidas y malformadas, MSL ignorada, rangos/sentinelas/NaN/inf, preservación
de otras variables, presión no autorizada, cuota y reintentos, reloj
determinista, desfase de zona, observación vieja o inválida, cruce del umbral
dentro del TTL, fallo con caché y snapshot, caché/archivos antiguos, salud,
copiloto, rate limit, rutas estáticas y CORS.

Incidencias iniciales resueltas: el directorio padre no era repositorio git,
por lo que todos los comandos git posteriores se hicieron dentro de Atlas;
el Python del sistema no tenía pytest, resuelto con el venv de /tmp. No son
bloqueos pendientes.

## Consulta real separada de las pruebas simuladas

Se ejecutó **una sola solicitud** Open-Meteo para Atacama (−24.102, −70.138),
mediante el adaptador real `fetch_open_meteo`, sin credenciales. Se guardó el
resultado normalizado en `/tmp/selene-m2-open-meteo-real.json`. No se consultó
el catálogo completo ni se modificó snapshot alguno.

Comando ejecutado:

```sh
/tmp/selene-m2-backend-venv/bin/python - <<'PY'
import asyncio
import json
from pathlib import Path
import httpx
from server import telemetry

async def run():
    result = {'kind': 'model', 'scenario': 'hyperarid-salt', 'site': 'atacama',
              'lat': -24.102, 'lon': -70.138, 'fetchedAt': telemetry.iso(telemetry.utc_now()),
              'requestCount': 1, 'provider': 'open-meteo'}
    try:
        async with httpx.AsyncClient(timeout=telemetry.HTTP_TIMEOUT) as client:
            reading = await telemetry.fetch_open_meteo(client, result['lat'], result['lon'])
        result.update(reading)
        result['status'] = 'ok'
    except telemetry.ProviderError as exc:
        result.update(status='unavailable', errorType=type(exc.__cause__).__name__)
    Path('/tmp/selene-m2-open-meteo-real.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False, indent=2))

asyncio.run(run())
PY
```

Resultado: exit 0, status ok, **surfacePressurePa=90230.0**,
observedAt **2026-11-15T00:45:00Z**, fetchedAt **2026-11-15T00:48:01Z**,
temperatureC=21.3. La hora UTC corresponde aún al 14 de noviembre en Guatemala.
Se trata de modelo meteorológico, no medición in situ ni validación física.

## Fuentes oficiales

- https://open-meteo.com/en/docs
- https://www.meteomatics.com/en/api/available-parameters/weather-parameter/atmospheric-pressure-and-density/
- https://www.meteomatics.com/en/api/response/reserved-values/

## Límites y trabajo restante

El alcance backend quedó completo y documentado. No se comprobó el permiso de
una cuenta real Meteomatics para presión ni se consumió su cuota; el respaldo
está probado con simulaciones. No se afirma dosimetría real ni física validada.
Frontend, registro automático, informe Excel y launcher pertenecen al otro
worker; integración y cualquier cambio en docs/contracts.md corresponden al
coordinador. No quedan bloqueos de backend.
