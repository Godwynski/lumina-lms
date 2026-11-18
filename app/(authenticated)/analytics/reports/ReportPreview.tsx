import { REPORT_PREVIEW_ROWS, type ReportOutput, type ReportResult, type ReportResultSection } from "@/lib/report-builder";

function ReportChart({ section }: { section: ReportResultSection }) {
  const left = 48;
  const top = 16;
  const width = 520;
  const height = 160;
  const maximum = Math.max(4, Math.ceil(Math.max(...section.rows.map(row => Number(row[1]))) / 4) * 4);
  const spacing = width / section.rows.length;
  const points = section.rows.map(([label, value], index) => ({
    label: String(label), value: Number(value),
    x: left + spacing * (index + 0.5),
    y: top + height * (1 - Number(value) / maximum),
  }));
  const labelsEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <svg role="img" aria-label={section.title} viewBox="0 0 590 218" className="w-full max-w-4xl overflow-visible text-primary print:text-[#1f3658]">
      {[0, 1, 2, 3, 4].map(tick => {
        const y = top + height * (1 - tick / 4);
        return <g key={tick}>
          <line x1={left} x2={left + width} y1={y} y2={y} className="stroke-border print:stroke-gray-300" />
          <text x={left - 8} y={y + 4} textAnchor="end" className="fill-muted-foreground text-[11px] print:fill-gray-700">{maximum * tick / 4}</text>
        </g>;
      })}
      {section.display === "line" && (
        <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points.map(({ x, y }) => `${x},${y}`).join(" ")} />
      )}
      {points.map(({ label, value, x, y }, index) => {
        const barWidth = Math.min(36, spacing * 0.66);
        return <g key={label}>
          <title>{label} · {value.toLocaleString()}</title>
          {section.display === "bar"
            ? <rect x={x - barWidth / 2} y={y} width={barWidth} height={top + height - y} rx="1" fill="currentColor" />
            : points.length <= 48 && <circle cx={x} cy={y} r="3" fill="currentColor" />}
          {index % labelsEvery === 0 && (
            <text x={x} y={top + height + 20} textAnchor="middle" className="fill-muted-foreground text-[10px] print:fill-gray-700">
              {label.length > 13 ? label.slice(0, 12) + "…" : label}
            </text>
          )}
        </g>;
      })}
    </svg>
  );
}

export function ReportPreview({ report, format, sample = true }: { report: ReportResult; format: ReportOutput; sample?: boolean }) {
  return (
    <div className="min-w-0 space-y-5 bg-card print:bg-white print:text-black">
      {format === "pdf" && <h2 className="border-b pb-3 text-xl font-semibold tracking-tight">{report.title}</h2>}
      {report.sections.map(section => {
        const chart = format === "pdf" && section.display !== "table";
        const rows = sample && !chart ? section.rows.slice(0, REPORT_PREVIEW_ROWS) : section.rows;
        return (
        <section key={section.id} className="min-w-0 space-y-2">
          <div className="print:break-after-avoid">
            <h3 className="text-sm font-semibold">{section.title}</h3>
            <p className="break-words text-xs text-muted-foreground print:text-gray-700">{section.scope}</p>
          </div>
          {!section.rows.length ? (
            <p className="py-3 text-sm text-muted-foreground">No rows match these filters.</p>
          ) : chart ? (
            <div className="print:break-inside-avoid"><ReportChart section={section} /></div>
          ) : (
            <div className="overflow-x-auto rounded-lg border print:overflow-visible print:rounded-none">
              <table aria-label={section.title} className="w-full border-collapse text-left text-xs tabular-nums">
                <thead className="bg-muted/65 print:table-header-group">
                  <tr>{section.headers.map(header => <th key={header} scope="col" className="px-3 py-2 font-semibold print:px-1.5">{header}</th>)}</tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row, index) => (
                    <tr key={index} className="print:break-inside-avoid">
                      {row.map((cell, col) => <td key={col} className="px-3 py-2 print:break-words print:px-1.5">{cell ?? "—"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows.length < section.rowCount && (
            <p className="text-xs text-muted-foreground">Showing {rows.length.toLocaleString()} of {section.rowCount.toLocaleString()} rows. The export includes all matching rows.</p>
          )}
        </section>
        );
      })}
    </div>
  );
}
