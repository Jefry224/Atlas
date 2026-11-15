'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const sites = require('../data.js');
const { profiles, createRanking, readCriteria, terrainType } = require('../app.js');

test('catalog: 14 unique sites, bounded approximate coordinates, HTTPS sources', () => {
  assert.equal(sites.length, 14);
  assert.equal(new Set(sites.map(s => s.id)).size, 14);
  const validTags = new Set([...profiles.flatMap(p => p.criteria.map(c => c[0])), 'cold']);
  for (const s of sites) {
    assert.ok(s.name && s.country && s.terrain && s.summary);
    assert.ok(Number.isFinite(s.lat) && Math.abs(s.lat) <= 90);
    assert.ok(Number.isFinite(s.lon) && Math.abs(s.lon) <= 180);
    assert.equal(new Set(s.tags).size, s.tags.length);
    for (const tag of s.tags) assert.ok(validTags.has(tag), `${s.id}: ${tag}`);
    assert.ok(s.sources.length >= 2);
    for (const source of s.sources) assert.equal(new URL(source.url).protocol, 'https:');
    for (const key of Object.keys(s.uses)) assert.ok(profiles.some(p => p.id === key));
  }
});

test('profiles: three explicit criteria sets, nonnegative weights totaling 100', () => {
  assert.equal(profiles.length, 3);
  for (const p of profiles) {
    assert.equal(p.criteria.reduce((n, c) => n + c[2], 0), 100);
    assert.equal(new Set(p.criteria.map(c => c[0])).size, p.criteria.length);
    for (const c of p.criteria) assert.ok(Number.isFinite(c[2]) && c[2] > 0);
  }
});

test('scoring: contributions reconcile, no missing-data bonus, stable sorting', () => {
  for (const p of profiles) {
    const rank = createRanking(p, sites);
    assert.equal(rank.length, 14);
    assert.deepEqual(createRanking(p, [...sites].reverse()).map(r => r.site.id), rank.map(r => r.site.id));
    for (let i = 0; i < rank.length; i++) {
      const r = rank[i];
      assert.equal(r.score, r.criteria.reduce((n, c) => n + (c.matched ? c.weight : 0), 0));
      assert.ok(r.score >= 0 && r.score <= 100);
      if (i) assert.ok(rank[i - 1].score >= r.score);
    }
    assert.equal(createRanking(p, [{...sites[0], tags: []}])[0].score, 0);
  }
});

test('known checks: dune, lunar and ARADS examples are distinct', () => {
  const score = (p, id) => createRanking(profiles[p], sites).find(r => r.site.id === id);
  assert.equal(score(0, 'merzouga').score, 80);
  assert.equal(score(0, 'dumont').score, 80);
  assert.ok(score(0, 'merzouga').evidence.includes('LAAS'));
  assert.equal(score(1, 'black-point').score, 85);
  assert.ok(score(1, 'black-point').evidence.includes('Desert RATS'));
  assert.equal(score(2, 'atacama').score, 100);
  assert.ok(score(2, 'atacama').evidence.includes('ARADS'));
  assert.equal(score(2, 'pampa-joya').score, 15, 'Unverified point-specific hyperaridity must not award 55 points');
  assert.equal(readCriteria(sites.find(s => s.id === 'namib'), profiles[0]).find(c => c.label.includes('movilidad')).matched, false);
});

test('ties: documented profile use first, then Spanish name order', () => {
  const base = {...sites[0], tags: []};
  const input = [{...base, id:'b', name:'Beta', uses:{}}, {...base, id:'z', name:'Zeta'}, {...base, id:'a', name:'Alfa', uses:{}}];
  assert.deepEqual(createRanking(profiles[0], input).map(r => r.site.id), ['z','a','b']);
});

// Deliberately small DOM harness: tests app wiring, not browser layout or accessibility conformance.
class Element {
  constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; this.dataset = {}; this.style = {}; this.handlers = {}; this._text = ''; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this._text = ''; this.children = children; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key]; }
  addEventListener(type, callback) { this.handlers[type] = callback; }
  click() { this.handlers.click?.(); }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.tagName === selector ? [child] : []), ...child.querySelectorAll(selector)]); }
}
function launch() {
  const ids = Object.fromEntries(['profile-controls','site-list','site-detail','fallback-markers','site-count','reference-link','profile-summary','selection-status','map-selected-name','map-selected-country'].map(id => [id,new Element('div')]));
  const context = { window: { ANALOG_SITES: sites }, document: { getElementById:id => ids[id], createElement:tag => new Element(tag) }, Intl };
  vm.runInNewContext(fs.readFileSync(path.join(root,'app.js'),'utf8'), context, {filename:'app.js'});
  return ids;
}

