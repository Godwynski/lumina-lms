"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";
import { ArrowDown, ArrowUp, Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestReport } from "@/lib/actions/reports";
import { cn } from "@/lib/utils";
import {
  createReportSection, REPORT_DATASETS, REPORT_GROUPS, REPORT_SECTION_LIMIT, reportConfigSchema, reportCsv,
  type ReportConfig, type ReportDataset, type ReportOutput, type ReportResult, type ReportSection,
} from "@/lib/report-builder";
import { ReportPreview } from "./ReportPreview";

const formats = { pdf: "PDF", excel: "Excel", csv: "CSV" } as const;
const selectClass = "min-h-10 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const initialTitle = "Library activity report";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid min-w-0 gap-1.5 text-sm font-medium">{label}{children}</label>;
}

function Dates({ dates, change }: {
  dates: Pick<ReportConfig, "from" | "to">;
  change: (dates: Pick<ReportConfig, "from" | "to">) => void;
}) {
  return <>
    <Field label="From"><Input type="date" value={dates.from} onChange={event => change({ ...dates, from: event.target.value })} /></Field>
    <Field label="To"><Input type="date" value={dates.to} onChange={event => change({ ...dates, to: event.target.value })} /></Field>
  </>;
}

function sectionName(section: ReportSection) {
  return (REPORT_DATASETS[section.dataset].metrics as Record<string, string>)[section.metric];
}

type SavedTemplate = { name: string; config: ReportConfig };

function readTemplates(key: string): SavedTemplate[] {
  const raw = localStorage.getItem(key);
  try {
    const saved: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(saved)) return [];
    return saved.flatMap(value => {
      const named = value && typeof value === "object" && "config" in value;
      const parsed = reportConfigSchema.safeParse(named ? value.config : value);
      if (!parsed.success) return [];
      const name = named && typeof value.name === "string" ? value.name.trim() : parsed.data.title;
      return name && name.length <= 100 ? [{ name, config: parsed.data }] : [];
    });
  } catch {
    return [];
  }
}

