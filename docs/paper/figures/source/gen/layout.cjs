// stdin: {direction, nodes:[{id,w,h,type}], edges:[{id,from,to,label}]}  stdout: positions + orthogonal routes
const ELK = require('elkjs');
const PORTED = new Set(['decision', 'connector', 'offpage', 'terminator']);
let buf = '';
process.stdin.on('data', d => (buf += d));
process.stdin.on('end', async () => {
  const g = JSON.parse(buf);
  const dir = g.direction || 'DOWN';
  const inSide = dir === 'DOWN' ? 'NORTH' : 'WEST';
  const outOrder = dir === 'DOWN' ? ['SOUTH', 'EAST', 'WEST'] : ['EAST', 'SOUTH', 'NORTH'];
  const portPos = (side, w, h) => ({ NORTH: [w / 2, 0], SOUTH: [w / 2, h], EAST: [w, h / 2], WEST: [0, h / 2] }[side]);
  const children = g.nodes.map(n => {
    const c = { id: n.id, width: n.w, height: n.h, layoutOptions: {} };
    if (n.partition !== undefined) c.layoutOptions['elk.partitioning.partition'] = String(n.partition);
    if (n.ports) {
      c.layoutOptions['elk.portConstraints'] = 'FIXED_POS';
      c.ports = n.ports.map(pt => ({ id: pt.id, x: pt.x, y: pt.y, width: 0, height: 0, layoutOptions: { 'elk.port.side': pt.side } }));
    } else if (PORTED.has(n.type)) {
      c.layoutOptions['elk.portConstraints'] = 'FIXED_POS';
      c.ports = ['NORTH', 'SOUTH', 'EAST', 'WEST'].map(s => {
        const [x, y] = portPos(s, n.w, n.h);
        return { id: `${n.id}__${s}`, x: x, y: y, width: 0, height: 0, layoutOptions: { 'elk.port.side': s } };
      });
    }
    return c;
  });
  const typeOf = Object.fromEntries(g.nodes.map(n => [n.id, n.type]));
  const outCount = {};
  const edges = g.edges.map(e => {
    let src = e.from, dst = e.to;
    if (e.srcPort || e.dstPort) {
      return { id: e.id, sources: [e.srcPort || e.from], targets: [e.dstPort || e.to] };
    }
    if (PORTED.has(typeOf[e.from])) {
      const k = (outCount[e.from] = (outCount[e.from] || 0) + 1) - 1;
      src = `${e.from}__${e.exitSide || outOrder[Math.min(k, 2)]}`;
    }
    if (PORTED.has(typeOf[e.to])) dst = `${e.to}__${e.entrySide || inSide}`;
    const ed = { id: e.id, sources: [src], targets: [dst] };
    if (e.label) {
      const lines = e.label.split('\n');
      ed.labels = [{ text: e.label, width: Math.max(...lines.map(l => l.length)) * 6.6 + 8, height: 15 * lines.length + 2 }];
    }
    return ed;
  });
  const elk = new ELK();
  const res = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': dir,
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': String(g.nodeSpacing || 36),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(g.layerSpacing || 42),
      'elk.spacing.edgeNode': '18',
      'elk.spacing.edgeEdge': '12',
      'elk.layered.spacing.edgeNodeBetweenLayers': '18',
      'elk.edgeLabels.placement': 'CENTER',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.padding': '[top=10,left=10,bottom=10,right=10]',
      'elk.aspectRatio': String(g.aspectRatio || 1.6),
      ...(g.nodes.some(n => n.partition !== undefined) ? { 'elk.partitioning.activate': 'true' } : {}),
      ...(g.keepOrder ? { 'elk.layered.crossingMinimization.forceNodeModelOrder': 'true' } : {}),
      ...(g.wrap ? { 'elk.layered.wrapping.strategy': g.wrap, 'elk.layered.wrapping.additionalEdgeSpacing': '10',
                     'elk.layered.wrapping.correctionFactor': '1.0' } : {}),
    },
    children,
    edges,
  });
  const out = { nodes: {}, edges: {}, width: res.width, height: res.height };
  for (const c of res.children) out.nodes[c.id] = { x: c.x, y: c.y };
  for (const e of res.edges) {
    const s = (e.sections || [])[0];
    if (!s) continue;
    out.edges[e.id] = {
      start: [s.startPoint.x, s.startPoint.y],
      end: [s.endPoint.x, s.endPoint.y],
      bends: (s.bendPoints || []).map(p => [p.x, p.y]),
      label: e.labels && e.labels[0] ? [e.labels[0].x + e.labels[0].width / 2, e.labels[0].y + e.labels[0].height / 2] : null,
    };
  }
  process.stdout.write(JSON.stringify(out));
});
