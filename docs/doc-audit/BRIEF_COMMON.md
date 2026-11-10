# Shared brief: documentation-fix audit (Lumina LMS)

Repo root: C:\Users\Godwyn\Documents\Projects\thesis (Next.js App Router + Supabase). The SYSTEM (code) is the source of truth.
The thesis DOCUMENTATION is what must change. Your job: find every place where your assigned documentation part is inaccurate,
outdated, or does not match the system, and say exactly how to fix the DOCUMENT.

Where to look in the system: app/ (routes/pages per role), components/, lib/actions/ (business logic), lib/validations, lib/auth,
supabase/schema_clean_install.sql + supabase/migrations (real DB schema), middleware/proxy files, package.json (real tech stack/versions),
IGNORE all other documentation in the repo (docs/, *.md audits such as THESIS_VS_SYSTEM_ALIGNMENT_AUDIT.md, DOCUMENTATION_SYSTEM_CROSSCHECK.md). The ONLY document in scope is docs/doc-audit/capstone-documentation.md (split into docs/doc-audit/parts/). Do not cite other docs as evidence; cite code only.
Do NOT edit any code or the manuscript. Write ONLY your report file.

Rules:
- Verify every claim against code before reporting. Cite the system evidence as `path:line`.
- Only report real mismatches (wrong, missing-in-doc, doc-claims-but-not-in-system, wrong names/labels/numbers/roles/policy values). No praise, no filler.
- Skip pure literature review / citations / interview transcripts / Gantt dates unless they state something about the system.
- Be concise. One table row per finding.

Report format (markdown, exactly this):
# Doc fixes: <part name>
## Summary
<2-3 lines: counts by severity>
## Fixes
| # | Severity (High/Med/Low) | Doc location (tab/section/REQ id/figure) | Doc currently says | System actually does (evidence path:line) | Fix to apply in doc |
|---|---|---|---|---|---|
## Could not verify
<bullets, short>

Severity: High = factually wrong feature/flow/schema that a panelist could catch; Med = wrong label/name/value; Low = wording/typo/numbering.
End your final message with the line: AUDIT COMPLETE
