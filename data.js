// Coordinates locate an approximate sector for browsing, rather than a surveyed boundary.
// Profile uses are reserved for documented trials or direct scientific comparisons.
globalThis.ANALOG_SITES = [
  {
    id: 'merzouga',
    name: 'Merzouga · Erg Chebbi',
    country: 'Morocco',
    lat: 31.073,
    lon: -3.970,
    terrain: 'Saharan dunes and sandy surfaces',
    tags: ['dunes', 'arid', 'rover'],
    uses: { 'mars-dunes': 'LAAS recorded trajectories of two rovers at Merzouga during the Erfoud planetary robotics campaign.' },
    summary: 'The Merzouga site is part of the Erfoud dataset. Its field data include an elevation model and traverses with cameras and lidar.',
    sources: [
      { label: 'LAAS-CNRS · Erfoud field data', url: 'https://sites.laas.fr/projects/erfoud-dataset/sites.laas.fr/projects/erfoud-dataset/index.html' },
      { label: 'ESA · Rover tests in Morocco', url: 'https://www.esa.int/Enabling_Support/Space_Engineering_Technology/Self-driving_rovers_tested_in_Mars-like_Morocco' }
    ]
  },
  {
    id: 'dumont',
    name: 'Dumont Dunes · Mojave',
    country: 'United States',
    lat: 35.688,
    lon: -116.222,
    terrain: 'Dunes with slopes and undulating surfaces',
    tags: ['dunes', 'rugged', 'arid', 'rover'],
    uses: { 'mars-dunes': 'NASA tested Curiosity’s mobility system here and, later, autonomous navigation for Martian aircraft.' },
    summary: 'Mojave dune field for studying traverses over sand and visual perception in a landscape with few references.',
    sources: [
      { label: 'NASA · Tests at Dumont Dunes', url: 'https://www.nasa.gov/solar-system/planets/mars/nasa-tests-drones-in-death-valley-preps-for-martian-sands-and-skies/' },
      { label: 'BLM · Dune field map', url: 'https://www.blm.gov/sites/default/files/documents/files/Dumont_Final_Mobile_508.pdf' }
    ]
  },
  {
    id: 'maspalomas',
    name: 'Maspalomas Dunes',
    country: 'Spain',
    lat: 27.740,
    lon: -15.574,
    terrain: 'Coastal field of mobile dunes',
    tags: ['dunes', 'arid'],
    uses: { 'mars-dunes': 'A study compared laser-measured sand avalanches at Maspalomas with Curiosity observations at the Namib dune on Mars.' },
    summary: 'The Gran Canaria dunes provide a direct comparison with the shape and dynamics of Gale’s sandy slopes.',
    sources: [
      { label: 'Icarus · Earth–Mars comparison', url: 'https://www.sciencedirect.com/science/article/pii/S0019103517307534' },
      { label: 'Earth’s Future · Maspalomas location and dynamics', url: 'https://agupubs.onlinelibrary.wiley.com/doi/full/10.1002/2016EF000524' }
    ]
  },
  {
    id: 'namib',
    name: 'Namib · Dunes south of Gobabeb',
    country: 'Namibia',
    lat: -23.620,
    lon: 15.070,
    terrain: 'Linear dunes of the Namib Sand Sea',
    tags: ['dunes', 'arid'],
    uses: {},
    summary: 'The linear dunes near Gobabeb are candidates for comparing sand fields. Their size and shape may differ from the Gale dunes.',
    sources: [
      { label: 'UNESCO · Namib Sand Sea', url: 'https://whc.unesco.org/en/list/1430/' },
      { label: 'Geological Survey of Namibia · Gobabeb geology', url: 'https://the-eis.com/elibrary/sites/default/files/downloads/literature/The%20Surface%20Geology%20and%20Geomorphology%20Around%20Gobabeb.pdf' }
    ]
  },
  {
    id: 'simpson',
    name: 'Munga-Thirri · Simpson Desert',
    country: 'Australia',
    lat: -25.773,
    lon: 138.121,
    terrain: 'Linear dunes with interspersed salt pans',
    tags: ['dunes', 'arid'],
    uses: {},
    summary: 'The parallel ridges of the Australian desert allow a landscape-scale comparison of dune spacing and orientation.',
    sources: [
      { label: 'NASA Earth Observatory · Simpson Desert', url: 'https://science.nasa.gov/earth/earth-observatory/munga-thirrisimpson-desert-park-150201/' },
      { label: 'Atlas of Living Australia · Munga-Thirri sector', url: 'https://avh.ala.org.au/occurrences/b1244238-eaaf-4dec-aa10-78c8513da13c' }
    ]
  },
  {
    id: 'pampa-joya',
    name: 'Pampa de La Joya',
    country: 'Peru',
    lat: -16.700,
    lon: -72.017,
    terrain: 'Crescent dunes and arid plains',
    tags: ['dunes', 'barchan', 'arid'],
    uses: {},
    summary: 'Barchans have been measured in the field. It is a candidate for contrasting the crescent shape and arm proportions with Martian dunes.',
    sources: [
      { label: 'The Journal of Geology · Barchans of southern Peru', url: 'https://doi.org/10.1086/626622' },
      { label: 'MINCETUR · Pampas de La Joya', url: 'https://consultasenlinea.mincetur.gob.pe/fichaInventario/index.aspx?cod_Ficha=12309' }
    ]
  },
  {
    id: 'lut-kaluts',
    name: 'Western Kaluts · Lut Desert',
    country: 'Iran',
    lat: 30.514,
    lon: 57.821,
    terrain: 'Wind-eroded ridges and stony corridors',
    tags: ['rock', 'rugged', 'arid', 'hyperarid'],
    uses: {},
    summary: 'Its elongated ridges, called kaluts, were sculpted by the wind. The corridors between ridges allow a comparison of relief and traverses.',
    sources: [
      { label: 'UNESCO · Lut geomorphology and maps', url: 'https://whc.unesco.org/en/list/1505/' },
      { label: 'NASA Earth Observatory · Lut Desert', url: 'https://science.nasa.gov/earth/earth-observatory/irans-lut-desert-153634/' }
    ]
  },
  {
    id: 'dhofar',
    name: 'Dhofar · Base Kepler',
    country: 'Oman',
    lat: 18.423,
    lon: 55.043,
    terrain: 'Desert of sandy surfaces, rocks and dry channels',
    tags: ['rock', 'rugged', 'arid', 'rover'],
    uses: {},
    summary: 'The Austrian Space Forum ran the AMADEE-18 Mars simulation here, with mapping, navigation and robotics tests on mixed surfaces.',
    sources: [
      { label: 'Austrian Space Forum · AMADEE-18', url: 'https://oewf.org/en/portfolio/amadee-18/' },
      { label: 'Astrobiology · Dhofar expedition', url: 'https://doi.org/10.1089/ast.2019.2031' }
    ]
  },
  {
    id: 'atacama',
    name: 'Atacama · ARADS test site',
    country: 'Chile',
    lat: -24.102,
    lon: -70.138,
    terrain: 'Hyperarid soil and irregular desert terrain',
    tags: ['arid', 'hyperarid', 'drilling', 'rugged', 'rover'],
    uses: { 'mars-drilling': 'The ARADS team tested robotic drilling, sample handling and life-signature detection in a mission exercise.' },
    summary: 'ARADS studies robotic drilling, sample handling and the search for life signatures in the hyperarid core of the Atacama. The linked article describes the test; the marker is approximate.',
    sources: [
      { label: 'NASA Ames · Programa ARADS', url: 'https://www.nasa.gov/universe/atacama-rover-astrobiology-drilling-studies-arads/' },
      { label: 'Astrobiology · Test and location', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10750310/' }
    ]
  },
  {
    id: 'black-point',
    name: 'Colada Black Point · Arizona',
    country: 'United States',
    lat: 35.664,
    lon: -111.452,
    terrain: 'Basaltic lava flow and rocky terrain',
    tags: ['volcanic', 'rock', 'rugged', 'arid', 'rover'],
    uses: { 'moon-traverse': 'Desert RATS used the Black Point area in operations simulations with lunar exploration vehicles.' },
    summary: 'The northern Arizona volcanic massif serves as a reference for rock traverses and surface operations exercises.',
    sources: [
      { label: 'Lunar and Planetary Institute · Black Point lunar analog', url: 'https://www.lpi.usra.edu/lunar/analogs/blackpoint/' },
      { label: 'NASA · Test area geology and map', url: 'https://ntrs.nasa.gov/citations/20100024529' }
    ]
  },
  {
    id: 'plaster-city',
    name: 'Plaster City · Colorado Desert',
    locationNote: 'Approximate marker for the Plaster City area, not the published position of the ERNEST test.',
    country: 'United States',
    lat: 32.793,
    lon: -115.858,
    terrain: 'Rugged desert with long shadows at dawn',
    tags: ['rock', 'rugged', 'shadow', 'arid', 'rover'],
    uses: { 'moon-traverse': 'NASA JPL tested the ERNEST rover near Plaster City with slopes and lighting changes relevant to lunar traverses.' },
    summary: 'Test traverses were also run at dawn and dusk to observe how navigation changes with elongated shadows.',
    sources: [
      { label: 'NASA JPL · ERNEST campaign', url: 'https://www.jpl.nasa.gov/news/nasa-testing-advanced-capabilities-for-moon-mars-rovers/' },
      { label: 'NASA JPL · Location near Plaster City', url: 'https://www.jpl.nasa.gov/images/pia26701-desert-field-test-with-nasa-advanced-rover-prototype/' }
    ]
  },
  {
    id: 'lanzarote',
    name: 'Caldera Blanca · Lanzarote',
    country: 'Spain',
    lat: 29.034,
    lon: -13.732,
    terrain: 'Caldera, volcanic slopes and nearby basaltic terrain',
    tags: ['volcanic', 'rock', 'rugged', 'arid'],
    uses: { 'moon-traverse': 'ESA took PANGAEA participants to Caldera Blanca to practice field-geology traverses for lunar and Martian missions.' },
    summary: 'Lanzarote’s volcanic topography allows practicing terrain interpretation, sample selection and coordination with science teams.',
    sources: [
      { label: 'ESA · Caldera Blanca traverse', url: 'https://www.esa.int/ESA_Multimedia/Images/2026/09/Astronauts_explore_ancient_volcano_in_Lanzarote' },
      { label: 'ESA · Caldera Blanca, official alternative source', url: 'https://www.flickr.com/photos/europeanspaceagency/55556734513/' },
      { label: 'ESA · PANGAEA program goals', url: 'https://www.esa.int/Newsroom/Press_Releases/Invitacion_a_medios_Entrenamiento_de_astronautas_PANGAEA_en_Lanzarote' }
    ]
  },
  {
    id: 'haughton',
    name: 'Drill Hill · Haughton Crater',
    locationNote: 'Rounded Drill Hill coordinates, published by Glass et al. (LPI, 2024). The lunar precedents refer to the crater in general.',
    country: 'Canada',
    lat: 75.421,
    lon: -89.760,
    terrain: 'Impact zone in a rocky polar desert',
    tags: ['rock', 'rugged', 'cold', 'arid', 'drilling', 'rover'],
    uses: {
      'moon-traverse': 'The Haughton project documents lunar analog operations at crater scale. It has not been verified that those traverses correspond to the Drill Hill marker.',
      'mars-drilling': 'The crater has been used to test planetary drills. Drill Hill is a deposit studied for its layers of impacted rock and ice.'
    },
    summary: 'This sector of Devon Island brings together drilling precedents and field tests in a cold, rocky and dry environment.',
    sources: [
      { label: 'NASA · MEAD drilling tests', url: 'https://ntrs.nasa.gov/citations/20260001856' },
      { label: 'NASA Ames and LPI · Drill Hill geology', url: 'https://www.hou.usra.edu/meetings/terrestrialanalogs2024/pdf/8012.pdf' },
      { label: 'NASA · Lunar traverses and operations', url: 'https://www.nasa.gov/wp-content/uploads/2016/04/nasa_facts_analogs_2008.pdf' }
    ]
  },
  {
    id: 'wright-valley',
    name: 'Wright Valley · McMurdo Dry Valleys',
    locationNote: 'Rounded coordinates from the AADC gazetteer; their precision is listed as unknown. They do not delimit an analysis window.',
    country: 'Antarctica',
    lat: -77.517,
    lon: 161.833,
    terrain: 'Cold, dry polar valley with erosion channels',
    tags: ['rock', 'rugged', 'cold', 'arid'],
    uses: {},
    summary: 'NASA describes channels on the Wright Valley slopes comparable to features on Mars. The valley offers a candidate for comparing cold deserts and glacial relief.',
    sources: [
      { label: 'NASA Earth Observatory · Dry valleys and Mars', url: 'https://science.nasa.gov/earth/earth-observatory/martian-landscape-antarctica-4420/' },
      { label: 'Australian Antarctic Data Centre · Wright Valley location', url: 'https://data.aad.gov.au/aadc/gaz/display_name.cfm?gaz_id=133876' }
    ]
  }
];

if (typeof module !== "undefined" && module.exports) module.exports = globalThis.ANALOG_SITES;
