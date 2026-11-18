import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMockSupabaseClient } from "./mocks/supabase";
import { cleanupClients, clickElement, renderClient, submitForm, typeIntoInput } from "./helpers/render";
import { ReportBuilder } from "@/app/(authenticated)/analytics/reports/ReportBuilder";
import { createReportSection } from "@/lib/report-builder";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("next/server", () => ({ after: (callback: () => unknown) => callback() }));

const range = { from: "2026-11-01", to: "2026-11-30" };
const print = vi.fn();
let db: ReturnType<typeof createMockSupabaseClient>;

function findButtonByText(container: HTMLElement, label: string) {
  return [...container.querySelectorAll("button")].find(button => button.textContent?.trim() === label);
}

async function choose(container: HTMLElement, label: string, value: string) {
  const select = [...container.querySelectorAll("select")].find(field => field.labels?.[0]?.firstChild?.textContent?.trim() === label);
  if (!select) throw new Error(`Missing select: ${label}`);
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function refreshPreview() {
  await act(async () => { await vi.advanceTimersByTimeAsync(350); });
}

beforeEach(() => {
  vi.useFakeTimers();
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  print.mockReset();
  vi.stubGlobal("print", print);
  db = createMockSupabaseClient();
  db.auth.getUser.mockResolvedValue({ data: { user: { id: "staff" } } });
  db.setTableResponse("profiles", { id: "staff", role: "librarian", status: "ACTIVE" });
  db.setTableResponse("attendance", [{ id: "1", check_in_at: "2026-11-01T02:00:00Z", check_out_at: null }]);
  db.setTableResponse("books", [{ id: "1", title: "Botany", is_active: true, total_copies: 4 }]);
  vi.mocked(createClient).mockResolvedValue(db.client as never);
  vi.mocked(createAdminClient).mockReturnValue(createMockSupabaseClient().client as never);
});

afterEach(() => {
  cleanupClients();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Analytics Report Builder", () => {
  it("switches a chart to a table, adds and reorders a catalog section, and prints the full report", async () => {
    const { container } = await renderClient(<ReportBuilder datasets={["attendance", "inventory"]} accountId="staff" initialDates={range} />);
    expect(container.querySelector("h1")).toBeNull();
    await refreshPreview();
    expect(container.querySelector('svg[role="img"]')).not.toBeNull();
    await choose(container, "Display", "table");
    await refreshPreview();
    expect(container.querySelector("table")?.textContent).toContain("2026-11");
    await clickElement(findButtonByText(container, "Add section"));
    await choose(container, "Dataset", "inventory");
    await choose(container, "Metric", "records");
    await refreshPreview();
    expect(container.textContent).toContain("Botany");
    expect(container.textContent).toContain("Stock as of");
    await clickElement(container.querySelector('button[aria-label="Move section up"]'));
    await refreshPreview();
    expect([...container.querySelectorAll("#report-preview h3")].map(node => node.textContent)).toEqual(["Book list", "Check-ins by month"]);
    print.mockImplementation(() => {
      expect(document.querySelector("#report-print")?.textContent).toContain("Botany");
    });
    await clickElement(findButtonByText(container, "Print / Save PDF"));
    expect(print).toHaveBeenCalledOnce();
  });

  it("exposes only allowed datasets and restores a template for the same account", async () => {
    const { container, unmount } = await renderClient(<ReportBuilder datasets={["attendance"]} accountId="staff" initialDates={range} />);
    expect([...container.querySelectorAll("select")].find(select => select.value === "attendance")?.options).toHaveLength(1);
    await choose(container, "Metric", "visitors");
    await clickElement(findButtonByText(container, "Save template"));
    unmount();
    const second = await renderClient(<ReportBuilder datasets={["attendance"]} accountId="staff" initialDates={range} />);
    await choose(second.container, "Saved templates", "Library activity report");
    await refreshPreview();
    expect(second.container.querySelector("#report-preview")?.textContent).toContain("Distinct visitors by month");
  });

  it("previews and enables CSV for the selected section even if another dataset fails", async () => {
    const { container } = await renderClient(<ReportBuilder datasets={["attendance", "inventory"]} accountId="staff" initialDates={range} />);
    db.setTableResponse("books", null, { message: "Busy" });
    await clickElement(findButtonByText(container, "Add section"));
    await choose(container, "Dataset", "inventory");
    await refreshPreview();
    expect(container.querySelector("#report-preview")).toHaveTextContent("Could not load Books & Inventory");
    await clickElement(findButtonByText(container, "Check-ins"));
    await clickElement(findButtonByText(container, "CSV"));
    await refreshPreview();
    expect(container.querySelector("#report-preview table")).toHaveTextContent("2026-11");
    expect(findButtonByText(container, "Download CSV")).toBeEnabled();
  });

  it("renames legacy templates without changing the report title and removes only the selected template after confirmation", async () => {
    localStorage.setItem("lumina-report-templates:staff", JSON.stringify([
      { ...range, title: "Monthly activity", sections: [createReportSection("attendance", "monthly")] },
      { ...range, title: "Weekly activity", sections: [createReportSection("attendance", "weekly")] },
    ]));
    const { container, unmount } = await renderClient(<ReportBuilder datasets={["attendance"]} accountId="staff" initialDates={range} />);
    await choose(container, "Saved templates", "Monthly activity");
    await clickElement(findButtonByText(container, "Rename"));
    const name = container.querySelector<HTMLInputElement>('input[aria-label="Template name"]');
    await typeIntoInput(name, "  WEEKLY ACTIVITY  ");
    await submitForm(name?.form);
    expect(container.querySelector('[role="alert"]')).toHaveTextContent("already uses that name");
    await typeIntoInput(name, "Library monthly");
    await submitForm(name?.form);
    expect(container.querySelector('option[value="Library monthly"]')).toBeInTheDocument();
    expect(container.querySelector('option[value="Monthly activity"]')).toBeNull();
    expect([...container.querySelectorAll("input")].find(input => input.value === "Monthly activity")).toBeInTheDocument();
    unmount();

    const reload = await renderClient(<ReportBuilder datasets={["attendance"]} accountId="staff" initialDates={range} />);
    await choose(reload.container, "Saved templates", "Library monthly");
    await clickElement(findButtonByText(reload.container, "Remove"));
    await clickElement(findButtonByText(reload.container, "Cancel"));
    expect(reload.container.querySelector('option[value="Library monthly"]')).toBeInTheDocument();
    await clickElement(findButtonByText(reload.container, "Remove"));
    await clickElement(findButtonByText(reload.container, "Remove template"));
    expect(reload.container.querySelector('option[value="Library monthly"]')).toBeNull();
    expect(reload.container.querySelector('option[value="Weekly activity"]')).toBeInTheDocument();
    expect([...reload.container.querySelectorAll("input")].find(input => input.value === "Monthly activity")).toBeInTheDocument();
    reload.unmount();

    const afterRemoval = await renderClient(<ReportBuilder datasets={["attendance"]} accountId="staff" initialDates={range} />);
    expect(afterRemoval.container.querySelector('option[value="Library monthly"]')).toBeNull();
    expect(afterRemoval.container.querySelector('option[value="Weekly activity"]')).toBeInTheDocument();
    afterRemoval.unmount();

    const otherAccount = await renderClient(<ReportBuilder datasets={["attendance"]} accountId="other" initialDates={range} />);
    expect(otherAccount.container.querySelector('option[value="Weekly activity"]')).toBeNull();
  });
});
