"""Spec -> Graphviz layout -> editable draw.io file.

  python -I gen.py flow SPEC.json OUT.drawio        # flowchart or DFD spec
  python -I gen.py erd SCHEMA.sql GROUPS.json OUTDIR # ERD figures from the real schema

Flow spec:
{"id":"fig-4.2","title":"...","rankdir":"TB",
 "nodes":[{"id":"a","type":"terminator|process|decision|io|connector|offpage|document|database|subprocess|manual|external|dfdprocess|datastore","label":"...","num":"1.0"}],
 "edges":[{"from":"a","to":"b","label":"Yes"}]}
"""
import sys, json, subprocess, re, html, textwrap, os

DOT = r'C:\Program Files\Graphviz\bin\dot.exe'
FONT = 'fontFamily=Arial;fontSize=12;'
BASE = 'whiteSpace=wrap;html=1;strokeColor=#000000;fillColor=#FFFFFF;fontColor=#000000;strokeWidth=1.5;' + FONT

STYLE = {
    'terminator': 'rounded=1;arcSize=50;' + BASE,
    'process':    'rounded=0;' + BASE,
    'subprocess': 'shape=process;size=0.08;' + BASE,
    'decision':   'rhombus;' + BASE,
    'io':         'shape=parallelogram;perimeter=parallelogramPerimeter;size=0.1;fixedSize=0;spacingLeft=22;spacingRight=22;' + BASE,
    'manual':     'shape=manualInput;size=12;' + BASE,
    'connector':  'ellipse;aspect=fixed;fontStyle=1;' + BASE,
    'offpage':    'shape=offPageConnector;size=0.3;fontStyle=1;' + BASE,
    'document':   'shape=document;size=0.15;boundedLbl=1;' + BASE,
    'database':   'shape=cylinder3;size=8;boundedLbl=1;' + BASE,
    # DFD (Gane-Sarson)
    'external':   'rounded=0;' + BASE,
    'dfdprocess': 'swimlane;rounded=1;arcSize=10;startSize=22;horizontal=1;fontStyle=0;' + BASE,
    'datastore':  'shape=partialRectangle;right=0;' + BASE,
}

def wrap(label, width):
    lines = []
    for part in str(label).split('\n'):
        lines += textwrap.wrap(part, width, break_long_words=False, break_on_hyphens=False) or ['']
    return lines

def size(n):
    t = n.get('type', 'process')
    lab = n.get('label', '')
    if t == 'connector': return 44, 44
    if t == 'offpage': return 44, 48
    w_chars = {'decision': 14, 'io': 16, 'terminator': 16}.get(t, 18)
    lines = wrap(lab, w_chars)
    longest = max(len(l) for l in lines) if lines else 4
    w = max(96, min(190, longest * 6.8 + 26))
    h = max(40, 16 * len(lines) + 18)
    if t == 'decision':  # text must fit the inscribed rectangle of the rhombus
        tw, th = longest * 7.0 + 8, 16 * len(lines)
        w, h = max(120, tw * 1.7 + 20), max(60, th * 1.7 + 18)
    if t == 'io': w += 44
    if t == 'terminator': w, h = w + 10, max(46, h)
    if t == 'database': h += 18
    if t == 'dfdprocess': w, h = max(w, 130), h + 22
    if t == 'datastore':  # drawn on one line as "D1 | label"
        txt = f"{n['num']} | {lab}" if n.get('num') else lab
        w, h = max(150, len(txt) * 6.5 + 14), 40
    return round(w), round(h)

def esc(s): return html.escape(str(s), quote=True)

