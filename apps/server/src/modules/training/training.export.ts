import ExcelJS from "exceljs";
import { TRAINING_TRACKS, type TrainingTeamRow } from "@skerp/types";

const fmtDate = (iso: string | null): string =>
  iso
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(iso))
    : "";

/** A5 — team training progress as one sheet, one row per person. */
export async function buildTeamXlsx(
  rows: TrainingTeamRow[],
  generatedAt: Date,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SK ERP";
  wb.created = generatedAt;
  const sheet = wb.addWorksheet("Training progress");

  sheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Email", key: "email", width: 28 },
    { header: "Role", key: "role", width: 18 },
    { header: "Branch", key: "branch", width: 16 },
    { header: "Required steps done", key: "done", width: 12 },
    { header: "Required steps total", key: "total", width: 12 },
    { header: "Progress %", key: "percent", width: 11 },
    { header: "Last activity", key: "last", width: 14 },
    ...TRAINING_TRACKS.map((track) => ({
      header: track.title,
      key: track.key,
      width: 22,
    })),
  ];

  for (const row of rows) {
    const byTrack = new Map(row.tracks.map((track) => [track.key, track]));
    sheet.addRow({
      name: row.name,
      email: row.email,
      role: row.roleName,
      branch: row.branchName ?? "",
      done: row.required.finished,
      total: row.required.total,
      percent:
        row.required.total === 0
          ? 0
          : Math.round((row.required.finished / row.required.total) * 100),
      last: fmtDate(row.lastActivity),
      ...Object.fromEntries(
        TRAINING_TRACKS.map((track) => {
          const t = byTrack.get(track.key);
          return [
            track.key,
            t ? `${t.finished} / ${t.total}${t.assignment === "required" ? " (required)" : ""}` : "",
          ];
        }),
      ),
    });
  }

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0ECE4" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columns.length },
  };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
