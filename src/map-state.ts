export interface MapPoint { x: number; y: number }
export interface Place extends MapPoint { name: string; note: string; category: 'Ort' | 'Gefahr' | 'Lager' }
export interface MapData { location: MapPoint | null; waypoints: MapPoint[]; places: Place[] }
export function emptyMap(): MapData { return { location: null, waypoints: [], places: [] }; }
export function parseMap(value: unknown): MapData {
  if (value === undefined) return emptyMap();
  if (!value || typeof value !== 'object') throw new Error('Ungültige Kartendaten.');
  const m = value as MapData;
  function point(p: MapPoint): MapPoint {
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number' || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1000 || p.y < 0 || p.y > 700) throw new Error('Ungültige Kartenkoordinaten.');
    return { x: p.x, y: p.y };
  }
  if (!Array.isArray(m.waypoints) || !Array.isArray(m.places) || m.waypoints.length > 2000 || m.places.length > 1000) throw new Error('Ungültige Kartenlisten (maximal 2000 Wegpunkte und 1000 Orte).');
  return { location: m.location === null ? null : point(m.location), waypoints: m.waypoints.map(point), places: m.places.map(p => {
    if (!p || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 120 || typeof p.note !== 'string' || p.note.length > 2000 || !['Ort', 'Gefahr', 'Lager'].includes(p.category)) throw new Error('Ungültiger Kartenort.');
    return { ...point(p), name: p.name, note: p.note, category: p.category };
  }) };
}
