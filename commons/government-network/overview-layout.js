/**
 * Place the complete reemployment graph in a compact, ministry-grouped atlas.
 * This changes only node geometry: identities, records and graph edges stay intact.
 */
export function layoutJobOverview(graphNodes, graphEdges, aspect = 1.6) {
  if (!graphNodes.length) return [];
  const ratio = Number.isFinite(aspect) ? Math.max(0.45, Math.min(3, aspect)) : 1.6;
  const byId = new Map(graphNodes.map(node => [node.id, node]));
  const groups = new Map();
  const assigned = new Map();
  const outgoing = new Map();
  const incoming = new Map();
  const ensureGroup = name => {
    const key = name || '出身府省の記載なし';
    if (!groups.has(key)) groups.set(key, { name: key, ministries: [], people: [], destinations: [], other: [] });
    return groups.get(key);
  };
  for (const edge of graphEdges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    if (!incoming.has(edge.target)) incoming.set(edge.target, []);
    outgoing.get(edge.source).push(byId.get(edge.target));
    incoming.get(edge.target).push(byId.get(edge.source));
  }
  for (const node of graphNodes) {
    if (node.type === 'ministry') {
      const group = ensureGroup(node.name);
      group.ministries.push(node);
      assigned.set(node.id, group);
    }
  }
  for (const node of graphNodes) {
    if (node.type !== 'person') continue;
    const source = (incoming.get(node.id) || []).find(parent => parent.type === 'ministry');
    const group = ensureGroup(node.ministry || source?.name);
    group.people.push(node);
    assigned.set(node.id, group);
  }
  for (const node of graphNodes) {
    if (assigned.has(node.id)) continue;
    // A destination shared by ministries has one node, assigned to the ministry
    // with the most incoming records. Cross-ministry links remain in graphEdges.
    const votes = new Map();
    for (const source of incoming.get(node.id) || []) {
      const group = assigned.get(source.id);
      if (group) votes.set(group, (votes.get(group) || 0) + 1);
    }
    const ranked = [...votes].sort((a, b) => b[1] - a[1] || a[0].name.localeCompare(b[0].name, 'ja'));
    const group = ranked[0]?.[0] || ensureGroup(node.ministry || 'その他の公表記録');
    (node.type === 'destination' ? group.destinations : group.other).push(node);
    assigned.set(node.id, group);
  }

  const PAD = 32, HEADER = 160, TILE_W = 560, ROW_H = 96, GAP = 24;
  const entries = [...groups.values()].filter(group => group.ministries.length + group.people.length + group.destinations.length + group.other.length);
  for (const group of entries) {
    // Keep records for the same destination adjacent, then put that destination
    // next to its first source record. Extra people use the remaining left cells.
    const destinationOrder = new Map(group.destinations.map((node, index) => [node.id, index]));
    const keyFor = node => {
      const destination = (outgoing.get(node.id) || []).find(target => target.type === 'destination');
      return destinationOrder.has(destination?.id) ? destinationOrder.get(destination.id) : group.destinations.length;
    };
    group.people.sort((a, b) => keyFor(a) - keyFor(b) || a.id.localeCompare(b.id));
    group.slots = Math.max(group.people.length + group.other.length, group.destinations.length, 1);
    group.headerRows = Math.max(1, group.ministries.length);
    group.header = HEADER + (group.headerRows - 1) * ROW_H;
    group.weight = Math.max(10, group.slots + 4);
  }
  entries.sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name, 'ja'));

  // Balanced recursive partitioning avoids both a long three-column strip and
  // narrow one-row layouts. Minimum weights leave room for small ministry groups.
  const partition = (items, x, y, w, h) => {
    if (items.length === 1) {
      Object.assign(items[0], { x, y, w, h });
      return;
    }
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let prefix = 0, split = 1, best = Infinity;
    for (let index = 1; index < items.length; index++) {
      prefix += items[index - 1].weight;
      const difference = Math.abs(total / 2 - prefix);
      if (difference < best) { best = difference; split = index; }
    }
    const first = items.slice(0, split), second = items.slice(split);
    const fraction = first.reduce((sum, item) => sum + item.weight, 0) / total;
    if (w >= h) {
      const firstWidth = w * fraction;
      partition(first, x, y, firstWidth, h);
      partition(second, x + firstWidth, y, w - firstWidth, h);
    } else {
      const firstHeight = h * fraction;
      partition(first, x, y, w, firstHeight);
      partition(second, x, y + firstHeight, w, h - firstHeight);
    }
  };
  let area = entries.reduce((sum, group) => sum + group.weight, 0) * TILE_W * ROW_H * 1.25;
  for (;;) {
    const width = Math.sqrt(area * ratio), height = Math.sqrt(area / ratio);
    partition(entries, PAD, PAD, width, height);
    let capacityOkay = true;
    for (const group of entries) {
      group.columns = Math.floor((group.w - 2 * PAD - GAP) / TILE_W);
      const rows = Math.floor((group.h - group.header - PAD - GAP) / ROW_H);
      if (group.columns < 1 || rows < 1 || group.columns * rows < group.slots) capacityOkay = false;
    }
    if (capacityOkay) break;
    area *= 1.2;
  }

  const panels = [];
  for (const group of entries) {
    const x = group.x + PAD, y = group.y + group.header;
    const columns = group.columns;
    const place = (node, slot, right = false) => {
      node.x = x + (slot % columns) * TILE_W + (right ? 280 : 0);
      node.y = y + Math.floor(slot / columns) * ROW_H;
      node.w = right ? 260 : 230;
      node.h = 68;
    };
    group.ministries.forEach((node, index) => {
      node.x = x;
      node.y = group.y + 82 + index * ROW_H;
      node.w = Math.max(230, Math.min(540, group.w - PAD * 2 - GAP));
      node.h = 68;
    });
    const left = [...group.people, ...group.other];
    left.forEach((node, index) => place(node, index));
    const used = new Set();
    const firstSource = new Map();
    left.forEach((node, index) => {
      for (const target of outgoing.get(node.id) || []) {
        if (target.type === 'destination' && !firstSource.has(target.id)) firstSource.set(target.id, index);
      }
    });
    const deferred = [];
    for (const node of group.destinations) {
      const slot = firstSource.get(node.id);
      if (slot !== undefined && !used.has(slot)) { place(node, slot, true); used.add(slot); }
      else deferred.push(node);
    }
    let slot = 0;
    for (const node of deferred) {
      while (used.has(slot)) slot++;
      place(node, slot, true);
      used.add(slot++);
    }
    panels.push({
      x: group.x, y: group.y, w: group.w - GAP, h: group.h - GAP,
      name: group.name,
      count: group.people.length,
      titleY: 60,
      titleSize: Math.max(26, Math.min(72, (group.w - PAD * 2 - GAP) / Math.max(5, [...group.name].length)))
    });
  }
  return panels;
}
