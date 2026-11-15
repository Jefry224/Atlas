# Recursos visuales NASA locales de Atlas

Preparación del 14 de noviembre de 2026. Siete modelos GLB2 y dos texturas de contexto están disponibles en `assets/data/nasa-assets.json` (`NasaVisualAssets`, versión `1.0.0`). Los archivos para navegador suman **55,748,043 bytes**; se conservan además los originales necesarios para reconstruir las conversiones y las teselas de Marte. Todo recurso visual se carga localmente después de la preparación; las URL del manifiesto son procedencia, no dependencias de ejecución.

La integración visual pertenece a los módulos de UI. Este paquete no modifica DEM, escenarios, motor de pendientes, física, calibraciones ni el anterior `assets/models/perseverance.glb` (11.7 MB según README). Los modelos no certifican la simulación ni constituyen mediciones locales de los escenarios.

## Inventario y fuentes

| ID | Archivo local | Bytes | Triángulos | SHA256 |
| --- | --- | ---: | ---: | --- |
| scarecrow | `assets/models/nasa/scarecrow.glb` | 2254596 | 16026 | `ac4cbe068dab1f6094473040183b15f2a84997ae006f5525392f7dffe4b0e164` |
| perseverance | `assets/models/nasa/perseverance.glb` | 9207660 | 199521 | `eba502e91c1ccd1d40de7f3c264717a5fb3e301c4eddebc2b9dc430313fb16d7` |
| moon | `assets/models/nasa/moon.glb` | 13799876 | 23232 | `12d3b0bb7fe214903f51447d1bc61710f442e92a11c703fcaca6d4e7ff8e67d4` |
| mars | `assets/models/nasa/mars.glb` | 4032148 | 3072 | `0d27fc65fe3e6a5847cf0cd3a5c951538afdd49bd0513607d8a70e8ab1d8d7ac` |
| lro | `assets/models/nasa/lro.glb` | 5994336 | 76349 | `cc244acc4099ce5205a4b9d9c319e912d7a5ec12e6853864a02eaac9a8c4bfaa` |
| block-island | `assets/models/nasa/block-island.glb` | 12063224 | 143738 | `007c8b2c7b91e75c3f7c96be6b2ee44df15df5dea0b34de82e5294f261ea4a0b` |
| apollo-11 | `assets/models/nasa/apollo-11.glb` | 6814780 | 142768 | `f64c59f19792a44fe78b2f35985aad4d744240de0c83f44a33cb54cd1c93f9b1` |
| moon-color | `assets/textures/nasa/moon-color.jpg` | 457942 | — | `f7130a1822681fa7512d7dcfd40db8c10b9ba4f06777910348698260ed7a2170` |
| mars-color | `assets/textures/nasa/mars-color.jpg` | 1123481 | — | `72fa357af89622faca8d54e771647566a54faad30f75e9b1f520fb40b1f66e6e` |

Los bytes y SHA256 corresponden al archivo que carga el navegador, después de convertir cuando procede. El manifiesto conserva por separado `originalPath`, `originalBytes` y `originalSha256` para los originales convertidos. `source-receipts.json` registra URL efectiva, MIME HTTP, bytes y SHA256 descargados. Los bounds usan coordenadas visuales; **no convierten las unidades desconocidas en metros**. `geometry` cuenta primitivas del GLB final; los informes de conversión incluyen la geometría visible de Blender antes de exportar.

