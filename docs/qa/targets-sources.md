# Fuentes de los objetivos Luna/Marte (Frente 2)

Generado por `scripts/fetch-targets.py` (venv `.venv-planet`: rasterio, numpy, pillow, pyproj). Fecha de acceso de todas las fuentes: **2026-11-14**. Ninguna fuente pide credenciales. Ningún valor de elevación es sintético: si una ventana tiene huecos, el script falla en vez de rellenar.

Receta común (contrato §2): marco azimutal equidistante local sobre la esfera del cuerpo (Luna R = 1 737 400 m, Marte R = 3 396 190 m), así que fila 0 = norte y columna 0 = oeste, también en el polo. Se promedia el DEM a celdas de 18.75 m, se muestrea una pre-rejilla de 129×129 y se pasa a 65×65 a 37.5 m con `terrain_metrics.bilinear_resample`. Las métricas salen de `terrain_metrics.compute_metrics`.

## Elevación e imagen

| Objetivo | Centro (lat, lon E+) | Producto DEM | Versión / ID | URL | Res. nativa | Imagen de contexto | Limitaciones |
| --- | --- | --- | --- | --- | --- | --- | --- |
| shackleton | -89.78306, -155.7435 (cresta del borde) | LRO LOLA LDEM 5 m/pix, Site04 «Shackleton rim» (NASA GSFC PGDA, Barker et al. 2021, PSS 203:105119) | `Site04_final_adj_5mpp_surf.tif` (estereográfica polar sur, MOON_ME DE421) | https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_surf.tif · https://pgda.gsfc.nasa.gov/products/78 | 5 m (~90 % de píxeles interpolados) | Relieve sombreado calculado del mismo LDEM (no es foto) | La resolución efectiva es más gruesa que 5 m entre huellas LOLA. El centro se afina automáticamente al máximo suavizado de la cresta. |
| marius-hills | 14.091, -56.777 (pozo de Marius Hills, 303.223°E) | SELENE/Kaguya TC DTM v2.0 (USGS Astrogeology, ASP + LOLA) | `TC1W2B0_01_02742N140E3036__TC2W2B0_01_02742N145E3036` (colección STAC `kaguya_terrain_camera_usgs_dtms_v2`) | https://stac.astrogeology.usgs.gov/api/collections/kaguya_terrain_camera_usgs_dtms_v2/items/TC1W2B0_01_02742N140E3036__TC2W2B0_01_02742N145E3036 | ~33 m | Ortoimagen TC izquierda del mismo par (JAXA/SELENE; USGS) | Los pares de 18 m y 26 m tienen huecos del 16 al 52 % en la ventana y se descartaron. El pozo (~65 m) no se resuelve. |
| jezero | 18.4447, 77.4508 (sitio Octavia E. Butler) | MRO HiRISE DTM (Univ. of Arizona, COG USGS) | `DTEEC_045994_1985_046060_1985_U01` (STAC `mro_hirise_socet_dtms`, licencia CC0-1.0) | https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/ESP_045994_1985_ESP_046060_1985/DTEEC_045994_1985_046060_1985_U01.tif | 1 m | Ortoimagen HiRISE `ESP_045994_1985_RED_C_01_ORTHO` (NASA/JPL/UArizona) | El promedio a 18.75 m elimina rocas y megaripples. El frente del delta queda en el borde oeste. |
| valles-marineris | -12.84, -60.58 (299.42°E, pared norte de Coprates Chasma) | MRO CTX DTM (USGS Astrogeology, ASP, controlado a MOLA) | `D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W` (STAC `mro_ctx_controlled_usgs_dtms`, CC0-1.0) | https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/ctx/controlled/usgs/D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W/D21_035410_1669_XN_13S060W__D20_034988_1669_XN_13S060W_dtm.tif | 20 m | Ortoimagen CTX del mismo DTM (NASA/JPL/MSSS) | El centro sale de `choose_valles_center()`: la ventana con mayor pendiente p50 y desnivel < 1500 m. Es un talud de pared, no el fondo del cañón. |

Los cuatro DEM tienen resolución ≤ 75 m, así que `metrics.comparable = true`.

## Métricas (rejilla 65×65 a 37.5 m)

| Objetivo | Pendiente p50 | Pendiente p90 | Desnivel p95−p5 | TRI medio | Rugosidad |
| --- | --- | --- | --- | --- | --- |
| shackleton | 16.97° | 31.6° | 541.8 m | 10.5 m | Mini-RF CPR 0.605 |
| marius-hills | 1.73° | 5.46° | 58.5 m | 1.22 m | null (sólo 45 % de cobertura Mini-RF) |
| jezero | 1.97° | 4.32° | 47.4 m | 1.24 m | null |
| valles-marineris | 23.0° | 31.3° | 803.8 m | 11.65 m | null |

## Térmica, rugosidad y entorno

| Objetivo | Dato | Producto | URL | Resolución / alcance | Limitaciones |
| --- | --- | --- | --- | --- | --- |
| shackleton | thermal `diviner` (meanK = media anual, maxK = máximo anual) | LRO Diviner Polar Resource Product LRO-L-DLRE-5-PRP-V2.0 (Paige et al. 2010, Science 330:479) | https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_prp/dlre_prp_south.tab (lectura por rango HTTP) | Celdas de ~0.5 km dentro de la ventana | El producto no trae mínimo anual: `minK = null`, `curve = null`. |
| marius-hills | thermal `diviner` con curva por hora local lunar | LRO Diviner Global Cumulative Product LRO-L-DLRE-5-GCP-V1.0 (Williams et al. 2017, Icarus 283:300) | https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_gcp/global_cumul_avg_cyl_10n20n_002.tab | Celda de 0.5° (~15 km), Tbol 2009–2015 | Describe el mare, no el interior del pozo. Una hora local no tiene observaciones, así que la curva tiene 23 puntos. |
| shackleton, marius-hills | roughness CPR | LRO Mini-RF Global Mosaic CPR 128 ppd (LRO-L-MRFLRO-5-GLOBAL-MOSAIC-V1.0) | https://pds-geosciences.wustl.edu/lro/lro-l-mrflro-5-global-mosaic-v1/lromrf_1001/data/128ppd/global_cpr_128ppd_simp_0c.img | ~237 m/px, banda S | Sólo se publica si ≥ 80 % de los nodos tienen dato. Es un valor regional y no tiene equivalente terrestre. |
| jezero, valles-marineris | thermal `model` (curva Ls 0°; min/max/mean sobre Ls 0/90/180/270) | Mars Climate Database v6.2, escenario climatológico (LMD/OU/IAA/ESA/CNES) | http://www-mars.lmd.jussieu.fr/mcd_python/cgi-bin/mcdcgi.py | Rejilla del GCM más correcciones de alta resolución | Es un modelo, no una medición: no son MEDA ni THEMIS. |
| todos | environment | Constantes: g Luna 1.62 / Marte 3.71 m/s²; constante solar 1361 / ~590 W/m²; día 708.7 h / 24.66 h | — | — | Marte usa la constante solar media (varía entre ~490 y ~715 W/m² con la excentricidad). |

## Licencias de imagen

- HiRISE y CTX: el catálogo STAC de USGS declara CC0-1.0. Créditos: NASA/JPL-Caltech/University of Arizona y NASA/JPL-Caltech/MSSS.
- Kaguya TC: datos © JAXA/SELENE, uso libre con atribución según la política del archivo SELENE. La ortoimagen la procesa USGS.
- Shackleton: relieve sombreado propio a partir de datos NASA (dominio público).
