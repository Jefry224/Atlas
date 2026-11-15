(() => {
  const profiles = [
    {
      id: "mars-dunes",
      name: "Mars · Dunes",
      reference: "Raw data · HiRISE, Nili Patera",
      url: "https://www.uahirise.org/dtm/dtm.php?ID=ESP_017762_1890",
      summary: "Find terrain to test navigation over sand and between dunes.",
      criteria: [
        ["dunes", "Dune field", 50],
        ["arid", "Dry environment", 20],
        ["barchan", "Crescent dunes", 20],
        ["rover", "Mobility test precedent", 10],
      ],
    },
    {
      id: "moon-traverse",
      name: "Moon · Rocky terrain",
      reference: "Raw data · LOLA, Malapert",
      url: "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/",
      summary: "Find terrain to test traverses over rocky, irregular surfaces.",
      criteria: [
        ["rock", "Rocky surface", 35],
        ["rugged", "Irregular relief", 30],
        ["volcanic", "Volcanic terrain", 15],
        ["shadow", "Test with long shadows", 15],
        ["arid", "Dry environment", 5],
      ],
    },
    {
      id: "mars-drilling",
      name: "Mars · Sampling",
      reference: "Earth test case · NASA ARADS",
      url: "https://www.nasa.gov/missions/analog-field-testing/nasa-is-testing-a-drill-to-search-for-life-on-mars-on-its-own/",
      summary: "Find dry environments to practice drilling and sampling.",
      criteria: [
        ["hyperarid", "Documented hyperaridity", 55],
        ["arid", "Dry environment", 15],
        ["drilling", "Drilling precedents", 30],
      ],
    },
  ];

  // The same pure scoring functions power the UI and the dependency-free tests.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { profiles, readCriteria, createRanking, terrainType };
    return;
  }

  const byId = (id) => document.getElementById(id);
  // Shared, deterministic catalog engine for the Mission Control dashboard.
  globalThis.ATLAS_ENGINE = { profiles, readCriteria, createRanking, terrainType };
  if (!byId("site-detail")) return;
  const controls = byId("profile-controls");
  const list = byId("site-list");
  const detail = byId("site-detail");
  const markerLayer = byId("fallback-markers");
  const sites = window.ANALOG_SITES;
  const siteCount = byId("site-count");
  const referenceLink = byId("reference-link");
  const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

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

  // Illustrations summarize a catalog category, never measured relief or a site photograph.
  function terrainType(site) {
    if (site.tags.includes("cold")) return { key: "polar", name: "Polar desert" };
    if (site.tags.includes("dunes")) return { key: "dunes", name: "Dune field" };
    if (site.tags.includes("rock")) return { key: "rock", name: "Rocky terrain" };
    return { key: "arid", name: "Arid plain" };
  }

  function disclosure(label, className, ...children) {
    const group = element("details", className);
    group.append(element("summary", "", label), ...children);
    return group;
  }

  function renderDetail(entry) {
    const { site, score, criteria, evidence } = entry;
    const terrain = terrainType(site);
    const heading = element("h3", "site-title", site.name);
    const meta = element("p", "detail-meta", `${site.country} · ${terrain.name}`);
    const visual = element("figure", "terrain-visual");
    const picture = element("img");
    picture.src = `assets/terrain-${terrain.key}.svg`;
    picture.alt = `Conceptual illustration of ${terrain.name.toLowerCase()}; it does not depict this real site.`;
    picture.width = 640;
    picture.height = 360;
    visual.append(picture, element("figcaption", "", "Conceptual illustration · not an image of the site"));
    const overview = element("div", "site-overview");
    overview.append(element("p", "terrain-description", site.terrain));
    overview.append(element("p", "evidence-status", evidence ? "✓ Documented precedent" : "○ Candidate for evaluation"));
    const scoreLine = element("div", "score-line");
    const total = element("p", "detail-score");
    total.append(element("strong", "", String(score)), element("span", "", " / 100 documentary points"));
    scoreLine.append(total, element("span", "criteria-count", `${criteria.filter(c => c.matched).length} of ${criteria.length} criteria recorded`));
    overview.append(scoreLine);
    const scoreTrack = element("div", "score-track");
    scoreTrack.setAttribute("aria-hidden", "true");
    for (const item of criteria) {
      const segment = element("span", item.matched ? "score-segment matched" : "score-segment unknown");
      segment.style.flexGrow = String(item.weight);
      segment.title = `${item.label}: ${item.matched ? item.weight + " points" : "no data"}`;
      scoreTrack.append(segment);
    }
    overview.append(scoreTrack, element("p", "score-caption", "Documentary coverage; not a similarity percentage."));
    const metrics = element("ul", "metrics");
    for (const item of criteria) {
      const metric = element("li", "metric");
      metric.append(element("span", "", item.label), element("strong", item.matched ? "match" : "missing", item.matched ? `+${item.weight} pts` : "No data in this record"));
      metrics.append(metric);
    }
    const description = element("p", "", site.summary);
    const use = element("p", "detail-use", evidence || "Proposed from the record’s features. No test or comparison for this profile has been documented here.");
    const coords = `${number.format(site.lat)}°, ${number.format(site.lon)}°`;
    const location = element("p", "location-note", `Approximate location: ${coords}. ${site.locationNote || "It does not identify a test route or a measured, validated sector."}`);
    const sources = element("div", "detail-sources");
    for (const source of site.sources) {
      const link = element("a", "", source.label + " ↗");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      sources.append(link);
    }
    detail.replaceChildren(heading, meta, visual, overview,
      disclosure("Why it appears in this profile", "detail-disclosure", description, use, metrics),
      disclosure(`See ${site.sources.length} sources and site limits`, "detail-disclosure", location, sources));
  }

  function selectSite(entry) {
    selectedSite = entry.site.id;
    for (const [id, pair] of buttons) {
      for (const button of pair) button.setAttribute("aria-pressed", String(id === selectedSite));
    }
    byId("selection-status").textContent = `Seleccionado: ${entry.site.name}.`;
    byId("map-selected-name").textContent = entry.site.name;
    byId("map-selected-country").textContent = entry.site.country;
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
      const scoreLabel = element("span", "site-score", String(score));
      scoreLabel.setAttribute("aria-label", `${score} documentary points`);
      const bar = element("span", "rank-bar");
      bar.setAttribute("aria-hidden", "true");
      const fill = element("span");
      fill.style.width = `${score}%`;
      bar.append(fill);
      row.append(element("span", "rank", String(rank)), title, scoreLabel, bar);
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
    const button = element("button", "profile-button");
    const profileLabels = {"mars-dunes": ["Mars", "Dunes", "≋"], "moon-traverse": ["Moon", "Rock", "△"], "mars-drilling": ["Mars", "Sampling", "⊙"]};
    const [body, label, symbol] = profileLabels[profile.id];
    const icon = element("span", "profile-icon", symbol);
    icon.setAttribute("aria-hidden", "true");
    const name = element("span", "profile-name");
    name.append(element("small", "", body), element("strong", "", label));
    button.append(icon, name);
    button.setAttribute("aria-label", profile.name);
    button.type = "button";
    button.dataset.profile = profile.id;
    button.addEventListener("click", () => {
      if (profile !== selectedProfile) renderProfile(profile);
    });
    controls.append(button);
  }
  renderProfile(selectedProfile);
})();
