# Modelos 3D

- `perseverance.glb`: Mars 2020 Perseverance Rover 3D model, NASA/JPL-Caltech.
  Fuente: https://science.nasa.gov/resource/mars-perseverance-rover-3d-model/ (archivo glTF del 8 mar 2024, 11.15 MB).
  Uso conforme a las NASA Media Usage Guidelines; no implica aprobación ni afiliación de NASA.

## Colección NASA local (`nasa/`)

Adquirida de fuentes oficiales y preparada el 14 de noviembre de 2026. Inventario,
URLs de descarga, bytes, SHA256, transformaciones y límites en
[`nasa-assets.json`](../data/nasa-assets.json) y
[`docs/nasa-assets.md`](../../docs/nasa-assets.md). Los originales necesarios
para reconstruir conversiones están en `nasa/originals/`.

- `nasa/scarecrow.glb`: Curiosity Scarecrow Test Rover, **NASA/JPL-Caltech**.
  [Fuente NASA](https://science.nasa.gov/3d-resources/curiosity-scarescrow-test-rover/).
  Blender oficial convertido localmente a GLB, con correcciones de migración de
  materiales, transformaciones horneadas y helpers ocultos excluidos. Caso histórico
  de aproximación del peso estático; no equivalencia dinámica universal.
- `nasa/perseverance.glb`: Mars 2020 Perseverance Rover, **NASA/JPL-Caltech**.
  [Fuente NASA](https://science.nasa.gov/3d-resources/mars-2020-perseverance-rover/).
  Variante oficial de 4.76 MB decodificada offline sin Draco; distinta del archivo
  `perseverance.glb` anterior, que se conserva. Original en `nasa/originals/`.
- `nasa/moon.glb`: Moon 3D Models for Web, AR, and Animation,
  **NASA’s Goddard Space Flight Center**.
  [Fuente NASA SVS 14959](https://svs.gsfc.nasa.gov/14959/).
  `moon_small.glb` sin modificar: esfera de color **sin topografía**.
- `nasa/mars.glb`: Planet Mars, 3D Model, **NASA/JPL-Caltech**.
  [Fuente NASA](https://science.nasa.gov/resource/planet-mars-3d-model/).
  GLB oficial sin modificar, recurso visual sin uso para métricas de terreno.
- `nasa/lro.glb`: Lunar Reconnaissance Orbiter (A),
  **NASA/Christopher R. Meaney**.
  [Fuente NASA](https://science.nasa.gov/3d-resources/lunar-reconnaissance-orbiter-a/).
  Draco oficial decodificado offline; original conservado.
- `nasa/block-island.glb`: Opportunity Rover: Block Island,
  **NASA/JPL-Caltech**.
  [Fuente NASA](https://science.nasa.gov/resource/opportunity-rover-block-island-3d-model/).
  STL convertido sin simplificar, material neutro ilustrativo añadido.
  **Unidades desconocidas**, sin ubicación inferida en los escenarios.
- `nasa/apollo-11.glb`: Apollo 11 – Landing Site, **NASA**.
  [Fuente NASA](https://science.nasa.gov/3d-resources/apollo-11-landing-site/).
  STL convertido sin simplificar, material neutro añadido. Ventana 30×30 km,
  **exageración vertical ×60 preservada**; sólo ejemplo educativo, excluido de
  métricas y cálculo de pendientes.
- `../textures/nasa/moon-color.jpg`: CGI Moon Kit, **NASA’s Scientific
  Visualization Studio / Ernie Wright**.
  [Fuente NASA SVS 4720](https://svs.gsfc.nasa.gov/4720/).
  JPEG oficial equirectangular 2K centrado en 0°, optimizado para estética,
  no para análisis científico.
- `../textures/nasa/mars-color.jpg`: Viking MDIM 2.1 color mosaic,
  **NASA/JPL-Caltech/USGS**, servido por NASA Mars Trek.
  [Fuente y API oficial](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars).
  Mosaico local de 32 teselas oficiales, 2048×1024, recodificado a JPEG;
  norte arriba, 0° central, extensión −180° a +180°, sólo contexto visual.

Uso conforme a [NASA Images and Media Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)
y las atribuciones de cada fuente. Las conversiones son locales y no implican
aprobación, afiliación o validación de la simulación por NASA.
