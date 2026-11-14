# Analog Atlas

Explorador mundial de desiertos y terrenos áridos para investigar dónde ensayar movilidad, navegación o muestreo para misiones a Marte y la Luna.

**V1.1 visual, con ranking documental:** 14 sitios, tres perfiles, mapa sin dependencias, ranking explicable y fuentes por ficha. Los puntos se basan en características documentadas y pesos editoriales. **No son un porcentaje de similitud planetaria ni una validación científica.** Los modelos de elevación enlazados todavía no se han procesado.

Prototipo independiente para explorar el [reto de NASA Space Apps 2026](https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/). No implica afiliación ni aprobación de NASA.

## Abrir la demo

Abrí `index.html` directamente en un navegador moderno. No necesitás instalar dependencias ni generar un build. Para servirla localmente, desde esta carpeta:

```bash
python3 -m http.server 8000
```

Entrá a [localhost:8000](http://localhost:8000). El mapa, el catálogo y el ranking funcionan sin conexiones de red. Los enlaces a las fuentes sí requieren internet.

1. Elegí **Marte · Dunas**, **Luna · Terreno rocoso** o **Marte · Muestreo**.
2. Seleccioná un lugar desde el mapa o la lista. Ambos resaltan el mismo sitio.
3. Abrí su ficha visual. Desplegá «Por qué aparece en este perfil» o «Ver fuentes y límites» cuando quieras entrar al detalle.
4. Contrastá las fuentes antes de proponer un ensayo.

Los botones funcionan con teclado y muestran foco. En pantallas pequeñas algunos marcadores cercanos se superponen; los 14 sitios siguen disponibles desde la lista y mediante teclado. «Ver sitio» salta a la ficha seleccionada.

## Cómo se calcula

| Perfil | Criterios y pesos |
| --- | --- |
| Marte · Dunas | Campo de dunas (50), entorno seco (20), dunas en media luna (20), pruebas de movilidad (10) |
| Luna · Terreno rocoso | Superficie rocosa (35), relieve irregular (30), terreno volcánico (15), ensayo con sombras largas (15), entorno seco (5) |
| Marte · Muestreo | Hiperaridez documentada (55), entorno seco (15), perforación documentada (30) |

Para cada sitio se suman los pesos de las etiquetas registradas. Un criterio sin dato en la ficha suma cero, **sin afirmar que el atributo esté ausente**. Los empates priorizan un antecedente del perfil y luego el nombre, con ordenación española. No hay aleatoriedad. La configuración está al principio de `app.js`; `createRanking` y `readCriteria` son las mismas funciones usadas por la interfaz y los tests.

Los pesos son decisiones del prototipo, no parámetros calibrados frente a Marte o la Luna. Los antecedentes influyen en este ranking documental. En una futura comparación geométrica deberán mostrarse por separado, sin favorecer un lugar por su prestigio. «Rocoso» e «irregular» son descripciones cualitativas, no mediciones comparables de bloques, rugosidad o pendiente.

## Evidencia y límites

- Las fichas distinguen antecedentes documentados de candidatos propuestos para evaluación. Un antecedente puede ser robótica, formación humana o una comparación científica; la ficha especifica cuál.
- Las coordenadas sitúan regiones de interés y no son polígonos de ensayo. Salvo indicación de una fuente puntual, no se han revalidado cartográficamente. La evidencia de Haughton para operaciones lunares es del cráter, no necesariamente del punto Drill Hill.
- La hiper-aridez de Pampas de La Joya está documentada en sectores regionales, pero no se otorgan esos puntos al marcador dunar sin demostrar su coincidencia con el sector estudiado.
- La muestra no es exhaustiva ni demuestra que un sitio sea accesible o seguro. Son necesarias mediciones a la escala del ensayo, permisos, evaluación ambiental y comprobación de campo.
- El relieve terrestre no reproduce por sí solo la gravedad, iluminación, regolito, atmósfera, química o biología de otro mundo.
- [Auditoría documental de los 14 sitios](docs/source-audit.md), con fuentes contrastadas, disponibilidad y límites pendientes.

## Fuentes y atribución

Las fuentes institucionales y publicaciones de cada lugar están en `data.js` y visibles en la ficha. Las cuatro ilustraciones de terreno son SVG originales creados para la interfaz. Resumen categorías del catálogo; no representan geometría medida ni fotografías de los lugares. Las barras codifican únicamente puntos documentales.

La geometría del mapa utiliza [Natural Earth, 1:110m land](https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/), dominio público, en proyección equirectangular. No se sirven mapas ni imágenes de terceros en tiempo real.

Fuentes previstas para la fase medida, **aún no descargadas ni procesadas en esta V1**:

| Fuente | Referencia y uso previsto |
| --- | --- |
| [HiRISE, University of Arizona / NASA JPL](https://www.uahirise.org/dtm/dtm.php?ID=ESP_017762_1890) | DTM de dunas de Nili Patera, ID de escena `ESP_017762_1890`; referencia marciana de movilidad |
| [NASA Goddard, LOLA 5 m/píxel](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/) | Malapert Massif, Site23; referencia lunar de relieve |
| [Copernicus DEM](https://registry.opendata.aws/copernicus-dem/) | DEM terrestre para recortes comparables; citar producto y versión concretos al usarlo |
| [Geomorphlab, dune-world](https://github.com/geomorphlab/dune-world) | Inventario de dunas para generar candidatos; fijar revisión del inventario al procesarlo |
| [ESA WorldCover](https://esa-worldcover.org/en/data-access) | Contexto de cobertura terrestre; registrar versión al usarlo |
| [NASA ARADS](https://www.nasa.gov/universe/atacama-rover-astrobiology-drilling-studies-arads/) | Caso terrestre de perforación y muestreo, no referencia de un terreno de Marte |

Cada dataset conserva sus propios términos, créditos y requisitos de atribución. Esta V1 enlaza los datasets; no redistribuye los rásteres ni presenta resultados calculados a partir de ellos.

## Comprobaciones

Con Node.js 18 o posterior, sin instalar paquetes:

```bash
npm run check
```

Incluye revisión sintáctica y diez pruebas de catálogo, puntuación, empates, estados, selección de los 14 sitios por los dos controles en los tres perfiles y clics repetidos. El arnés DOM es simulado: **no sustituye revisión visual, pruebas reales de teclado ni evaluación completa de accesibilidad**. Consultá el [informe y checklist de QA](docs/qa.md).

## Archivos

- `index.html`, `styles.css`, `app.js`, `data.js`, `README.md`: los cinco archivos base de la V1.
- `tests/atlas.test.cjs`, `package.json`: comprobaciones reproducibles, sin dependencias.
- `tests/responsive-preview.html`: la aplicación real en marcos de 390 × 844 y 320 × 568 px para revisar el CSS responsive.
- `assets/terrain-*.svg`: cuatro ilustraciones conceptuales originales, rotuladas como esquemas, no fotos ni modelos de los sitios.
- `docs/source-audit.md`, `docs/qa.md`: procedencia, decisiones conservadoras y estado de verificación.

## Próxima fase científica

La siguiente entrega puede comparar Nili Patera con ventanas reproducibles de Merzouga, Dumont, Namib, Pampa de La Joya, Simpson y un control llano. Requiere proyección métrica por cuerpo, escala común, cobertura válida, pendientes calculadas después de remuestrear y pruebas sintéticas. Las métricas previstas son mediana y p90 de pendiente y desnivel p95–p5, con ranking normalizado y análisis de sensibilidad. Malapert y la búsqueda mundial vendrían después.

No existe todavía `metrics.json`, un modo de comparación medida ni una tabla validada de esos sectores. No deben deducirse del puntaje documental.
