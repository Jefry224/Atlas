# Verificación de Analog Atlas V1

Fecha: 14 de noviembre de 2026.

## Resultado local

`npm run check`: **10 pruebas aprobadas; 0 fallos**. Se ejecutaron además `node --check app.js` y `node --check data.js`.

Comprobado de forma automatizada:

- 14 registros con IDs únicos, coordenadas numéricas acotadas y fuentes HTTPS.
- Tres perfiles; criterios sin duplicados y pesos positivos que suman 100.
- Puntajes reproducibles y contribuciones reconciliadas; etiquetas faltantes no suman puntos.
- Desempates por evidencia del perfil y nombre; el resultado no depende del orden de entrada.
- Ejemplos: Merzouga/Dumont, Black Point y Atacama/ARADS conservan su evidencia del perfil.
- Pampa de La Joya no recibe los 55 puntos de hiper-aridez sin soporte puntual.
- En DOM simulado: 14 marcadores y 14 entradas para cada perfil; selección de cada sitio desde ambos controles mantiene sincronizados el detalle y `aria-pressed`.
- En DOM simulado: cambios de perfil y selecciones repetidas no duplican entradas ni selecciones activas.
- Recursos locales, destinos de anclas, aviso de alcance, alternativa sin JavaScript y reglas de foco/movimiento reducido presentes.

La auditoría documental está en [source-audit.md](source-audit.md). Los límites de coordenadas y de evidencia se indican explícitamente; no se ha hecho una auditoría geoespacial del catálogo completo.

## Revisión visual y de interacción completada

La revisión V1.1 se abrió desde un servidor temporal en la terminal de la misma PC visible que usa Chromium. Los intentos previos desde el ejecutor aislado no eran accesibles al navegador; esa limitación quedó resuelta para esta revisión.

- **Escritorio:** interfaz inspeccionada visualmente a 1165 px de ancho útil. Mapa central, controles compactos, ilustración conceptual y detalles plegados. `clientWidth` y `scrollWidth` coinciden: sin desbordamiento horizontal.
- **Flujo real de los tres perfiles:** Merzouga desde la lista, Black Point desde el mapa activado con Enter y Atacama/ARADS desde el listado. Ficha, marcador y fila seleccionada quedaron sincronizados.
- **Teclado:** la activación de Black Point con Enter mostró foco visible de contorno sólido. Los desplegables se abrieron con clic y cerraron con Enter.
- **Responsive:** `tests/responsive-preview.html` carga la app real dentro de marcos de 390 × 844 y 320 × 568 px. Se revisaron ambos visualmente y se comprobó que el ancho desplazable coincide con el útil. La barra de desplazamiento consume 15 px en este Chromium, por lo que el contenido mide 375 y 305 px respectivamente. Tras el ajuste final, el mapa ocupa de y=318 a 488 px en el marco de 390 px, y de y=338 a 477 px en el de 320 px: aparece completo dentro de la primera pantalla. Se seleccionó Wright Valley desde el final del listado móvil; ficha, marcador e ilustración se actualizaron correctamente y sus fuentes se desplegaron sin desbordamiento.
- **Gráficos:** las ilustraciones locales se muestran y están rotuladas como conceptuales, no fotografías. La barra segmentada distingue criterios documentados de criterios sin dato con trama, además del texto.

Esta comprobación de viewport **no simula un teléfono físico, su agente de usuario ni la entrada táctil**. No es una certificación WCAG ni una prueba completa con lectores de pantalla. No se midieron rendimiento de red ni Core Web Vitals. La verificación exhaustiva de 14 sitios × 3 perfiles sigue cubierta por el arnés automatizado; en navegador se realizaron los ejemplos descritos, no una segunda pasada exhaustiva de todas las combinaciones.

Las fuentes y los 14 registros de `data.js` no se modificaron en esta revisión visual. Las puntuaciones y pesos siguen siendo los mismos.

## Publicación

La verificación del repositorio público, commit remoto, GitHub Pages y sus recursos depende del entorno de publicación. Este informe local no acredita esos pasos. Completar aquí o en la entrega el enlace y hash realmente verificados.