function SectionSettings({ section, datasets, dates, change }: {
  section: ReportSection;
  datasets: ReportDataset[];
  dates: Pick<ReportConfig, "from" | "to">;
  change: (section: ReportSection) => void;
}) {
  const definition = REPORT_DATASETS[section.dataset];
  const snapshot = section.dataset === "inventory";
  const groups = snapshot ? ["category", "location"] as const : ["day", "week", "month", "year"] as const;
  const displays = snapshot ? ["bar", "table"] as const : ["line", "bar", "table"] as const;
  return (
    <div className="space-y-4">
      <Field label="Dataset">
        <select className={selectClass} value={section.dataset} onChange={event => change(createReportSection(event.target.value as ReportDataset, section.id))}>
          {datasets.map(dataset => <option key={dataset} value={dataset}>{REPORT_DATASETS[dataset].label}</option>)}
        </select>
      </Field>
      <Field label="Metric">
        <select className={selectClass} value={section.metric} onChange={event => {
          const metric = event.target.value as ReportSection["metric"];
          change({ ...section, metric, display: metric === "records" ? "table" : section.display });
        }}>
          {Object.entries(definition.metrics).map(([key, text]) => <option key={key} value={key}>{text}</option>)}
        </select>
      </Field>
      {section.metric !== "records" && <>
        <Field label="Group by">
          <select className={selectClass} value={section.group} onChange={event => change({ ...section, group: event.target.value as ReportSection["group"] })}>
            {groups.map(group => <option key={group} value={group}>{REPORT_GROUPS[group]}</option>)}
          </select>
        </Field>
        <Field label="Display">
          <select className={selectClass} value={section.display} onChange={event => change({ ...section, display: event.target.value as ReportSection["display"] })}>
            {displays.map(display => <option key={display} value={display}>{{ line: "Line chart", bar: "Bar chart", table: "Table" }[display]}</option>)}
          </select>
        </Field>
        {section.metric === "visitors" && <p className="text-xs text-muted-foreground">Each visitor is counted once per group.</p>}
      </>}
      <Field label="Status">
        <select className={selectClass} value={section.filter} onChange={event => change({ ...section, filter: event.target.value })}>
          {Object.entries(definition.filters).map(([key, text]) => <option key={key} value={key}>{text}</option>)}
        </select>
      </Field>
      <Field label="Search">
        <Input type="search" maxLength={120} placeholder={definition.search} value={section.search} onChange={event => change({ ...section, search: event.target.value })} />
      </Field>
      {snapshot ? <p className="text-xs text-muted-foreground">This section shows current stock.</p> : (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={!section.dates} onChange={event => change({ ...section, dates: event.target.checked ? null : dates })} />
            Use report date range
          </label>
          {section.dates && <fieldset className="space-y-2 border-t pt-2">
            <legend className="text-xs font-medium">Section dates</legend>
            <Dates dates={section.dates} change={dates => change({ ...section, dates })} />
          </fieldset>}
        </>
      )}
      {section.metric === "records" && (
        <fieldset className="space-y-2 border-t pt-2">
          <legend className="text-xs font-medium">Table columns</legend>
          {Object.entries(definition.columns).map(([key, label]) => {
            const checked = section.columns.includes(key);
            return <label key={key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={checked} disabled={checked && section.columns.length === 1}
                onChange={() => change({ ...section, columns: checked ? section.columns.filter(column => column !== key) : [...section.columns, key] })} />
              {label}
            </label>;
          })}
        </fieldset>
      )}
    </div>
  );
}

export function ReportBuilder({ datasets, accountId, initialDates }: {
  datasets: ReportDataset[];
  accountId: string;
  initialDates: Pick<ReportConfig, "from" | "to">;
}) {
  const [config, setConfig] = useState<ReportConfig>(() => ({
    ...initialDates, title: initialTitle, sections: [createReportSection(datasets[0], "initial")],
  }));
  const [activeId, setActiveId] = useState("initial");
  const [format, setFormat] = useState<ReportOutput>("pdf");
  const [preview, setPreview] = useState<{ key: string; report?: ReportResult; error?: string }>();
  const [retry, setRetry] = useState(0);
  const [printReport, setPrintReport] = useState<ReportResult>();
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{ error?: boolean; text: string }>();
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [selectedTemplateName, setSelectedTemplateName] = useState("");
  const [templateAction, setTemplateAction] = useState<"rename" | "remove" | null>(null);
  const [templateNameDraft, setTemplateNameDraft] = useState("");
  const storageKey = `lumina-report-templates:${accountId}`;
  const availableTemplates = templates.filter(template => template.config.sections.every(section => datasets.includes(section.dataset)));
  const selectedTemplate = availableTemplates.find(template => template.name === selectedTemplateName);
  const activeIndex = config.sections.findIndex(section => section.id === activeId);
  const active = config.sections[activeIndex];
  const valid = reportConfigSchema.safeParse(config).success;
  const exportConfig = format === "csv" ? { ...config, sections: [active] } : config;
  const previewValid = format === "csv" ? reportConfigSchema.safeParse(exportConfig).success : valid;
  const previewKey = JSON.stringify({
    ...exportConfig, title: initialTitle,
    sections: exportConfig.sections.map(section => ({ ...section, display: "table" })).sort((a, b) => a.id.localeCompare(b.id)),
  });
  const currentPreview = preview?.key === previewKey ? preview : undefined;
  const previewReport = currentPreview?.report;
  const shownReport = previewValid && previewReport ? {
    title: config.title,
    sections: exportConfig.sections.map(section => ({
      ...previewReport.sections.find(item => item.id === section.id)!,
      display: section.display,
    })),
  } : undefined;

  useEffect(() => {
    try {
      setTemplates(readTemplates(storageKey));
    } catch {
      setTemplates([]);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!previewValid) return;
    let activeRequest = true;
    const timer = setTimeout(async () => {
      try {
        const response = await requestReport(JSON.parse(previewKey));
        if (activeRequest) setPreview(response.success
          ? { key: previewKey, report: response.report }
          : { key: previewKey, error: response.error });
      } catch {
        if (activeRequest) setPreview({ key: previewKey, error: "Could not load the preview. Try again." });
      }
    }, 300);
    return () => {
      activeRequest = false;
      clearTimeout(timer);
    };
  }, [previewKey, previewValid, retry]);

  function moveSection(direction: -1 | 1) {
    const nextIndex = activeIndex + direction;
    if (nextIndex < 0 || nextIndex >= config.sections.length) return;
    const sections = config.sections.slice();
    sections.splice(activeIndex, 1);
    sections.splice(nextIndex, 0, active);
    setConfig({ ...config, sections });
  }

  function updateTemplates(update: (saved: SavedTemplate[]) => SavedTemplate[] | string, successMessage: string) {
    try {
      const next = update(readTemplates(storageKey));
      if (typeof next === "string") {
        setMessage({ error: true, text: next });
        return false;
      }
      localStorage.setItem(storageKey, JSON.stringify(next));
      setTemplates(next);
      setMessage({ text: successMessage });
      return true;
    } catch {
      setMessage({ error: true, text: "This browser could not update saved templates." });
      return false;
    }
  }

  function saveTemplate() {
    const normalized = reportConfigSchema.parse(config);
    const name = selectedTemplate?.name ?? normalized.title;
    if (updateTemplates(saved => [{ name, config: normalized }, ...saved.filter(template => template.name !== name)].slice(0, 10),
      "Template saved in this browser.")) {
      setSelectedTemplateName(name);
      setTemplateAction(null);
    }
  }

  function renameTemplate() {
    if (!selectedTemplate) return;
    const name = templateNameDraft.trim();
    if (updateTemplates(saved => {
      if (!name || name.length > 100) return "Enter a template name of up to 100 characters.";
      if (saved.some(template => template.name !== selectedTemplate.name && template.name.toLowerCase() === name.toLowerCase())) {
        return "A template already uses that name.";
      }
      if (!saved.some(template => template.name === selectedTemplate.name)) return "This template was removed in another tab.";
      return saved.map(template => template.name === selectedTemplate.name ? { ...template, name } : template);
    }, "Template renamed.")) {
      setSelectedTemplateName(name);
      setTemplateAction(null);
    }
  }

  function removeTemplate() {
    if (selectedTemplate && updateTemplates(saved => saved.filter(template => template.name !== selectedTemplate.name), "Template removed.")) {
      setSelectedTemplateName("");
      setTemplateAction(null);
    }
  }

  function cancelTemplateAction() {
    setTemplateAction(null);
    setMessage(undefined);
  }

  async function exportReport() {
    setExporting(true);
    setMessage(undefined);
    try {
      const response = await requestReport(exportConfig, format);
      if (!response.success) throw new Error(response.error);
      const report = response.report;
      const filename = report.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "library-report";
      if (format === "pdf") {
        const previousTitle = document.title;
        document.title = report.title;
        try {
          flushSync(() => setPrintReport(report));
          window.print();
        } finally {
          document.title = previousTitle;
          setPrintReport(undefined);
        }
      } else if (format === "excel") {
        const [xlsx, { buildReportWorkbook }] = await Promise.all([import("xlsx"), import("@/lib/report-workbook")]);
        xlsx.writeFile(buildReportWorkbook(xlsx, report), filename + ".xlsx");
      } else {
        const url = URL.createObjectURL(new Blob(["\uFEFF", reportCsv(report.sections[0])], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = filename + ".csv";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1_000);
      }
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : "Could not export the report." });
    } finally {
      setExporting(false);
    }
  }

  return <>
    <div className="space-y-5 print:hidden">
      <div className="app-toolbar app-toolbar-row items-end justify-between">
        <div className="min-w-0 flex-1 basis-52 sm:max-w-lg">
          <Field label="Report title"><Input className="app-toolbar-control h-11" maxLength={100} value={config.title} onChange={event => setConfig({ ...config, title: event.target.value })} /></Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="app-toolbar-control h-11" onClick={saveTemplate} disabled={!valid || exporting || !!templateAction}>
            {selectedTemplate ? "Update template" : "Save template"}
          </Button>
          <Button type="button" className="app-toolbar-control h-11" onClick={() => void exportReport()} disabled={!shownReport || exporting}>
            <Download aria-hidden="true" /> {exporting ? "Preparing report…" : format === "pdf" ? "Print / Save PDF" : `Download ${formats[format]}`}
          </Button>
        </div>
      </div>
      <div className="grid max-w-sm grid-cols-2 gap-3">
        <Dates dates={{ from: config.from, to: config.to }} change={dates => setConfig({ ...config, ...dates })} />
      </div>
      {message && <p role={message.error ? "alert" : "status"} className={message.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{message.text}</p>}
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(9rem,0.8fr)_minmax(12rem,1fr)_minmax(0,2.45fr)]">
        <section aria-label="Report sections" className="min-w-0 space-y-3 rounded-xl border bg-card p-3.5">
          <h2 className="text-sm font-semibold">Report sections</h2>
          {!!availableTemplates.length && (
            <Field label="Saved templates">
              <select className={selectClass} value={selectedTemplate?.name ?? ""} onChange={event => {
                setSelectedTemplateName(event.target.value);
                setTemplateAction(null);
                setMessage(undefined);
                const template = availableTemplates.find(item => item.name === event.target.value);
                if (template) {
                  setConfig(template.config);
                  setActiveId(template.config.sections[0].id);
                }
              }}>
                <option value="">Choose a template</option>
                {availableTemplates.map(template => <option key={template.name} value={template.name}>{template.name}</option>)}
              </select>
            </Field>
          )}
          {selectedTemplate && (templateAction === "rename" ? (
            <form className="space-y-2" onSubmit={event => { event.preventDefault(); renameTemplate(); }}>
              <Input aria-label="Template name" maxLength={100} required value={templateNameDraft} onChange={event => setTemplateNameDraft(event.target.value)} />
              <div className="flex flex-wrap gap-1">
                <Button type="submit" size="sm">Save name</Button>
                <Button type="button" variant="ghost" size="sm" onClick={cancelTemplateAction}>Cancel</Button>
              </div>
            </form>
          ) : templateAction === "remove" ? (
            <div className="space-y-2">
              <p className="break-words text-xs text-muted-foreground">Remove “{selectedTemplate.name}” from saved templates? Your open report will stay here.</p>
              <div className="flex flex-wrap gap-1">
                <Button type="button" variant="destructive" size="sm" onClick={removeTemplate}>Remove template</Button>
                <Button type="button" variant="ghost" size="sm" onClick={cancelTemplateAction}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => {
                setMessage(undefined);
                setTemplateNameDraft(selectedTemplate.name);
                setTemplateAction("rename");
              }}>Rename</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => {
                setMessage(undefined);
                setTemplateAction("remove");
              }}>Remove</Button>
            </div>
          ))}
          <ol className="space-y-1.5">
            {config.sections.map(section => (
              <li key={section.id}>
                <button type="button" aria-pressed={section.id === activeId} onClick={() => setActiveId(section.id)}
                  className={cn("w-full break-words rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted", section.id === activeId && "bg-muted font-semibold")}>
                  {sectionName(section)}
                </button>
              </li>
            ))}
          </ol>
          <div className="flex justify-between gap-1" aria-label="Arrange selected section" role="group">
            <Button type="button" variant="ghost" size="icon" aria-label="Move section up" disabled={activeIndex === 0} onClick={() => moveSection(-1)}><ArrowUp aria-hidden="true" /></Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Move section down" disabled={activeIndex === config.sections.length - 1} onClick={() => moveSection(1)}><ArrowDown aria-hidden="true" /></Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Remove section" disabled={config.sections.length < 2} onClick={() => {
              const sections = config.sections.filter(section => section.id !== activeId);
              setActiveId(sections[Math.max(0, activeIndex - 1)].id);
              setConfig({ ...config, sections });
            }}><Trash2 aria-hidden="true" /></Button>
          </div>
          <Button variant="outline" type="button" className="w-full justify-start" disabled={config.sections.length >= REPORT_SECTION_LIMIT} onClick={() => {
            const section = createReportSection(active.dataset, crypto.randomUUID());
            setConfig({ ...config, sections: [...config.sections, section] });
            setActiveId(section.id);
          }}><Plus aria-hidden="true" /> Add section</Button>
        </section>
        <section className="min-w-0 space-y-3 rounded-xl border bg-card p-3.5">
          <h2 className="text-sm font-semibold">Section settings</h2>
          <SectionSettings section={active} datasets={datasets} dates={{ from: config.from, to: config.to }} change={section =>
            setConfig({ ...config, sections: config.sections.map(item => item.id === section.id ? section : item) })} />
        </section>
        <section id="report-preview" className="min-w-0 space-y-3 rounded-xl border bg-muted/30 p-3.5 md:col-span-2 xl:col-span-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Live preview</h2>
            <div className="inline-flex gap-1 rounded-lg border bg-background p-1" role="group" aria-label="Export format">
              {(Object.keys(formats) as ReportOutput[]).map(value => (
                <button key={value} type="button" aria-pressed={format === value} onClick={() => setFormat(value)}
                  className={cn("rounded-md px-2.5 py-1.5 text-xs font-medium", value === format ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                  {formats[value]}
                </button>
              ))}
            </div>
          </div>
          {format === "csv" && <p className="text-xs text-muted-foreground">CSV includes the selected section only.</p>}
          <div className="min-h-52 min-w-0 rounded-lg border bg-card p-3.5" aria-busy={previewValid && !currentPreview}>
            {!previewValid ? <p role="alert" className="text-sm text-destructive">Enter a title and ordered dates spanning up to five years.</p>
              : currentPreview?.error ? <div className="space-y-2">
                <p role="alert" className="text-sm text-destructive">{currentPreview.error}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => { setPreview(undefined); setRetry(retry + 1); }}>Retry preview</Button>
              </div>
              : shownReport ? <ReportPreview format={format} report={shownReport} />
              : <p role="status" className="text-sm text-muted-foreground">Updating preview…</p>}
          </div>
        </section>
      </div>
    </div>
    {printReport && createPortal(
      <div id="report-print" className="hidden print:block"><ReportPreview report={printReport} format="pdf" sample={false} /></div>,
      document.body,
    )}
  </>;
}
