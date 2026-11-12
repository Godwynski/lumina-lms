# Documentation Cleanup Implementation Plan

> For agentic workers, use the executing-plans skill to implement the tasks in order. Check off steps as they are completed.

**Goal:** Make current Lumina documentation easy to find and consistent with the implemented system while preserving thesis sources and dated audit evidence.

**Architecture:** Keep README.md as the project entry point and docs/README.md as the documentation index. Maintain current guides separately from historical audit reports and manuscript snapshots. Validate behavioral claims against source code and supported commands.

**Tech stack:** Markdown, Next.js 16, React 19, TypeScript, Supabase, Vitest.

**Spec:** The user's November 12, 2026 request to plan documentation cleanup. Scope is repository documentation, including its relationship to the thesis manuscript.

## Constraints

- This file is a plan. Execute cleanup only when requested.
- Preserve the pending student-checkbox and batch-reactivation removal in UsersContent.tsx and lib/actions/users.ts.
- Existing untracked capstone extracts and audit notes are user work. Inspect and classify them before proposing incorporation or deletion.
- Preserve AGENTS.md's Next.js-generated rules.
- Keep PDF/manuscript sources and extracted snapshots intact unless the user specifically requests manuscript edits.
- Use the working implementation for current behavior. Clearly identify pending local changes as unpublished.
- Do not run seed, cleanup, reset, or maintenance commands to validate documentation.
- Do not claim a full test run or a compliance result based on targeted checks.
- No application, database, or deployment changes belong in this cleanup.

## Findings from the initial review

- docs/README.md links to DOCUMENTATION_SYSTEM_CROSSCHECK.md, which is absent from the inventory.
- README.md names Next.js 16.2.6, while package.json declares ^16.4.5. Resolve the installed version and choose a maintainable version notation.
- README.md repeats fixed test counts in badges, diagrams, prose, and the scripts table. These claims need dated evidence or removal.
- The root README is about 490 lines and mixes onboarding, product explanation, architecture, and operational details.
- docs/doc-audit/parts/E_user-guide.md still instructs users to select Reset. It is an extracted manuscript snapshot, so updating it alone would create ambiguity about the original source.
- The October 31 thesis alignment audit and DOC_FIXES.md describe historical discrepancies. They must not be presented as current findings without rechecking.
- capstone-current.txt exists both at the root and in docs/doc-audit/. Additional untracked files contain reviews, applied-change notes, format checks, and live-check output.
- Scanner changes are on development. Removal of student selection and batch reactivation is currently local and uncommitted.

## Task 1 — Establish document ownership and status

**Inspect:** README.md, docs/README.md, THESIS_VS_SYSTEM_ALIGNMENT_AUDIT.md, docs/doc-audit/, docs/requirement documentation.md, Capstone documentation.pdf, and the untracked audit/extract files.

- [x] Inventory tracked documents and local untracked artifacts, including dates, intended audience, provenance, and inbound references.
- [x] Compare the two capstone-current.txt files by hash and content. Determine which source and extraction date each represents.
- [x] Classify each document as a maintained guide, dated assessment, manuscript snapshot, or disposable generated output.
- [x] Record classification and source relationships concisely in docs/README.md. Keep source ownership explicit when Google Docs is authoritative.
- [x] Identify exact archival candidates. Preserve unique findings and source evidence before consolidating anything.

**Acceptance:** Every inventoried file has a known purpose. No user-owned extract or note is silently deleted or treated as authoritative.

## Task 2 — Repair navigation and simplify the project entry point

**Modify:** README.md and docs/README.md.
**Potential destination:** docs/archive/, only for historical authored reports selected in Task 1.

- [x] Fix the missing crosscheck link. Link to THESIS_VS_SYSTEM_ALIGNMENT_AUDIT.md with its October 31 date if that report is the intended reference.
- [x] Organize docs/README.md by current guides, requirements and thesis sources, and dated assessments.
- [x] Keep README.md focused on project purpose, prerequisites, setup, configuration, supported commands, and links.
- [x] Move lengthy maintained technical explanations only when a clear destination is needed. Update inbound links in the same change.
- [x] Label historical assessments with their evaluated date and revision when known. Preserve original findings and outcomes.
- [x] Resolve links to referenced reports/A-E.md in DOC_FIXES.md by checking whether the reports exist, are embedded, or were omitted.

**Acceptance:** Local links resolve. Readers can locate setup, current usage, requirements, and historical evidence from the two entry points.