def dot_layout(nodes, edges, rankdir='TB', nodesep=0.45, ranksep=0.55, extra=''):
    lines = [f'digraph G {{ graph [rankdir={rankdir}, nodesep={nodesep}, ranksep={ranksep}, splines=ortho {extra}]; node [shape=box, fixedsize=true];']
    for n in nodes:
        w, h = n['_w'], n['_h']
        lines.append(f'"{n["id"]}" [width={w/72:.3f}, height={h/72:.3f}];')
    for e in edges:
        attrs = []
        if e.get('constraint') is False: attrs.append('constraint=false')
        if e.get('label'): attrs.append(f'xlabel="{e["label"]}"')
        lines.append(f'"{e["from"]}" -> "{e["to"]}" [{", ".join(attrs)}];')
    lines.append('}')
    out = subprocess.run([DOT, '-Tjson'], input='\n'.join(lines).encode(), capture_output=True, check=True).stdout
    g = json.loads(out)
    bb = [float(v) for v in g['bb'].split(',')]
    H = bb[3]
    pos = {}; names = {}
    for o in g.get('objects', []):
        x, y = (float(v) for v in o['pos'].split(','))
        pos[o['name']] = (x, H - y); names[o['_gvid']] = o['name']
    routes = []
    for e in g.get('edges', []):
        pts = []
        for op in e.get('_draw_', []):
            if op.get('op') in ('b', 'B'): pts = [(px, H - py) for px, py in op['points']]
        seg = pts[::3] if len(pts) >= 4 else pts
        routes.append((names[e['tail']], names[e['head']], seg[1:-1]))
    pos['__routes__'] = routes
    return pos

HERE = os.path.dirname(os.path.abspath(__file__))
def elk_layout(nodes, edges, direction='DOWN', node_spacing=36, layer_spacing=42, wrap_strategy=None, aspect=None, keep_order=False, label_wrap=20):
    types = {n['id']: n.get('type', 'process') for n in nodes}
    g = {'direction': direction, 'nodeSpacing': node_spacing, 'layerSpacing': layer_spacing, 'keepOrder': keep_order,
         **({'wrap': wrap_strategy} if wrap_strategy else {}), **({'aspectRatio': aspect} if aspect else {}),
         'nodes': [{'id': n['id'], 'w': n['_w'], 'h': n['_h'], 'type': n.get('type', 'process'),
                    **({'partition': n['partition']} if 'partition' in n else {})} for n in nodes],
         # decision-branch labels are placed next to the diamond tip later, so ELK need not reserve room for them
         'edges': [{'id': f'e{i}', 'from': e['from'], 'to': e['to'],
                    'label': '\n'.join(wrap(e['label'], label_wrap)) if e.get('label') and types.get(e['from']) != 'decision' else '',
                    **({'exitSide': e['exitSide']} if e.get('exitSide') else {}), **({'entrySide': e['entrySide']} if e.get('entrySide') else {})}
                   for i, e in enumerate(edges)]}
    out = subprocess.run(['node', os.path.join(HERE, 'layout.cjs')], input=json.dumps(g).encode(), capture_output=True)
    if out.returncode: raise SystemExit(out.stderr.decode())
    return json.loads(out.stdout)

PAGE_W, PAGE_H = 6.0 * 96, 9.0 * 96   # printable area in draw.io px (96/in): 6 x 9 in portrait
def readability(W, H, font_px=11):
    """Smallest printed font (pt) when the figure is scaled to fit a portrait or a landscape page."""
    W, H = W + 24, H + 24   # export border
    port = min(1.0, PAGE_W / W, PAGE_H / H)
    land = min(1.0, PAGE_H / W, PAGE_W / H)
    # prefer portrait (no page rotation) whenever it is readable
    best, orient = (port, 'portrait') if font_px * 0.75 * port >= 7.95 else max((port, 'portrait'), (land, 'landscape'))
    pt = font_px * 0.75 * best
    return f'{"READ-OK" if pt >= 7.95 else "READ-FAIL"} {pt:.1f}pt {orient}'

def mx(cells, title):
    body = '\n'.join(cells)
    return (f'<mxfile host="Lumina figure generator"><diagram name="{esc(title)}">'
            f'<mxGraphModel dx="1200" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">'
            f'<root><mxCell id="0"/><mxCell id="1" parent="0"/>\n{body}\n</root></mxGraphModel></diagram></mxfile>')

