# Manuscript sources and audit records

Indexed on 12 November 2026. These files preserve source material and prior review results. The [current user guide](../user-guide.md) describes the working application.

## Source inventory

| File | Provenance and status |
|---|---|
| [Capstone PDF](../../Capstone%20documentation.pdf) | Repository manuscript export. Export date is not established by this index |
| [PDF text conversion](capstone-documentation.md) | Identifies itself as converted from PDF. Preserved as extracted evidence |
| [Chapter 1–3 extract](parts/A_ch1-3.md) | Part A of the earlier manuscript review |
| [Requirements extract](parts/B_requirements.md) | Part B of the earlier manuscript review |
| [Tabs 3–8 extract](parts/C_tabs3-8.md) | Part C of the earlier manuscript review |
| [Inputs, outputs, flowcharts and tables](parts/D_io-flowcharts-tables.md) | Part D of the earlier manuscript review |
| [User-guide extract](parts/E_user-guide.md) | Part E. Contains historical labels and instructions |
| [Capstone text snapshot](capstone-current.txt) | Local text export. Source export time and source revision are not independently established |
| [Later check export](live_check.txt) | Separate text export retained with the applied-change records |

The former root capstone-current.txt and the copy here had identical SHA-256 C1F0C186A458D8F4253BDFDB4BF41E09000CE6494141C4D76A1858663B5D4CC6. The root duplicate was removed after comparison. This copy is the canonical retained artifact. File modification times alone do not prove a manuscript revision or export date.

## Review and application records

| File | What it establishes |
|---|---|
| [Merged fix list](DOC_FIXES.md) | Original proposals for parts A–E. Each section has its own findings and verification limits |
| [Codex review](CODEX_REVIEW.md) | 25 later proposed corrections using part-letter/row references from DOC_FIXES |
| [Codex application attempt](CODEX_APPLIED.md) | All 25 edits were reported skipped due to blocked browser access. Zero edits applied in that attempt |
| [Gemini application report](GEMINI_APPLIED.md) | Reports all 25 edits applied and checked via text export. This is a reported outcome, not a fresh verification of the live document |
| [Format assessment](FORMAT_CHECK.md) | Separate layout and publication-readiness findings. Not closed by the content-edit report |

The local notes have 11 November filesystem timestamps. Their contents are preserved. Exact execution times and source-document revisions remain unknown where not recorded.

## Reconciliation

CODEX_REVIEW identifiers 1–25 match the application tables in CODEX_APPLIED and GEMINI_APPLIED. The skipped attempt is superseded as an application outcome by the later reported application, while remaining valid evidence of what happened in its own run. It must not be described as an applied-edit record.

DOC_FIXES has five embedded sections for parts A–E. The previously referenced reports/A-E.md files are absent, so the embedded sections are the retained finding lists. Later notes refer to part letter and row number. Original findings remain historical proposals unless a specific later entry supplies an outcome.

FORMAT_CHECK assesses document structure, tables, captions, figures, and author details separately from those 25 content changes. Its publication-readiness verdict remains a historical assessment requiring review against the current source document.

## Remaining manuscript work

- Reconcile the manuscript's circulation Reset instructions with Start over, Back, confirmation, and New checkout/New return.
- Describe continuous attendance scanning and persistent last-result feedback.
- Reflect individual student management after selection and batch reactivation were removed.
- Check outstanding format findings in the authoring document, including figures, tables, captions, and title-page information.
- Record the source document revision and export time for the next manuscript review.

Original manuscript text and academic claims were retained. Repository documentation cleanup does not establish that edits were applied to a connected Google Doc or the PDF.
