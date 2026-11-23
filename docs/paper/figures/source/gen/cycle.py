"""Editable iterative-development cycle (draw.io). python -I cycle.py OUT.drawio"""
import sys, math, importlib.util, os
spec = importlib.util.spec_from_file_location('g', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gen.py'))
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
stages = ['Planning', 'Design', 'Implementation', 'Testing', 'Deployment', 'Evaluation']
cx, cy, R, w, h = 330, 300, 215, 150, 54
cells = [f'<mxCell id="center" value="Iterative&lt;br&gt;Development" style="ellipse;whiteSpace=wrap;html=1;strokeColor=#000000;fillColor=#FFFFFF;fontColor=#000000;strokeWidth=1.5;fontFamily=Arial;fontSize=16;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="{cx-90}" y="{cy-55}" width="180" height="110" as="geometry"/></mxCell>']
for i, s in enumerate(stages):
    a = math.radians(-90 + i * 60)
    x, y = cx + R * math.cos(a) - w / 2, cy + R * math.sin(a) - h / 2
    cells.append(f'<mxCell id="s{i}" value="Stage {i+1}&lt;br&gt;&lt;b&gt;{s}&lt;/b&gt;" style="rounded=1;arcSize=30;{g.BASE}" vertex="1" parent="1"><mxGeometry x="{x:.0f}" y="{y:.0f}" width="{w}" height="{h}" as="geometry"/></mxCell>')
for i in range(6):
    j = (i + 1) % 6
    am = math.radians(-90 + i * 60 + 30)
    px, py = cx + (R + 34) * math.cos(am), cy + (R + 34) * math.sin(am)
    cells.append(f'<mxCell id="a{i}" value="" style="curved=1;html=1;endArrow=block;endFill=1;strokeColor=#000000;strokeWidth=2;" edge="1" parent="1" source="s{i}" target="s{j}"><mxGeometry relative="1" as="geometry"><Array as="points"><mxPoint x="{px:.0f}" y="{py:.0f}"/></Array></mxGeometry></mxCell>')
open(sys.argv[1], 'w', encoding='utf-8').write(g.mx(cells, 'Iterative Development Model'))
print('ok', sys.argv[1])