## Task 3 — Correct current product and developer guidance

**Modify:** README.md, docs/accessibility.md, test/README.md, and docs/README.md where applicable.
**Create:** docs/user-guide.md as a concise current-system guide, linked from both entry points.
**Read:** package.json, package-lock.json, auth implementation, scanner and circulation components, attendance action/UI, user directory and individual-user actions.

- [x] Verify framework versions, Node/npm requirements, environment-variable names, and commands against the repository. Never copy secret values.
- [x] Replace repeated undated test-count claims with reproducible commands. Keep any historical count with its date and source.
- [x] Check performance and security assertions such as sub-second processing, real-time behavior, and role capabilities. Remove unsupported guarantees or state their measured scope.
- [x] Verify sign-in and demo-access instructions against current auth and demo configuration before rewriting them.
- [x] Document checkout scanning from student card to book copy, review details, Back, Start over, and New checkout/New return.
- [x] Document continuous gate attendance, last-result display, recorded time, same-card protection, Stop camera, permission recovery, and manual entry.
- [x] Describe individual student status management. Include batch-reactivation removal only once that change is accepted into the target revision.
- [x] Check current accessibility guidance against the November 11 assessment. Distinguish implemented behavior from outstanding findings and recommendations.
- [x] Retain original thesis extracts. Link their user-guide snapshot to the current guide and list manuscript sections needing a future update without rewriting academic text.

**Acceptance:** Current instructions match visible controls and supported entry points. Historical manuscript wording remains traceable. No unsupported test or compliance claim is introduced.

## Task 4 — Consolidate audit material and verify delivery

**Modify or archive:** Exact files selected in Task 1, plus their index links.

- [x] Reconcile DOC_FIXES.md, CODEX_REVIEW.md, CODEX_APPLIED.md, GEMINI_APPLIED.md, FORMAT_CHECK.md, and live_check.txt by finding ID, document section, and evidence.
- [x] Preserve distinctions between proposed edits, applied edits, and verified results. Mark superseded findings with the report that replaced them.
- [x] Archive dated authored reports where useful. Do not merge unrelated security, accessibility, database, and deployment conclusions into an undated status report.
- [x] Check all changed Markdown links, relative paths, anchors, and code fences.
- [x] Search maintained guides for obsolete scanner labels and batch-reactivation instructions. Exclude clearly labeled historical snapshots from current-behavior assertions.
- [x] Review git diff --check and inspect the complete diff for unintended application changes, secrets, discarded findings, or lost provenance.
- [x] Deliver a concise list of updated, archived, and retained files, plus unresolved manuscript/source questions.
- [x] Commit documentation-only paths when execution includes a commit request. Push only to the requested branch.

**Acceptance:** Current guidance is discoverable and accurate, all moved-file links work, original thesis evidence is retained, and pending application edits remain separate.

## Review priorities

1. An old audit marked “fixed” must not imply current verification.
2. Local untracked notes must not be lost in an archive or deletion sweep.
3. Manuscript requirements must not be silently rewritten to fit the code.
4. Setup instructions must not invoke destructive database operations as routine steps.
5. Current guide updates must identify the revision they describe, especially around pending user-management changes.

## Execution record — 12 November 2026

The user authorized cleanup and subsequently requested committing and synchronizing GitHub branches.

- Maintained setup, user, test, and accessibility guidance was updated.
- The earlier README was archived to preserve architecture and academic attribution.
- Original thesis PDF and extracts were preserved. Audit records received status notices and a provenance/reconciliation index.
- The two capstone-current exports were byte-identical. Only the root duplicate was removed.
- Historical reports remain at stable paths with scope notices, avoiding link churn.
- The student-directory removal is included in the requested commit. The user guide describes that combined change.
- Live Google Docs content, physical cameras, historical security conclusions, and format remediation were not reverified.
- Documentation checks validate local links, anchors, code fences, commands, and whitespace. They do not establish current full-suite or accessibility conformance.

All plan tasks are complete. The commit/push step is authorized by the user's subsequent branch synchronization request.

Verification completed before synchronization: 88 local links and fenced blocks passed, TypeScript passed, changed application files passed ESLint, and Vitest passed 52 files / 1,023 tests with nested worktrees excluded.

Original text exports retain source whitespace for byte-preserving provenance. Whitespace checks exclude capstone-current.txt and live_check.txt.
