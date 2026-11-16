# Lumina LMS — Live DOM-Extracted Wireframes (A4 + Playable + Figma)

All wireframes in this folder were extracted **directly from the live running Lumina LMS DOM** (`http://localhost:3000`) across Public, Student, Student Assistant, Librarian, Super Admin, and Mobile (`390×844`) viewports.

## Deliverables
- **`lumina-playable-wireframe.html`** — **Interactive Playable Wireframe Prototype** (like Figma Present Mode). Click any highlighted link, sidebar item, book card, or demo login button to navigate between screens, or toggle **Wireframe SVG vs. Real Live UI**.
- **`lumina-wireframes-a4.pdf`** — **29-page A4 Portrait Wireframe Book** pairing each live DOM-extracted wireframe SVG with its verified live screenshot and interactive link map.
- **`lumina-connected-flow.svg`** (also `lumina-master-canvas.svg`) — All 28 screens laid out by role on one **Figma / Penpot vector canvas** with 134 connector arrows showing every transition.
- **`figma-prototype-builder.js`** — **Figma Plugin Script** that generates native Figma frames AND automatically wires clickable prototype noodles (`ON_CLICK -> NAVIGATE`) inside Figma Desktop.
- **`svg/*.svg`** — Individual layered vector SVG artboards with real Lucide icons, exact bounding boxes, and editable typography.
- **`screenshots/*.png`** — Exact live reference screenshots for every captured route.

## How to Run `figma-prototype-builder.js` in Figma Desktop
1. Open Figma Desktop → **Plugins → Development → New Plugin...** (choose *Custom UI / Figma Design*, *Empty*).
2. Replace the generated `code.js` with the contents of `figma-prototype-builder.js`.
3. Run the plugin from **Plugins → Development** — it creates all 28 frames and wires every clickable prototype link automatically.