EDGE = ('edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;jumpStyle=arc;jumpSize=8;endArrow=block;endFill=1;'
        'strokeColor=#000000;strokeWidth=1.5;' + FONT + 'labelBackgroundColor=#FFFFFF;')

def sanitize(wp, src, dst):
    """Keep Graphviz waypoints only if they form an axis-aligned path that can leave src and enter dst straight."""
    if not wp: return []
    def aligned(p, q): return abs(p[0] - q[0]) < 1.5 or abs(p[1] - q[1]) < 1.5
    def reach(p, g):
        x, y, w, h = g
        return (x - w / 2 + 4 <= p[0] <= x + w / 2 - 4) or (y - h / 2 + 4 <= p[1] <= y + h / 2 - 4)
    if not all(aligned(wp[i], wp[i + 1]) for i in range(len(wp) - 1)): return []
    if not reach(wp[0], src) or not reach(wp[-1], dst): return []
    return wp

def flow(spec_path, out_path):
    spec = json.load(open(spec_path, encoding='utf-8'))
    nodes, edges = spec['nodes'], spec['edges']
    ids = {n['id'] for n in nodes}
    if len(ids) != len(nodes): raise SystemExit(f'{spec_path}: duplicate node ids')
    for e in edges:
        for k in ('from', 'to'):
            if e[k] not in ids: raise SystemExit(f'{spec_path}: edge references unknown node {e[k]!r}')
    for n in nodes: n['_w'], n['_h'] = size(n)
    nodes_by_id = {n['id']: n for n in nodes}
    order = ['SOUTH', 'EAST', 'WEST'] if spec.get('rankdir', 'TB') == 'TB' else ['EAST', 'SOUTH', 'NORTH']
    used = {}
    for e in edges:
        if nodes_by_id[e['from']].get('type') == 'decision':
            k = len(used.setdefault(e['from'], []))
            side = e.get('exitSide') or order[min(k, 2)]
            if side in used[e['from']]:
                print(f'WARN {spec_path}: two branches leave {e["from"]!r} from the same {side} tip; set exitSide or cut a branch')
            used[e['from']].append(side)
    direction = {'TB': 'DOWN', 'LR': 'RIGHT'}.get(spec.get('rankdir', 'TB'), 'DOWN')
    lay = elk_layout(nodes, edges, direction, spec.get('nodeSpacing', 28), spec.get('layerSpacing', 30), keep_order=spec.get('keepOrder', False), label_wrap=spec.get('labelWrap', 20))
    # Tall charts: let ELK fold the layers into side-by-side columns when that prints larger
    def score(l): return min(PAGE_W / (l['width'] + 24), PAGE_H / (l['height'] + 24), 1.0)
    if spec.get('wrap', False) and score(lay) < 1.0:
        for strat in ('SINGLE_EDGE', 'MULTI_EDGE'):
            alt = elk_layout(nodes, edges, direction, spec.get('nodeSpacing', 28), spec.get('layerSpacing', 30), strat, 0.66)
            if score(alt) > score(lay) + 0.02: lay = alt
    geom = {}
    cells = []
    for n in nodes:
        x, y = lay['nodes'][n['id']]['x'], lay['nodes'][n['id']]['y']; w, h = n['_w'], n['_h']
        geom[n['id']] = (x, y, w, h)
        lab = n.get('label', '')
        if n.get('type') == 'dfdprocess':
            cells.append(f'<mxCell id="{esc(n["id"])}" value="{esc(n.get("num", ""))}" style="{STYLE["dfdprocess"]}" vertex="1" parent="1"><mxGeometry x="{x:.0f}" y="{y:.0f}" width="{w}" height="{h}" as="geometry"/></mxCell>')
            cells.append(f'<mxCell id="{esc(n["id"])}_t" value="{esc(lab)}" style="text;html=1;align=center;verticalAlign=middle;whiteSpace=wrap;{FONT}" vertex="1" parent="{esc(n["id"])}"><mxGeometry y="22" width="{w}" height="{h-22}" as="geometry"/></mxCell>')
            continue
        if n.get('type') == 'datastore' and n.get('num'):
            lab = f'{n["num"]} | {lab}'
        style = STYLE.get(n.get('type', 'process'), STYLE['process'])
        val = esc(lab)
        if n.get('type') not in ('connector', 'offpage', 'datastore'):
            # break lines exactly as size() measured them, so draw.io never re-wraps (e.g. at hyphens)
            wc = {'decision': 14, 'io': 16, 'terminator': 16}.get(n.get('type'), 18)
            val = '&lt;br&gt;'.join(esc(l) for l in wrap(lab, wc))
        cells.append(f'<mxCell id="{esc(n["id"])}" value="{val}" style="{style}" vertex="1" parent="1"><mxGeometry x="{x:.0f}" y="{y:.0f}" width="{w}" height="{h}" as="geometry"/></mxCell>')
    for i, e in enumerate(edges):
        r = lay['edges'].get(f'e{i}')
        st = EDGE + (e.get('style') or '')
        geo = '<mxGeometry relative="1" as="geometry"/>'
        if r:
            sx, sy, sw, sh = geom[e['from']]; tx, ty, tw, th = geom[e['to']]
            fx = lambda v, a, b: min(1, max(0, (v - a) / b))
            st += (f'exitX={fx(r["start"][0], sx, sw):.3f};exitY={fx(r["start"][1], sy, sh):.3f};exitDx=0;exitDy=0;exitPerimeter=0;'
                   f'entryX={fx(r["end"][0], tx, tw):.3f};entryY={fx(r["end"][1], ty, th):.3f};entryDx=0;entryDy=0;entryPerimeter=0;')
            pts = ''.join(f'<mxPoint x="{x:.0f}" y="{y:.0f}"/>' for x, y in r['bends'])
            # labels of decision branches sit just after the tip they leave from
            gx = ''
            if e.get('label') and nodes_by_id[e['from']].get('type') == 'decision':
                path = [tuple(r['start'])] + [tuple(b) for b in r['bends']] + [tuple(r['end'])]
                segs = [abs(a[0] - b[0]) + abs(a[1] - b[1]) for a, b in zip(path, path[1:])]
                L = sum(segs) or 1
                horiz = abs(path[0][1] - path[1][1]) < 1
                half = (len(e['label']) * 3.4 + 4) if horiz else 9   # half the label extent along the segment
                d = min(half + 8, L / 2)
                gx = f' x="{2 * d / L - 1:.3f}"'
            off = ''
            if e.get('label') and not gx and r.get('label'):
                # put the label where ELK reserved room for it: nearest path point -> fraction + offset
                path = [tuple(r['start'])] + [tuple(b) for b in r['bends']] + [tuple(r['end'])]
                cx, cy = r['label']; best = None; acc = 0.0
                for a, b in zip(path, path[1:]):
                    sl = abs(a[0] - b[0]) + abs(a[1] - b[1])
                    t = 0.0 if sl == 0 else max(0.0, min(1.0, ((cx - a[0]) * (b[0] - a[0]) + (cy - a[1]) * (b[1] - a[1])) / (sl * sl)))
                    px, py = a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])
                    dist = (px - cx) ** 2 + (py - cy) ** 2
                    if best is None or dist < best[0]: best = (dist, acc + t * sl, px, py)
                    acc += sl
                L = acc or 1
                gx = f' x="{2 * best[1] / L - 1:.3f}"'
                off = f'<mxPoint x="{cx - best[2]:.0f}" y="{cy - best[3]:.0f}" as="offset"/>'
            inner = (f'<Array as="points">{pts}</Array>' if pts else '') + off
            geo = f'<mxGeometry{gx} relative="1" as="geometry">{inner}</mxGeometry>'
        if e.get('dashed'): st += 'dashed=1;'
        if e.get('bidirectional'): st += 'startArrow=block;startFill=1;'
        elab = '&lt;br&gt;'.join(esc(l) for l in wrap(e['label'], spec.get('labelWrap', 20))) if e.get('label') else ''
        cells.append(f'<mxCell id="e{i}" value="{elab}" style="{st}" edge="1" parent="1" source="{esc(e["from"])}" target="{esc(e["to"])}">{geo}</mxCell>')
    open(out_path, 'w', encoding='utf-8').write(mx(cells, spec.get('title', spec.get('id', 'figure'))))
    print('ok', out_path, len(nodes), 'nodes', len(edges), 'edges', f'{lay["width"]:.0f}x{lay["height"]:.0f}', readability(lay['width'], lay['height'], 12))

