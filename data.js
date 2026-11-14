// Coordinates locate an approximate sector for browsing, rather than a surveyed boundary.
// Profile uses are reserved for documented trials or direct scientific comparisons.
globalThis.ANALOG_SITES = [
  {
    id: 'merzouga',
    name: 'Merzouga · Erg Chebbi',
    country: 'Marruecos',
    lat: 31.073,
    lon: -3.970,
    terrain: 'Dunas del Sahara y superficies arenosas',
    tags: ['dunes', 'arid', 'rover'],
    uses: { 'mars-dunes': 'LAAS registró trayectorias de dos rovers en Merzouga durante la campaña de robótica planetaria de Erfoud.' },
    summary: 'El sitio de Merzouga forma parte del conjunto de Erfoud. Sus datos de campo incluyen un modelo de elevación y recorridos con cámaras y lidar.',
    sources: [
      { label: 'LAAS-CNRS · Datos de campo de Erfoud', url: 'https://sites.laas.fr/projects/erfoud-dataset/sites.laas.fr/projects/erfoud-dataset/index.html' },
      { label: 'ESA · Pruebas de rovers en Marruecos', url: 'https://www.esa.int/Enabling_Support/Space_Engineering_Technology/Self-driving_rovers_tested_in_Mars-like_Morocco' }
    ]
  },
  {
    id: 'dumont',
    name: 'Dumont Dunes · Mojave',
    country: 'Estados Unidos',
    lat: 35.688,
    lon: -116.222,
    terrain: 'Dunas con pendientes y superficies onduladas',
    tags: ['dunes', 'rugged', 'arid', 'rover'],
    uses: { 'mars-dunes': 'NASA probó aquí el sistema de movilidad de Curiosity y, más tarde, navegación autónoma para aeronaves marcianas.' },
    summary: 'Campo de dunas del Mojave que permite estudiar recorridos sobre arena y percepción visual en un paisaje con pocas referencias.',
    sources: [
      { label: 'NASA · Ensayos en Dumont Dunes', url: 'https://www.nasa.gov/solar-system/planets/mars/nasa-tests-drones-in-death-valley-preps-for-martian-sands-and-skies/' },
      { label: 'BLM · Mapa del campo de dunas', url: 'https://www.blm.gov/sites/default/files/documents/files/Dumont_Final_Mobile_508.pdf' }
    ]
  },
  {
    id: 'maspalomas',
    name: 'Dunas de Maspalomas',
    country: 'España',
    lat: 27.740,
    lon: -15.574,
    terrain: 'Campo costero de dunas móviles',
    tags: ['dunes', 'arid'],
    uses: { 'mars-dunes': 'Un estudio comparó derrumbes de arena de Maspalomas, medidos por láser, con observaciones de Curiosity en la duna Namib de Marte.' },
    summary: 'Las dunas de Gran Canaria aportan una comparación directa con la forma y la dinámica de las pendientes arenosas de Gale.',
    sources: [
      { label: 'Icarus · Comparación Tierra–Marte', url: 'https://www.sciencedirect.com/science/article/pii/S0019103517307534' },
      { label: 'Earth’s Future · Ubicación y dinámica de Maspalomas', url: 'https://agupubs.onlinelibrary.wiley.com/doi/full/10.1002/2016EF000524' }
    ]
  },
  {
    id: 'namib',
    name: 'Namib · Dunas al sur de Gobabeb',
    country: 'Namibia',
    lat: -23.620,
    lon: 15.070,
    terrain: 'Dunas lineales del mar de arena del Namib',
    tags: ['dunes', 'arid'],
    uses: {},
    summary: 'Las dunas lineales cerca de Gobabeb son candidatas para comparar campos de arena. Su tamaño y su forma pueden diferir de las dunas de Gale.',
    sources: [
      { label: 'UNESCO · Mar de arena del Namib', url: 'https://whc.unesco.org/en/list/1430/' },
      { label: 'Geological Survey of Namibia · Geología de Gobabeb', url: 'https://the-eis.com/elibrary/sites/default/files/downloads/literature/The%20Surface%20Geology%20and%20Geomorphology%20Around%20Gobabeb.pdf' }
    ]
  },
  {
    id: 'simpson',
    name: 'Munga-Thirri · Desierto de Simpson',
    country: 'Australia',
    lat: -25.773,
    lon: 138.121,
    terrain: 'Dunas lineales y salares intercalados',
    tags: ['dunes', 'arid'],
    uses: {},
    summary: 'Las crestas paralelas del desierto australiano permiten plantear una comparación del espaciado y la orientación de dunas a escala de paisaje.',
    sources: [
      { label: 'NASA Earth Observatory · Desierto de Simpson', url: 'https://science.nasa.gov/earth/earth-observatory/munga-thirrisimpson-desert-park-150201/' },
      { label: 'Atlas of Living Australia · Sector de Munga-Thirri', url: 'https://avh.ala.org.au/occurrences/b1244238-eaaf-4dec-aa10-78c8513da13c' }
    ]
  },
  {
    id: 'pampa-joya',
    name: 'Pampa de La Joya',
    country: 'Perú',
    lat: -16.700,
    lon: -72.017,
    terrain: 'Dunas en media luna y planicies áridas',
    tags: ['dunes', 'barchan', 'arid'],
    uses: {},
    summary: 'Se han medido barjanes en campo. Es un candidato para contrastar la forma en media luna y las proporciones de sus brazos con dunas marcianas.',
    sources: [
      { label: 'The Journal of Geology · Barjanes del sur de Perú', url: 'https://doi.org/10.1086/626622' },
      { label: 'MINCETUR · Pampas de La Joya', url: 'https://consultasenlinea.mincetur.gob.pe/fichaInventario/index.aspx?cod_Ficha=12309' }
    ]
  },
  {
    id: 'lut-kaluts',
    name: 'Kaluts occidentales · Desierto del Lut',
    country: 'Irán',
    lat: 30.514,
    lon: 57.821,
    terrain: 'Crestas de erosión eólica y corredores pedregosos',
    tags: ['rock', 'rugged', 'arid', 'hyperarid'],
    uses: {},
    summary: 'Sus crestas alargadas, llamadas kaluts, fueron esculpidas por el viento. Los corredores entre crestas permiten plantear una comparación de relieve y recorridos.',
    sources: [
      { label: 'UNESCO · Geomorfología y mapas del Lut', url: 'https://whc.unesco.org/en/list/1505/' },
      { label: 'NASA Earth Observatory · Desierto del Lut', url: 'https://science.nasa.gov/earth/earth-observatory/irans-lut-desert-153634/' }
    ]
  },
  {
    id: 'dhofar',
    name: 'Dhofar · Base Kepler',
    country: 'Omán',
    lat: 18.423,
    lon: 55.043,
    terrain: 'Desierto de superficies arenosas, rocas y cauces secos',
    tags: ['rock', 'rugged', 'arid', 'rover'],
    uses: {},
    summary: 'El Foro Espacial Austríaco realizó aquí la simulación marciana AMADEE-18, con pruebas de cartografía, navegación y robótica en superficies mixtas.',
    sources: [
      { label: 'Foro Espacial Austríaco · AMADEE-18', url: 'https://oewf.org/en/portfolio/amadee-18/' },
      { label: 'Astrobiology · Expedición en Dhofar', url: 'https://doi.org/10.1089/ast.2019.2031' }
    ]
  },
  {
    id: 'atacama',
    name: 'Atacama · Sitio de ensayo ARADS',
    country: 'Chile',
    lat: -24.102,
    lon: -70.138,
    terrain: 'Suelo hiperárido y terreno desértico irregular',
    tags: ['arid', 'hyperarid', 'drilling', 'rugged', 'rover'],
    uses: { 'mars-drilling': 'El equipo ARADS ensayó la perforación robótica, el manejo de muestras y la detección de señales de vida en un ejercicio de misión.' },
    summary: 'ARADS estudia perforación robótica, manejo de muestras y búsqueda de señales de vida en el núcleo hiperárido del Atacama. El artículo enlazado describe el ensayo; el marcador es orientativo.',
    sources: [
      { label: 'NASA Ames · Programa ARADS', url: 'https://www.nasa.gov/universe/atacama-rover-astrobiology-drilling-studies-arads/' },
      { label: 'Astrobiology · Ensayo y localización', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10750310/' }
    ]
  },
  {
    id: 'black-point',
    name: 'Colada Black Point · Arizona',
    country: 'Estados Unidos',
    lat: 35.664,
    lon: -111.452,
    terrain: 'Colada basáltica y terreno rocoso',
    tags: ['volcanic', 'rock', 'rugged', 'arid', 'rover'],
    uses: { 'moon-traverse': 'Desert RATS utilizó el entorno de Black Point en simulaciones de operaciones con vehículos de exploración lunar.' },
    summary: 'El macizo volcánico del norte de Arizona sirve como referencia para recorridos sobre roca y ejercicios de operación en superficie.',
    sources: [
      { label: 'Lunar and Planetary Institute · Análogo lunar Black Point', url: 'https://www.lpi.usra.edu/lunar/analogs/blackpoint/' },
      { label: 'NASA · Geología y mapa del área de prueba', url: 'https://ntrs.nasa.gov/citations/20100024529' }
    ]
  },
  {
    id: 'plaster-city',
    name: 'Plaster City · Desierto de Colorado',
    locationNote: 'Marcador orientativo de la zona de Plaster City, no posición publicada del ensayo ERNEST.',
    country: 'Estados Unidos',
    lat: 32.793,
    lon: -115.858,
    terrain: 'Desierto accidentado con sombras largas al amanecer',
    tags: ['rock', 'rugged', 'shadow', 'arid', 'rover'],
    uses: { 'moon-traverse': 'NASA JPL ensayó el rover ERNEST cerca de Plaster City con pendientes y cambios de iluminación relevantes para recorridos lunares.' },
    summary: 'Los recorridos de prueba se hicieron también al amanecer y al anochecer para observar cómo cambia la navegación con sombras alargadas.',
    sources: [
      { label: 'NASA JPL · Campaña ERNEST', url: 'https://www.jpl.nasa.gov/news/nasa-testing-advanced-capabilities-for-moon-mars-rovers/' },
      { label: 'NASA JPL · Ubicación cerca de Plaster City', url: 'https://www.jpl.nasa.gov/images/pia26701-desert-field-test-with-nasa-advanced-rover-prototype/' }
    ]
  },
  {
    id: 'lanzarote',
    name: 'Caldera Blanca · Lanzarote',
    country: 'España',
    lat: 29.034,
    lon: -13.732,
    terrain: 'Caldera, laderas volcánicas y terreno basáltico cercano',
    tags: ['volcanic', 'rock', 'rugged', 'arid'],
    uses: { 'moon-traverse': 'La ESA llevó a participantes de PANGAEA a Caldera Blanca para practicar recorridos de geología de campo para misiones lunares y marcianas.' },
    summary: 'La topografía volcánica de Lanzarote permite practicar interpretación del terreno, selección de muestras y coordinación con equipos científicos.',
    sources: [
      { label: 'ESA · Recorrido de Caldera Blanca', url: 'https://www.esa.int/ESA_Multimedia/Images/2026/09/Astronauts_explore_ancient_volcano_in_Lanzarote' },
      { label: 'ESA · Caldera Blanca, fuente alternativa oficial', url: 'https://www.flickr.com/photos/europeanspaceagency/55556734513/' },
      { label: 'ESA · Objetivos del programa PANGAEA', url: 'https://www.esa.int/Newsroom/Press_Releases/Invitacion_a_medios_Entrenamiento_de_astronautas_PANGAEA_en_Lanzarote' }
    ]
  },
  {
    id: 'haughton',
    name: 'Drill Hill · Cráter Haughton',
    locationNote: 'Coordenadas redondeadas de Drill Hill, publicadas por Glass et al. (LPI, 2024). Los antecedentes lunares corresponden al cráter en general.',
    country: 'Canadá',
    lat: 75.421,
    lon: -89.760,
    terrain: 'Zona de impacto en un desierto polar rocoso',
    tags: ['rock', 'rugged', 'cold', 'arid', 'drilling', 'rover'],
    uses: {
      'moon-traverse': 'El proyecto Haughton documenta operaciones análogas lunares a escala del cráter. No se ha verificado que esos recorridos correspondan al marcador de Drill Hill.',
      'mars-drilling': 'El cráter se ha utilizado para probar taladros planetarios. Drill Hill es un depósito estudiado por sus capas de roca impactada y hielo.'
    },
    summary: 'Este sector de la isla Devon reúne antecedentes de perforación y pruebas de campo en un ambiente frío, rocoso y seco.',
    sources: [
      { label: 'NASA · Ensayos de perforación MEAD', url: 'https://ntrs.nasa.gov/citations/20260001856' },
      { label: 'NASA Ames y LPI · Geología de Drill Hill', url: 'https://www.hou.usra.edu/meetings/terrestrialanalogs2024/pdf/8012.pdf' },
      { label: 'NASA · Recorridos y operaciones lunares', url: 'https://www.nasa.gov/wp-content/uploads/2016/04/nasa_facts_analogs_2008.pdf' }
    ]
  },
  {
    id: 'wright-valley',
    name: 'Wright Valley · Valles secos de McMurdo',
    locationNote: 'Coordenadas redondeadas del registro geográfico AADC; su precisión figura como desconocida. No delimitan una ventana de análisis.',
    country: 'Antártida',
    lat: -77.517,
    lon: 161.833,
    terrain: 'Valle polar frío y seco con canales de erosión',
    tags: ['rock', 'rugged', 'cold', 'arid'],
    uses: {},
    summary: 'NASA describe canales en las laderas de Wright Valley comparables con rasgos de Marte. El valle ofrece un candidato para comparar desiertos fríos y relieve de origen glaciar.',
    sources: [
      { label: 'NASA Earth Observatory · Valles secos y Marte', url: 'https://science.nasa.gov/earth/earth-observatory/martian-landscape-antarctica-4420/' },
      { label: 'Australian Antarctic Data Centre · Ubicación de Wright Valley', url: 'https://data.aad.gov.au/aadc/gaz/display_name.cfm?gaz_id=133876' }
    ]
  }
];

if (typeof module !== "undefined" && module.exports) module.exports = globalThis.ANALOG_SITES;
