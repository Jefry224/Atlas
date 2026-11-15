# Revisión visual V1.1

Objetivo: permitir explorar primero y leer detalles solo cuando sean útiles.

- **Jerarquía:** ensayo → mapa → sitio seleccionado. Se redujo el encabezado y se compactaron los perfiles para adelantar el mapa, especialmente en móvil.
- **Mapa:** conserva la cartografía Natural Earth y los puntos aproximados originales. La banda del sitio seleccionado conecta la ubicación con su ficha.
- **Comparación:** barras de puntuación en la lista y una barra segmentada por peso en la ficha. Codifican el ranking documental existente; no simulan medidas físicas ni porcentajes de parecido.
- **Ilustraciones:** cuatro SVG originales para dunas, terreno rocoso, planicie árida y desierto polar. Son categorías visuales basadas en etiquetas del catálogo, con aviso visible y texto alternativo. No hay fotos de procedencia incierta ni superposición de relieve inventado sobre el mapa.
- **Detalle progresivo:** evidencia, criterios, coordenadas, fuentes y metodología se abren con controles nativos `details/summary`. No se eliminaron las limitaciones científicas.
- **Sistema visual:** superficie azul-negra, acento cian reservado para selección y datos registrados, arena o gris en ilustraciones. Tipografía del sistema y SVG ligeros, sin dependencias externas.
- **Responsive:** perfiles en tres columnas; mapa antes del listado; ficha visual apilada en móvil. La lista sigue disponible cuando los marcadores cercanos se superponen.
- **Accesibilidad:** botones reales con nombres completos, foco visible, estado seleccionado, anuncios breves, texto alternativo y rayado para datos sin registrar. La verificación parcial está en `qa.md`.
