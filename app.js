(() => {
  const profiles = [
    {
      id: "mars-dunes",
      name: "Marte · Dunas",
      reference: "Datos sin procesar · HiRISE, Nili Patera",
      url: "https://www.uahirise.org/dtm/dtm.php?ID=ESP_017762_1890",
      summary: "Buscá terrenos para ensayar navegación sobre arena y entre dunas.",
      criteria: [
        ["dunes", "Campo de dunas", 50],
        ["arid", "Entorno seco", 20],
        ["barchan", "Dunas en media luna", 20],
        ["rover", "Antecedente de pruebas de movilidad", 10],
      ],
    },
    {
      id: "moon-traverse",
      name: "Luna · Terreno rocoso",
      reference: "Datos sin procesar · LOLA, Malapert",
      url: "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/",
      summary: "Buscá terrenos para ensayar recorridos sobre superficies rocosas e irregulares.",
      criteria: [
        ["rock", "Superficie rocosa", 35],
        ["rugged", "Relieve irregular", 30],
        ["volcanic", "Terreno volcánico", 15],
        ["shadow", "Ensayo con sombras largas", 15],
        ["arid", "Entorno seco", 5],
      ],
    },
    {
      id: "mars-drilling",
      name: "Marte · Muestreo",
      reference: "Caso de ensayo terrestre · NASA ARADS",
      url: "https://www.nasa.gov/missions/analog-field-testing/nasa-is-testing-a-drill-to-search-for-life-on-mars-on-its-own/",
      summary: "Buscá ambientes secos para practicar perforación y muestreo.",
      criteria: [
        ["hyperarid", "Hiperaridez documentada", 55],
        ["arid", "Entorno seco", 15],
        ["drilling", "Antecedentes de perforación", 30],
      ],
    },
  ];

  // The same pure scoring functions power the UI and the dependency-free tests.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { profiles, readCriteria, createRanking };
    return;
  }

  const byId = (id) => document.getElementById(id);
  const controls = byId("profile-controls");
  const list = byId("site-list");
  const detail = byId("site-detail");
  const markerLayer = byId("fallback-markers");
  const sites = window.ANALOG_SITES;
  const siteCount = byId("site-count");
  const referenceLink = byId("reference-link");
  const number = new Intl.NumberFormat("es-SV", { maximumFractionDigits: 2 });

  let selectedProfile = profiles[0];
  let selectedSite;
  let ranking;
  const buttons = new Map();

  function element(tag, className = "", content = "") {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = content;
    return node;
  }

  function readCriteria(site, profile) {
    return profile.criteria.map(([tag, label, weight]) => ({
      label,
      weight,
      matched: site.tags.includes(tag),
    }));
  }

  function createRanking(profile, catalog = sites) {
    return catalog.map((site) => {
      const criteria = readCriteria(site, profile);
      const score = criteria.reduce((total, item) => total + (item.matched ? item.weight : 0), 0);
      return { site, score, criteria, evidence: site.uses[profile.id] };
    }).sort((a, b) => b.score - a.score
      || Number(Boolean(b.evidence)) - Number(Boolean(a.evidence))
      || a.site.name.localeCompare(b.site.name, "es"));
  }

  function renderDetail(entry) {
    const { site, score, criteria, evidence } = entry;
    const heading = element("h3", "", site.name);
    const coords = `${number.format(site.lat)}°, ${number.format(site.lon)}°`;
    const meta = element("p", "detail-meta", `${site.country} · ${site.terrain} · ${coords}`);
    const total = element("p", "detail-score", `${score}/100 puntos documentales · no es un porcentaje de similitud`);
    const description = element("p", "", site.summary);
    const locationNote = element("p", "location-note", site.locationNote || "Coordenadas aproximadas para explorar la región. No identifican una ruta de ensayo ni un sector medido y validado.");
    const evidenceType = element("p", "evidence-status", evidence ? "Antecedente documentado para este perfil" : "Candidato para evaluación");
    const use = element("p", "detail-use", evidence || "Propuesto por las características de la ficha. No se ha documentado aquí un ensayo o comparación de este perfil.");
    const metrics = element("ul", "metrics");
    for (const item of criteria) {
      const metric = element("li", "metric");
      metric.append(
        element("span", "", item.label),
        element("strong", item.matched ? "match" : "missing", item.matched ? `+${item.weight} pts` : "Sin dato en esta ficha"),
      );
      metrics.append(metric);
    }
    const sources = element("div", "detail-sources");
    sources.append(element("h3", "", "Fuentes del sitio"));
    for (const source of site.sources) {
      const link = element("a", "", source.label);
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      sources.append(link);
    }
    detail.replaceChildren(heading, meta, locationNote, total, description, evidenceType, use, metrics, sources);
  }

  function selectSite(entry) {
    selectedSite = entry.site.id;
    for (const [id, pair] of buttons) {
      for (const button of pair) button.setAttribute("aria-pressed", String(id === selectedSite));
    }
    byId("selection-status").textContent = `Seleccionado: ${entry.site.name}. ${entry.score} puntos documentales.`;
    renderDetail(entry);
  }

  function renderProfile(profile) {
    selectedProfile = profile;
    ranking = createRanking(profile);
    for (const button of controls.querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.dataset.profile === profile.id));
    }
    byId("profile-summary").textContent = profile.summary;
    referenceLink.textContent = profile.reference;
    referenceLink.href = profile.url;
    siteCount.textContent = `${sites.length} sitios`;
    buttons.clear();
    list.replaceChildren();
    markerLayer.replaceChildren();
    for (const [index, entry] of ranking.entries()) {
      const { site, score, evidence } = entry;
      const rank = index + 1;
      const row = element("button", "site-button");
      row.type = "button";
      row.dataset.site = site.id;
      row.setAttribute("aria-controls", "site-detail");
      const title = element("span", "site-name");
      title.append(
        element("strong", "", site.name),
        element("small", "", `${site.country} · ${evidence ? "Antecedente documentado" : "Candidato"}`),
      );
      row.append(element("span", "rank", String(rank)), title, element("span", "site-score", String(score)));
      const item = element("li");
      item.append(row);
      list.append(item);

      const marker = element("button", "map-marker", String(rank));
      marker.type = "button";
      marker.dataset.site = site.id;
      marker.setAttribute("aria-controls", "site-detail");
      marker.style.left = `${(site.lon + 180) / 3.6}%`;
      marker.style.top = `${(90 - site.lat) / 1.8}%`;
      marker.title = site.name;
      marker.setAttribute("aria-label", `${rank}. ${site.name}`);
      markerLayer.append(marker);
      for (const button of [row, marker]) button.addEventListener("click", () => selectSite(entry));
      buttons.set(site.id, [row, marker]);
    }
    selectSite(ranking[0]);
  }

  for (const profile of profiles) {
    const button = element("button", "profile-button", profile.name);
    button.type = "button";
    button.dataset.profile = profile.id;
    button.addEventListener("click", () => {
      if (profile !== selectedProfile) renderProfile(profile);
    });
    controls.append(button);
  }
  renderProfile(selectedProfile);
})();