# ---------------- ERD from schema ----------------
def parse_schema(sql):
    tables = {}
    for m in re.finditer(r'CREATE TABLE IF NOT EXISTS public\.(\w+)\s*\((.*?)\n\);', sql, re.S):
        name, body = m.group(1), m.group(2)
        cols, fks = [], []
        depth = 0; buf = ''; parts = []
        for ch in body:
            if ch == '(': depth += 1
            if ch == ')': depth -= 1
            if ch == ',' and depth == 0: parts.append(buf); buf = ''
            else: buf += ch
        parts.append(buf)
        uniques = set(); notnull = set()
        for p in parts:
            p = ' '.join(p.split())
            if not p or p.startswith('--'): continue
            up = p.upper()
            if re.match(r'(CONSTRAINT|PRIMARY KEY|UNIQUE|CHECK|FOREIGN KEY|EXCLUDE)\b', up):
                mm = re.match(r'(?:CONSTRAINT \w+ )?UNIQUE ?\(([\w, ]+)\)', p, re.I)
                if mm and ',' not in mm.group(1): uniques.add(mm.group(1).strip())
                mm = re.match(r'(?:CONSTRAINT \w+ )?FOREIGN KEY ?\((\w+)\) REFERENCES (?:public\.|auth\.)?(\w+)', p, re.I)
                if mm: fks.append((mm.group(1), mm.group(2)))
                continue
            mm = re.match(r'"?(\w+)"?\s+([\w."\[\]]+(?:\(\d+(?:,\s*\d+)?\))?(?:\[\])?)', p)
            if not mm: continue
            col, typ = mm.group(1), mm.group(2).replace('public.', '').replace('"', '')
            if re.match(r'(text|uuid|integer|boolean|jsonb|numeric|date|bigint|smallint|timestamptz|timestamp|tsvector|varchar)\b', typ, re.I): typ = typ.upper()
            typ = {'TIMESTAMP': 'TIMESTAMPTZ'}.get(typ, typ)
            key = ''
            if 'PRIMARY KEY' in up: key = 'PK'
            r = re.search(r'\bREFERENCES (?:public\.|auth\.)?(\w+)', p, re.I)
            if r: key = (key + ',FK').strip(','); fks.append((col, r.group(1)))
            if 'UNIQUE' in up and 'PK' not in key: key = (key + ',UK').strip(',')
            if 'NOT NULL' in up or 'PK' in key: notnull.add(col)
            cols.append([col, typ, key])
        for c in cols:
            if c[0] in uniques and 'UK' not in c[2] and 'PK' not in c[2]: c[2] = (c[2] + ',UK').strip(',')
        tables[name] = {'cols': cols, 'fks': fks, 'notnull': notnull}
    # FKs added later with ALTER TABLE
    for m in re.finditer(r'ALTER TABLE (?:ONLY )?public\.(\w+)\s+ADD CONSTRAINT \w+ FOREIGN KEY \((\w+)\) REFERENCES (?:public\.|auth\.)?(\w+)', sql, re.I):
        t, c, ref = m.groups()
        if t in tables:
            tables[t]['fks'].append((c, ref))
            for col in tables[t]['cols']:
                if col[0] == c and 'FK' not in col[2]: col[2] = (col[2] + ',FK').strip(',')
    return tables