| Recurso | Fuente oficial y crédito | Alcance y preparación |
| --- | --- | --- |
| Scarecrow | [NASA Science](https://science.nasa.gov/3d-resources/curiosity-scarescrow-test-rover/); NASA/JPL-Caltech. También [repositorio oficial](https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models/Curiosity%20Scarecrow%20Test%20Rover). | ZIP oficial con Blender 4.2, convertido a GLB2. La errata `scarescrow` pertenece a la URL oficial. Sistema de movilidad de Curiosity aligerado para ensayos terrestres: caso histórico de aproximación del peso estático marciano. Cambiar masa cambia inercia; no establece equivalencia dinámica universal. |
| Perseverance | [NASA Science · Mars 2020 Perseverance Rover](https://science.nasa.gov/3d-resources/mars-2020-perseverance-rover/); NASA/JPL-Caltech. | Variante oficial de 4.76 MB publicados (4,987,176 bytes reales), diferente al archivo previo de Atlas. Se conserva intacta en `originals/perseverance.glb`; GLB visual derivado sin Draco, 9,207,660 bytes. No se alteró el archivo previo fuera de `nasa/`. |
| Luna | [NASA SVS 14959](https://svs.gsfc.nasa.gov/14959/); NASA’s Goddard Space Flight Center. | `moon_small.glb` original, 13.2 MB publicados. **Mapa de color en esfera sin topografía**, sin grilla. No se eligió la variante de 51–299 MB. Se conserva orientación nativa, sin atribuir ejes geográficos al GLB. |
| Marte | [NASA Science · Planet Mars](https://science.nasa.gov/resource/planet-mars-3d-model/); NASA/JPL-Caltech. | GLB oficial de 3.85 MB publicados, conservado byte por byte. Sus imágenes internas son atlas PNG de 2048×1536, no se reinterpretan como mapa equirectangular. No es un DEM para las métricas de Atlas. |
| LRO (A) | [NASA Science](https://science.nasa.gov/3d-resources/lunar-reconnaissance-orbiter-a/); **NASA/Christopher R. Meaney**. | Original de 654,500 bytes conservado en `originals/lro.glb`; Draco decodificado offline a GLB sin compresión de geometría. No precisa DRACOLoader ni descarga de decodificadores. |
| Block Island | [NASA Science · Opportunity Rover: Block Island](https://science.nasa.gov/resource/opportunity-rover-block-island-3d-model/); NASA/JPL-Caltech. | STL oficial binario convertido sin simplificar. Material neutro ilustrativo añadido porque STL no codifica color. Coordenadas originales a escala numérica 1; **unidades físicas desconocidas**, sin ubicación inventada en los escenarios. |
| Apollo 11 | [NASA Science · landing site](https://science.nasa.gov/3d-resources/apollo-11-landing-site/); NASA. | STL oficial convertido sin simplificar. La ficha declara ventana de **30×30 km y exageración del eje Z ×60**. Se conserva esa exageración; al exportar a glTF, el eje vertical pasa a Y. No se corrige ni se reutiliza como relieve cuantitativo para pendientes. Unidades numéricas del STL no verificadas. |
| Moon color | [NASA SVS · CGI Moon Kit, 4720](https://svs.gsfc.nasa.gov/4720/); NASA’s Scientific Visualization Studio / Ernie Wright. | JPEG oficial 2K disponible actualmente, guardado directamente; no hace falta JPEG2000 ni conversión. Mapa centrado en longitud 0°. La fuente advierte que está optimizado para estética y no para ciencia; los polos incluyen relleno y otra información de albedo. |
| Mars color | [NASA Mars Trek WMTS](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars); NASA/JPL-Caltech/USGS · Viking MDIM 2.1 color mosaic. | Complemento solicitado por el worker UI para posicionar marcadores sin asumir orientación de los GLB. Mosaico de 32 teselas oficiales nivel 2, guardadas con hashes, concatenadas sin reescalar a 2048×1024. Recodificación JPEG calidad 95 y sin submuestreo con Pillow 12.0.0. Sólo contexto visual. |

## Transformaciones y compatibilidad

Scarecrow se abrió con **Blender 4.5.9 LTS** (hash de build `8bf95cbd38d1`) sin ejecutar scripts embebidos. El archivo fuente contiene materiales de Blender 4.2; al abrirlos en 4.5, los tres Principled tenían `Weight=0`. Se restauró `Weight=1`, manteniendo sus conexiones originales de color y texturas. El material legacy `foil_gold` se migró a Principled con su color original, metallic 0.65 y roughness 0.5 como elección visual, no medición del material. Las dos imágenes usadas por los materiales finales están embebidas; las otras imágenes empaquetadas quedan conservadas dentro del original Blender.

Se evaluó el frame 1 y se hornearon las transformaciones de mundo antes de quitar la jerarquía auxiliar, corrigiendo el winding de piezas espejadas con determinante negativo. Se excluyeron helpers ocultos, luces y empties, registrados en `scarecrow.conversion.json`. Resultado: **25 mallas y 16,026 triángulos**, sin decimación, sin piezas sustitutas ni reescalado físico. El exportador realiza la conversión estándar de Blender Z arriba a glTF Y arriba.

Perseverance y LRO contienen Draco en sus versiones oficiales. Blender lo decodificó durante preparación y exportó GLB con geometría ordinaria. Sus materiales e imágenes se preservaron mediante el importador/exportador glTF; no se exportaron animaciones. Perseverance conserva un skin del modelo original y su pose estática; no es una nueva implementación validada de articulaciones. Los helpers de visualización de armature creados por Blender no forman parte del GLB final. La escena visual no se simplificó; los recuentos finales están en el manifiesto.

Los dos STL conservan coordenadas numéricas y orientación original al importarse como Z arriba; después pasan a glTF Y arriba. No se deducen unidades desde el tamaño del bounding box. Los materiales de esos STL son neutros e ilustrativos. Ninguna malla se decimó. Los archivos individuales de ejecución están por debajo de 14 MB; los originales son archivos de preparación y no se cargan en la UI.

## Orientación de las texturas para globos

`moon-color.jpg` es equirectangular, con norte arriba y meridiano 0° central, conforme al CGI Moon Kit. `mars-color.jpg` usa el sistema declarado por las [Capabilities oficiales de Mars Trek](https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/WMTSCapabilities.xml): extensión `[-180,-90,180,90]`, esquina superior izquierda `[-180,90]`, matriz `default028mm`, nivel 2 de 8 columnas×4 filas y teselas 256×256. La copia del XML y su hash están en `projection.capabilitiesPath`/`capabilitiesSha256`; cada tesela tiene URL, MIME y SHA256 en `assets/textures/nasa/originals/mars-color/tiles.json`.

Para ambas imágenes, longitud crece hacia la derecha: centro 0°, borde izquierdo −180°, derecho +180°. La orientación concreta de una esfera Three.js depende de su UV y transformaciones; la UI debe alinear sus coordenadas y marcadores con esta convención. Ninguna textura convierte la esfera en topografía ni aporta resolución científica a los marcadores. El registro geográfico de los GLB oficiales no se asumió.

## Reproducir y comprobar offline

Verificación estándar, sin instalaciones ni red, desde `Atlas`:

```bash
python3 scripts/prepare-nasa-assets.py --verify
```

Comprueba contrato, disponibilidad real, bytes/SHA256, cabecera GLB2, longitud de chunks, bufferViews dentro de límites, imágenes embebidas con MIME/cabeceras coincidentes, escenas/mallas y ausencia de decodificadores externos. Verifica también originales ZIP/STL/GLB y hashes de las 32 teselas. El manifiesto se publicó inicialmente con `available=false` y se actualizó mediante reemplazo atómico al terminar cada recurso; la versión final tiene los nueve recursos disponibles.

Para reconstruir offline con los originales conservados, usá un Blender aislado y un entorno temporal con Pillow 12.0.0. Ejemplo con las herramientas de esta preparación (en `/tmp`, no necesarias para ejecutar Atlas):

```bash
/tmp/selene-nasa/venv/bin/python scripts/prepare-nasa-assets.py --rebuild \
  --blender /tmp/selene-nasa/blender-4.5.9-linux-x64/blender
```

La reconstrucción se ejecutó para las cinco conversiones y la textura ensamblada, reproduciendo exactamente los SHA256 finales. `--id scarecrow` limita una reconstrucción; `--download` vuelve a obtener sólo las fuentes oficiales fijadas por SHA256 y exige conexión. Una fuente cambiada se rechaza antes de reemplazarla. Otro exportador puede producir bytes distintos: revisá el resultado antes de usar `--refresh-lock` para actualizar hashes y metadatos. No se agrega ninguna dependencia a `package.json` ni al navegador.

Blender portable se obtuvo de [download.blender.org, 4.5.9 Linux](https://download.blender.org/release/Blender4.5/blender-4.5.9-linux-x64.tar.xz), SHA256 `dcdc3eca6c9825bb35a8033b689c053f3cb5a9b0cd2a61b2eac2a49436b4ad3d`, cotejado con el archivo oficial `blender-4.5.9.sha256`. Las herramientas de conversión no están incluidas en los assets. Pillow 12.0.0 se instaló únicamente en `/tmp/selene-nasa/venv`.

Validación adicional Khronos, con `gltf-validator` **2.0.0-dev.3.10** aislado:

```bash
npm install --prefix /tmp/selene-nasa/validation --ignore-scripts --no-audit --no-fund \
  gltf-validator@2.0.0-dev.3.10
NODE_PATH=/tmp/selene-nasa/validation/node_modules \
  node scripts/prepare-nasa-assets-validate.cjs
```

Los **siete GLB pasaron con cero errores**, sin truncar incidencias. El informe completo con hashes está en `assets/models/nasa/validation.json`. Scarecrow, Luna, LRO y los dos STL convertidos tienen cero warnings. Perseverance conserva 35 avisos de tangentes generadas durante render y uno de skin bajo nodo no raíz; Marte original tiene uno de tangentes generadas y hints sobre `bufferView.target`. Son avisos de portabilidad/render del material, no dependencias de red ni errores estructurales. Se conservan también los mensajes informativos de UV no usadas, nodo vacío e imágenes de dimensiones no potencia de dos. La comprobación de UI/navegador corresponde al worker de integración y no se sustituye por este informe.

## Uso y atribución

Créditos resumidos en [CREDITS.md](../assets/models/CREDITS.md) y en cada entrada del manifiesto. Se enlaza la [guía oficial NASA de uso de imágenes y medios](https://www.nasa.gov/nasa-brand-center/images-and-media/); no se declara una licencia universal para todos los elementos de terceros, logotipos o marcas. Las conversiones locales y decisiones visuales se identifican expresamente; no implican afiliación ni aprobación de NASA. No se hicieron commits, push ni despliegues como parte de esta preparación.

## Apollo Lunar Module (lander visual, added 15 November 2026)

| ID | Local file | Bytes | Triangles | SHA256 |
| --- | --- | ---: | ---: | --- |
| apollo-lunar-module | `assets/models/nasa/apollo-lunar-module.glb` | 2703900 | 97588 | `1ce4ea5349df130f504490994f1a97929a5569bef884439be25a7da9323a8bba` |

- Source: [NASA Science · Apollo Lunar Module](https://science.nasa.gov/3d-resources/apollo-lunar-module/), credit **NASA/Michael D. Carbajal**. The official GLB (716,840 bytes, Draco-compressed, `EXT_texture_webp`) is kept unchanged in `originals/apollo-lunar-module.glb`.
- Preparation: Draco geometry decoded offline with glTF-Transform 4.5.1 + draco3dgltf (installed in a temporary prefix, not an Atlas dependency); node names, materials, WebP/PNG images and `KHR_materials_specular` preserved. No DRACOLoader is needed at runtime. Khronos glTF Validator 2.0.0-dev.3.10: 0 errors, 0 warnings. The 135 single-keyframe Blender actions in the source are kept and never played.
- Geometry: file units unknown; +Y up, foot-pad bottoms at y = 0.1026, top at y = 5.1154 (5.013 units), outer foot-pad span 6.43 units; the forward hatch, porch and ladder face +Z. Useful nodes: `group13 pC` (descent engine bell, exit at y = 0.407, radius 0.497), `group31 19` (all four foot pads), `group31 *` (descent stage), `pCube3` (porch).
- Runtime scale (`lander-visual.mjs`): the height is fitted to **7.0 m** (Apollo LM, gear deployed). The outer foot-pad span then measures **8.98 m**, about 4 % under the commonly quoted 9.4 m, so the model is not rescaled anisotropically. Foil materials are set to metalness 0.9 / roughness 0.35 and grey paint to roughness 0.6. That is a visual choice, not a material measurement; metallic foil needs a scene environment map to read as gold.
- Honesty: the Apollo LM never deployed rovers by ramp. The LRV (Apollo 15–17) was stowed folded in a descent-stage bay and deployed by the astronauts. `rampLocal` is a conceptual aid for Atlas, and the UI must label that deployment «conceptual».
