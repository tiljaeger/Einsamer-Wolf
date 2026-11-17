import type { MapData, MapPoint } from './map-state';
import { parseMap } from './map-state';
import './map.css';

// Replace this asset with a licensed map while preserving the normalized coordinate space.
export const MAP_BACKGROUND = '/maps/reisekarte.svg';
export function mountMap(host: HTMLElement, read: () => MapData, change: (data: MapData) => void, status: (message: string) => void) {
  host.innerHTML = `<h2>Deine Spielkarte</h2><p>Freie Reiseskizze, keine offizielle Magnamund-Karte. ★ Standort · nummerierte Punkte: Reiseweg · ● Ort · ▲ Gefahr · ⌂ Lager. Kein Geräte-GPS.</p>
  <div class="map-tools"><label>Aktion <select class="map-mode"><option value="pan">Karte verschieben / Orte auswählen</option><option value="location">Standort setzen</option><option value="waypoint">Wegpunkt hinzufügen</option><option value="place">Ort hinzufügen</option></select></label><button type="button" data-map="in">Vergrößern +</button><button type="button" data-map="out">Verkleinern −</button><button type="button" data-map="home">Ganze Karte</button></div>
  <p>Karte ziehen zum Verschieben. Zum Setzen tippen oder klicken. Alternativ Koordinaten eingeben und „Ausführen“ wählen. In der Karte: Pfeiltasten verschieben, +/− zoomen.</p>
  <svg class="game-map" viewBox="0 0 1000 700" tabindex="0" role="group" aria-label="Interaktive Spielkarte"><image href="${MAP_BACKGROUND}" width="1000" height="700"/><g class="map-markers"></g></svg>
  <div class="map-tools"><label>X (0–1000) <input class="map-x" type="number" min="0" max="1000" value="500"></label><label>Y (0–700) <input class="map-y" type="number" min="0" max="700" value="350"></label><button type="button" data-map="apply">Ausführen</button></div>
  <p class="map-hint" role="status"></p><div class="map-entries"></div><small>Grundlage: eigene schematische Illustration, CC0. Vollständig offline verfügbar nach dem ersten vollständigen Laden der PWA.</small>`;
  const svg = host.querySelector<SVGSVGElement>('svg')!;
  const markers = host.querySelector<SVGGElement>('.map-markers')!;
  const entries = host.querySelector<HTMLElement>('.map-entries')!;
  const mode = host.querySelector<HTMLSelectElement>('.map-mode')!;
  const x = host.querySelector<HTMLInputElement>('.map-x')!;
  const y = host.querySelector<HTMLInputElement>('.map-y')!;
  const hint = host.querySelector<HTMLElement>('.map-hint')!;
  let moving: { kind: 'location' | 'waypoint' | 'place'; index: number } | null = null;
  let view = { x: 0, y: 0, width: 1000, height: 700 };
  function viewport() { view.x = Math.max(0, Math.min(1000 - view.width, view.x)); view.y = Math.max(0, Math.min(700 - view.height, view.y)); svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.width} ${view.height}`); }
  function zoom(factor: number) { const width = Math.max(125, Math.min(1000, view.width * factor)); view.x += (view.width - width) / 2; view.y += (view.height - width * .7) / 2; view.width = width; view.height = width * .7; viewport(); }
  function commit(data: MapData) { try { change(parseMap(data)); render(); } catch (e) { status(e instanceof Error ? e.message : 'Kartenänderung fehlgeschlagen.'); } }
  function perform(p: MapPoint) {
    const data = structuredClone(read());
    if (moving) {
      if (moving.kind === 'location') data.location = p;
      else if (moving.kind === 'waypoint' && data.waypoints[moving.index]) data.waypoints[moving.index] = p;
      else if (moving.kind === 'place' && data.places[moving.index]) Object.assign(data.places[moving.index], p);
      moving = null; hint.textContent = 'Position geändert.';
    } else if (mode.value === 'location') data.location = p;
    else if (mode.value === 'waypoint') data.waypoints.push(p);
    else if (mode.value === 'place') data.places.push({ ...p, name: 'Neuer Ort', note: '', category: 'Ort' });
    else return;
    commit(data);
  }
  function position(event: PointerEvent): MapPoint {
    const matrix = svg.getScreenCTM();
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix!.inverse());
    return { x: Math.round(Math.max(0, Math.min(1000, point.x))), y: Math.round(Math.max(0, Math.min(700, point.y))) };
  }
  let drag: { id: number; clientX: number; clientY: number; start: MapPoint; moved: boolean; pan: boolean } | null = null;
  svg.addEventListener('pointerdown', e => {
    if (drag || !e.isPrimary) return;
    drag = { id: e.pointerId, clientX: e.clientX, clientY: e.clientY, start: position(e), moved: false, pan: mode.value === 'pan' && !moving };
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - drag.clientX, e.clientY - drag.clientY) > 6) drag.moved = true;
    if (drag.moved && drag.pan) { const p = position(e); view.x += drag.start.x - p.x; view.y += drag.start.y - p.y; viewport(); }
  });
  svg.addEventListener('pointerup', e => {
    if (!drag || drag.id !== e.pointerId) return;
    const d = drag; drag = null;
    if (!d.moved) {
      const p = position(e); x.value = String(p.x); y.value = String(p.y);
      const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-place]');
      if (hit && mode.value === 'pan' && !moving) entries.querySelector<HTMLElement>(`[data-place-editor="${hit.getAttribute('data-place')}"]`)?.focus();
      else perform(p);
    }
  });
  svg.addEventListener('pointercancel', () => { drag = null; });
  svg.addEventListener('keydown', e => {
    if (e.key === '+' || e.key === '=') zoom(.8);
    else if (e.key === '-') zoom(1.25);
    else if (e.key.startsWith('Arrow')) { const delta = view.width / 10; if (e.key === 'ArrowLeft') view.x -= delta; if (e.key === 'ArrowRight') view.x += delta; if (e.key === 'ArrowUp') view.y -= delta; if (e.key === 'ArrowDown') view.y += delta; viewport(); }
    else return;
    e.preventDefault();
  });
  mode.addEventListener('change', () => { moving = null; hint.textContent = ''; });
  host.addEventListener('click', e => {
    const action = (e.target as HTMLElement).closest<HTMLElement>('[data-map]')?.dataset.map;
    if (action === 'in') zoom(.8); if (action === 'out') zoom(1.25);
    if (action === 'home') { view = { x: 0, y: 0, width: 1000, height: 700 }; viewport(); }
    if (action === 'apply') { if (!x.value || !y.value || !x.checkValidity() || !y.checkValidity()) { hint.textContent = 'Bitte gültige X- und Y-Koordinaten eingeben.'; return; } perform({ x: x.valueAsNumber, y: y.valueAsNumber }); }
  });
  function render() {
    moving = null;
    const data = read(); markers.replaceChildren(); entries.replaceChildren();
    function shape(tag: string, attrs: Record<string, string>, text = '') { const el = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k,v] of Object.entries(attrs)) el.setAttribute(k,v); el.textContent = text; markers.append(el); return el; }
    shape('polyline', { points: data.waypoints.map(p => `${p.x},${p.y}`).join(' '), fill: 'none', stroke: '#923b26', 'stroke-width': '4', 'vector-effect': 'non-scaling-stroke' });
    function row(kind: 'location' | 'waypoint' | 'place', index: number, p: MapPoint, label: string) {
      const row = document.createElement('div'); row.className = 'map-entry';
      const title = document.createElement('strong'); title.textContent = `${label} (${p.x}, ${p.y})`; row.append(title);
      const move = document.createElement('button'); move.type = 'button'; move.textContent = 'Verschieben'; move.addEventListener('click', () => { moving = { kind, index }; x.value = String(p.x); y.value = String(p.y); hint.textContent = `${label}: neue Position auf der Karte wählen oder Koordinaten ändern und Ausführen drücken.`; }); row.append(move);
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Löschen'; remove.addEventListener('click', () => { const d = structuredClone(read()); if (kind === 'location') d.location = null; else if (kind === 'waypoint') d.waypoints.splice(index, 1); else d.places.splice(index, 1); commit(d); }); row.append(remove); entries.append(row); return row;
    }
    if (data.location) { shape('text', { x: String(data.location.x), y: String(data.location.y), fill: '#173e70', 'font-size': '34', 'text-anchor': 'middle' }, '★'); row('location', 0, data.location, 'Aktueller Standort'); }
    data.waypoints.forEach((p,i) => { shape('circle', { cx: String(p.x), cy: String(p.y), r: '12', fill: '#923b26', stroke: 'white' }); shape('text', { x: String(p.x), y: String(p.y + 4), fill: 'white', 'font-size': '12', 'text-anchor': 'middle' }, String(i + 1)); row('waypoint', i, p, `Wegpunkt ${i + 1}`); });
    data.places.forEach((p,i) => {
      const marker = shape('text', { x: String(p.x), y: String(p.y), fill: p.category === 'Gefahr' ? '#923b26' : '#285333', 'font-size': '30', 'text-anchor': 'middle', 'data-place': String(i), style: 'cursor:pointer' }, p.category === 'Gefahr' ? '▲' : p.category === 'Lager' ? '⌂' : '●');
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title'); title.textContent = p.name; marker.append(title);
      const editor = row('place', i, p, p.name); editor.tabIndex = -1; editor.dataset.placeEditor = String(i);
      function field(label: string, control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) { const l = document.createElement('label'); l.textContent = label; l.append(control); editor.append(l); }
      const name = document.createElement('input'); name.value = p.name; name.maxLength = 120; name.required = true; field('Name', name);
      const note = document.createElement('textarea'); note.value = p.note; note.maxLength = 2000; field('Notiz (optional)', note);
      const category = document.createElement('select'); for (const text of ['Ort', 'Gefahr', 'Lager']) category.add(new Option(text, text)); category.value = p.category; field('Kategorie', category);
      for (const control of [name, note, category]) control.addEventListener('input', () => {
        if (!name.value.trim()) { hint.textContent = 'Bitte einen Ortsnamen angeben; die letzte gültige Fassung bleibt gespeichert.'; return; }
        const d = structuredClone(read()); d.places[i] = { ...p, name: name.value.trim(), note: note.value, category: category.value as typeof p.category };
        change(parseMap(d)); title.textContent = name.value.trim();
      });
      const save = document.createElement('button'); save.type = 'button'; save.textContent = 'Ort speichern'; save.addEventListener('click', () => { if (!name.value.trim()) { name.reportValidity(); hint.textContent = 'Bitte einen Ortsnamen angeben.'; return; } const d = structuredClone(read()); d.places[i] = { ...p, name: name.value.trim(), note: note.value, category: category.value as typeof p.category }; commit(d); }); editor.append(save);
    });
    if (!data.location && !data.waypoints.length && !data.places.length) entries.textContent = 'Deine Karte ist noch leer. Wähle oben eine Aktion.';
  }
  render(); return { render };
}