def elk_raw(g):
    out = subprocess.run(['node', os.path.join(HERE, 'layout.cjs')], input=json.dumps(g).encode(), capture_output=True)
    if out.returncode: raise SystemExit(out.stderr.decode())
    return json.loads(out.stdout)

def erd(schema_path, groups_path, outdir):
    """groups: [{"id","title","columns":[[t,...],[t,...]],"stubs":{"profiles":"see Figure 1.1"}}]
    Tables are stacked in fixed columns; relations run through lanes in the gutters between columns."""
    tables = parse_schema(open(schema_path, encoding='utf-8').read())
    groups = json.load(open(groups_path, encoding='utf-8'))
    os.makedirs(outdir, exist_ok=True)
    rowh, head, vgap, lane, gpad = 18, 24, 22, 9, 32
    for fig in groups:
        stubs = fig.get('stubs', {})
        cols_layout = fig['columns']
        colof = {t: c for c, ts in enumerate(cols_layout) for t in ts}
        names = list(colof)
        for t in names:
            if t not in tables: raise SystemExit(f'unknown table {t}')
        def cols_of(t):
            return [c for c in tables[t]['cols'] if 'PK' in c[2]] if t in stubs else tables[t]['cols']
        rels, seen = [], set()
        for t in names:
            if t in stubs: continue
            for col, ref in tables[t]['fks']:
                ref = 'profiles' if ref == 'users' else ref
                if ref in colof and ref != t and (t, col) not in seen:
                    seen.add((t, col)); rels.append((ref, t, col))
        ncol = len(cols_layout)
        # gutter g sits right of column g (g = 0..ncol-1); gutter -1 would be left of col 0 (unused)
        plan = []
        for ref, t, col in rels:
            a, b = colof[ref], colof[t]
            if abs(a - b) > 1: raise SystemExit(f'{fig["id"]}: {ref}->{t} spans non-adjacent columns')
            if a == b: g = a; sside = tside = 'E'
            elif a < b: g = a; sside, tside = 'E', 'W'
            else: g = b; sside, tside = 'W', 'E'
            plan.append([ref, t, col, g, sside, tside])
        lanes = {g: [] for g in range(ncol)}
        for i, pl in enumerate(plan): lanes[pl[3]].append(i)
        gw = {g: (gpad + 26 + lane * (len(v) - 1) if v else 40) for g, v in lanes.items()}
        colw = [max(round(max(170, max(len(c[0]) + len(c[1]) + len(c[2]) for c in cols_of(t)) * 6.2 + 40)) for t in ts) for ts in cols_layout]
        colx, x = [], 10
        for c in range(ncol): colx.append(x); x += colw[c] + gw[c]
        geom = {}
        for c, ts in enumerate(cols_layout):
            y = 10
            for t in ts:
                h = head + rowh * len(cols_of(t)); geom[t] = (colx[c], y, colw[c], h); y += h + vgap
        def rowy(t, colname):
            k = next(i for i, c in enumerate(cols_of(t)) if c[0] == colname)
            return geom[t][1] + head + rowh * k + rowh / 2
        cells = []
        for t in names:
            x, y, w, h = geom[t]
            title = t + (f' ({stubs[t]})' if t in stubs else '')
            dash = 'dashed=1;' if t in stubs else ''
            cells.append(f'<mxCell id="{t}" value="{esc(title)}" style="swimlane;fontStyle=1;childLayout=stackLayout;horizontal=1;startSize={head};horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=0;marginBottom=0;html=1;fillColor=#E6E6E6;swimlaneFillColor=#FFFFFF;strokeColor=#000000;{dash}{FONT}" vertex="1" parent="1"><mxGeometry x="{x}" y="{y:.0f}" width="{w}" height="{h}" as="geometry"/></mxCell>')
            for k, (c, typ, key) in enumerate(cols_of(t)):
                label = f'{c} : {typ}' + (f'  [{key}]' if key else '')
                bold = 'fontStyle=1;' if 'PK' in key else ''
                cells.append(f'<mxCell id="{t}.{c}" value="{esc(label)}" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=6;spacingRight=4;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;html=1;{bold}fontFamily=Arial;fontSize=11;" vertex="1" parent="{t}"><mxGeometry y="{head + k*rowh}" width="{w}" height="{rowh}" as="geometry"/></mxCell>')
        for g, idxs in lanes.items():
            # short vertical spans hug the column on the left of the gutter; long spans go further out
            def span(i):
                ref, t, col = plan[i][:3]; pkc = cols_of(ref)[next(k for k, c in enumerate(cols_of(ref)) if 'PK' in c[2])][0]
                return abs(rowy(ref, pkc) - rowy(t, col))
            # fan-out toward the right column: short spans nearest the target; C-shapes / leftward: short spans nearest the column
            for li, i in enumerate(sorted(idxs, key=lambda i: -span(i) if plan[i][5] == 'W' else span(i))):
                plan[i].append(colx[g] + colw[g] + gpad + lane * li)
        # edges leaving the same PK side with different parent markers get separate exit points,
        # so a mandatory (||) and an optional (o|) marker never draw on top of each other
        kinds = {}
        for ref, t, col, g, sside, tside, lx in plan:
            kinds.setdefault((ref, sside), set()).add(col in tables[t]['notnull'])
        for i, (ref, t, col, g, sside, tside, lx) in enumerate(plan):
            pkc = next(c[0] for c in cols_of(ref) if 'PK' in c[2])
            mand = col in tables[t]['notnull']
            exy = 0.5 if len(kinds[(ref, sside)]) == 1 else (0.22 if mand else 0.78)
            fkkey = next(c[2] for c in tables[t]['cols'] if c[0] == col)
            end_ = 'ERzeroToOne' if ('PK' in fkkey or 'UK' in fkkey) else 'ERzeroToMany'
            # parent side: exactly one if the FK is NOT NULL, otherwise zero or one
            start_ = 'ERmandOne' if col in tables[t]['notnull'] else 'ERzeroToOne'
            sy, ty = rowy(ref, pkc) + (exy - 0.5) * rowh, rowy(t, col)
            ex, nx = (1 if sside == 'E' else 0), (1 if tside == 'E' else 0)
            st = (f'edgeStyle=none;rounded=0;html=1;jumpStyle=arc;jumpSize=6;endArrow={end_};startArrow={start_};endFill=0;startFill=0;endSize=9;startSize=9;'
                  f'strokeColor=#000000;strokeWidth=1.2;exitX={ex};exitY={exy};exitDx=0;exitDy=0;exitPerimeter=0;entryX={nx};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;' + FONT)
            pts = f'<mxPoint x="{lx:.0f}" y="{sy:.0f}"/><mxPoint x="{lx:.0f}" y="{ty:.0f}"/>'
            cells.append(f'<mxCell id="r{i}" value="" style="{st}" edge="1" parent="1" source="{ref}.{pkc}" target="{t}.{col}"><mxGeometry relative="1" as="geometry"><Array as="points">{pts}</Array></mxGeometry></mxCell>')
        W = colx[-1] + colw[-1] + gw[ncol - 1]
        H = max(geom[t][1] + geom[t][3] for t in names)
        out = os.path.join(outdir, f'{fig["id"]}.drawio')
        open(out, 'w', encoding='utf-8').write(mx(cells, fig['title']))
        print('ok', out, len(names), 'tables', len(rels), 'relations', f'{W:.0f}x{H:.0f}', readability(W, H, 11))

if __name__ == '__main__':
    if sys.argv[1] == 'flow': flow(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == 'erd': erd(sys.argv[2], sys.argv[3], sys.argv[4])