test('UI wiring: 3 profiles, 14 list buttons and 14 map markers per profile', () => {
  const dom = launch();
  assert.equal(dom['profile-controls'].children.length, 3);
  for (let p = 0; p < 3; p++) {
    dom['profile-controls'].children[p].click();
    assert.equal(dom['site-list'].children.length, 14);
    assert.equal(dom['fallback-markers'].children.length, 14);
    assert.equal(dom['profile-controls'].children.filter(b => b.getAttribute('aria-pressed') === 'true').length, 1);
    assert.equal(dom['site-count'].textContent, '14 sitios');
  }
});

test('UI wiring: every map/list selection keeps detail, rank and marker synchronized', () => {
  const dom = launch();
  for (const profileButton of dom['profile-controls'].children) {
    profileButton.click();
    for (const item of dom['site-list'].children) {
      const row = item.children[0];
      const site = sites.find(s => s.id === row.dataset.site);
      row.click();
      assert.equal(dom['site-detail'].children[0].textContent, site.name);
      assert.equal(row.getAttribute('aria-pressed'), 'true');
      assert.equal(row.getAttribute('aria-controls'), 'site-detail');
      const markers = dom['fallback-markers'].children;
      assert.equal(markers.filter(b => b.getAttribute('aria-pressed') === 'true').length, 1);
      assert.equal(markers.find(b => b.getAttribute('aria-pressed') === 'true').dataset.site, site.id);
      assert.ok(dom['selection-status'].textContent.includes(site.name));
      assert.ok(dom['site-detail'].textContent.includes('no es un porcentaje de similitud'));
    }
    for (const marker of dom['fallback-markers'].children) {
      marker.click();
      assert.equal(dom['site-detail'].children[0].textContent, sites.find(s => s.id === marker.dataset.site).name);
      const rows = dom['site-list'].children.map(li => li.children[0]);
      assert.equal(rows.filter(b => b.getAttribute('aria-pressed') === 'true').length, 1);
      assert.equal(rows.find(b => b.getAttribute('aria-pressed') === 'true').dataset.site, marker.dataset.site);
      assert.ok(marker.getAttribute('aria-label'));
    }
  }
});

test('UI wiring: repeated profile/selection clicks never duplicate controls', () => {
  const dom = launch();
  for (let i = 0; i < 18; i++) {
    const button = dom['profile-controls'].children[i % 3];
    button.click(); button.click();
    dom['site-list'].children[13].children[0].click();
    dom['site-list'].children[13].children[0].click();
    assert.equal(dom['site-list'].children.length, 14);
    assert.equal(dom['fallback-markers'].children.length, 14);
    assert.equal(dom['site-list'].children.filter(li => li.children[0].getAttribute('aria-pressed') === 'true').length, 1);
  }
});

test('static document: local assets, methodology, no-JS fallback and reduced-motion rule', () => {
  const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
  const css = fs.readFileSync(path.join(root,'styles.css'),'utf8');
  for (const name of ['styles.css','data.js','app.js']) assert.ok(html.includes(`"${name}"`) && fs.existsSync(path.join(root,name)));
  for (const target of [...html.matchAll(/href="#([^"]+)"/g)].map(m => m[1])) assert.ok(html.includes(`id="${target}"`), target);
  assert.ok(html.includes('does not reproduce gravity, regolith, illumination or chemistry'));
  assert.ok(html.includes('<details'));
  assert.ok(html.includes('<noscript>'));
  assert.ok(css.includes(':focus-visible'));
  assert.ok(css.includes('prefers-reduced-motion: reduce'));
});


test('visual layer: conceptual terrain assets exist and categories follow documented tags', () => {
  for (const site of sites) {
    const terrain = terrainType(site);
    assert.ok(fs.existsSync(path.join(root, `assets/terrain-${terrain.key}.svg`)));
    assert.ok(terrain.name);
  }
  const dom = launch();
  assert.ok(dom['site-detail'].textContent.includes('Ilustración conceptual'));
  assert.equal(dom['site-detail'].children.filter(c => c.tagName === 'details').length, 2);
  assert.ok(dom['map-selected-name'].textContent);
});
