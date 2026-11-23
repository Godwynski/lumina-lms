# Capstone 2 figures: editable remakes

Every figure in the paper has been redrawn to match the current Lumina system, as editable **draw.io** files (42 figures).

## Files
- `Figure X.drawio`: the editable diagram. Open it in draw.io: the desktop app, https://app.diagrams.net, or the VS Code "Draw.io Integration" extension.
- `Figure X.png`: ready to insert into Word. It is exported at 3× resolution, and **the editable diagram is embedded inside the PNG**, so you can also open the `.png` in draw.io and edit it directly.
- `source/`: the generator, kept so the figures can be rebuilt from the database schema and the JSON specs (see below).

## Inserting into the paper
- Insert the PNG and set its width to the text width (about 6 in). Every figure is sized so its smallest text prints at **8 pt or larger** at that width:
  - Flowcharts fit a portrait page.
  - **Figure 2 and the three Figure 2.1 parts (DFDs) are landscape.** Place them on a landscape section of the document.
- After inserting, refresh the List of Figures: right-click → Update Field → Update entire table.

## Changes from the old figure list
| Old | New |
|---|---|
| Figure 1 and 1.1: two ERDs, which were outdated and unreadable when printed | **Figure 1, 1.1, 1.2, 1.3**: four readable ERDs from the real schema. 1 = Catalog & Inventory, 1.1 = Circulation & Reservations, 1.2 = Users, Cards & Notifications, 1.3 = Administration & Archives. Two captions need to be added to the paper. |
| Figure 2.1: one Level 1 DFD with all five processes | **Figure 2.1 in three parts**, so each prints at 8 pt or larger: part 1 = 1.0 Auth & Users and 2.0 Catalog & Holds; part 2 = 3.0 Circulation & Visits; part 3 = 4.0 Policies, Lifecycle & Alerts and 5.0 Analytics & Audit. Each part shows all of its own external flows and data stores, and together they balance with Figure 2. Suggested captions: "Level 1 Data Flow Diagram (Part 1 of 3: Access & Catalog)", "(Part 2 of 3: Circulation & Visits)", "(Part 3 of 3: Policies, Lifecycle & Reporting)". |
| Unnumbered stock "Iterative Development" image (5 stages, no Deployment) | `Iterative Development Model`: editable, with the 6 stages the paper describes (Planning → Design → Implementation → Testing → Deployment → Evaluation) |
| Role names Super-Admin / Student-Assistant / Student | Super Administrator / Library Staff / Patron, matching the revised manuscript |
| Module names Setting & Policies, My Borrow | System Policies, My Borrowing |

Suggested caption changes:
- Figure 4.7: "Super Administrator System Policies Flowchart"
- Figure 5.7: "Librarian System Policies Flowchart"
- Figures 6.5 and 7.2: "My Borrowing"
- Figure 6.x: "Library Staff …"
- Figure 7.x: "Patron …"

## Notation
- **Flowcharts (ISO 5807):** stadium = start/end; rectangle = process; diamond = decision; parallelogram = input/scan; wavy-bottom = printed/exported document; circle = on-page connector; pentagon = off-page connector.
  The role letters link Figure 3 to each role's module charts: **B** Super Administrator, **C** Librarian, **D** Library Staff, **E** Patron.
- **DFDs (Gane–Sarson):** square = external entity; rounded box = process (numbered); open-ended box = data store (D1–D4).
- **ERDs (crow's foot):** `||` = exactly one; `o<` = zero or many; `o|` = zero or one. Dashed tables are references to tables drawn in full in another ERD figure.

## Rebuilding (optional)
In `source/`, run `npm install --prefix gen` once (installs elkjs), then `bash build.sh`. It needs Python 3, Node.js and draw.io desktop. Set `SCHEMA=path/to/schema_clean_install.sql` if the repo is somewhere other than `D:\Documents\Projects	hesis`. Edit `specs/*.json` to change a flowchart or DFD. The ERDs are regenerated straight from `supabase/schema_clean_install.sql`.
