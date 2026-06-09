import { getSheets, getSpreadsheetId, readSheet } from "./sheetsClient";

interface ReportData {
  session: Record<string, string>;
  groups: {
    group: Record<string, string>;
    coachName: string;
    students: {
      name: string;
      status: string;
      note: string;
      marked_at: string;
    }[];
  }[];
  summary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    left_early: number;
    injured: number;
  };
}

export async function getReportData(sessionId: string): Promise<ReportData> {
  const sessions = await readSheet("sessions");
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) throw new Error("Session not found");

  const groups = await readSheet("session_groups");
  const assignments = await readSheet("group_assignments");
  const attendance = await readSheet("attendance");
  const students = await readSheet("students");
  const coaches = await readSheet("coaches");

  const sessionGroups = groups.filter((g) => g.session_id === sessionId);
  const sessionAttendance = attendance.filter((a) => a.session_id === sessionId);

  const summary = {
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    left_early: 0,
    injured: 0,
  };

  const groupsData = sessionGroups.map((group) => {
    const coachIds = (group.coach_id || "").split(",").filter(Boolean);
    const coachNames = coachIds
      .map((cid: string) => coaches.find((c) => c.id === cid)?.name)
      .filter(Boolean)
      .join(", ");
    const groupAssignments = assignments.filter(
      (a) => a.session_id === sessionId && a.group_id === group.id
    );

    const studentRows = groupAssignments.map((assignment) => {
      const student = students.find((s) => s.id === assignment.student_id);
      const att = sessionAttendance.find(
        (a) =>
          a.group_id === group.id && a.student_id === assignment.student_id
      );

      const status = att?.status || "unmarked";
      const statuses = status.split(",").filter(Boolean);
      summary.total++;
      if (statuses.includes("present")) summary.present++;
      if (statuses.includes("absent")) summary.absent++;
      if (statuses.includes("late")) summary.late++;
      if (statuses.includes("left_early")) summary.left_early++;
      if (statuses.includes("injured")) summary.injured++;

      return {
        name: student?.name || "Unknown",
        status,
        note: att?.note || "",
        marked_at: att?.marked_at || "",
      };
    });

    return {
      group,
      coachName: coachNames || "Unassigned",
      students: studentRows,
    };
  });

  return { session, groups: groupsData, summary };
}

const STATUS_COLORS: Record<string, { red: number; green: number; blue: number }> = {
  present: { red: 0.85, green: 0.93, blue: 0.83 },
  absent: { red: 0.96, green: 0.8, blue: 0.8 },
  late: { red: 1, green: 0.95, blue: 0.8 },
  left_early: { red: 1, green: 0.87, blue: 0.73 },
  injured: { red: 1, green: 0.85, blue: 0.87 },
};

export async function exportReportToSheet(sessionId: string): Promise<string> {
  const report = await getReportData(sessionId);
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();

  let tabName = `Report - ${report.session.name} - ${report.session.date}`;

  // Check if tab already exists, append timestamp if so
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTabs = (spreadsheet.data.sheets || []).map(
    (s) => s.properties?.title || ""
  );
  if (existingTabs.includes(tabName)) {
    const timestamp = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    tabName = `${tabName} (${timestamp})`;
  }

  const addSheetRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: tabName } } }],
    },
  });

  const sheetId =
    addSheetRes.data.replies?.[0]?.addSheet?.properties?.sheetId || 0;

  const rows: string[][] = [];
  const formatRequests: any[] = [];

  // Row 0: Session header
  rows.push([`Session: ${report.session.name}`, "", `Date: ${report.session.date}`]);
  // Row 1: blank
  rows.push([]);

  let rowIndex = 2; // next row to write (0-indexed for Sheets API ranges)

  for (const groupData of report.groups) {
    // Group header row
    rows.push([
      `Group: ${groupData.group.name}`,
      "",
      `Coach: ${groupData.coachName}`,
    ]);
    rowIndex++;

    // Column headers row
    rows.push(["Student Name", "Status", "Note", "Marked At"]);
    rowIndex++;

    for (const student of groupData.students) {
      const displayStatus = student.status
        .split(",")
        .filter(Boolean)
        .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace("_", " "))
        .join(", ");
      rows.push([student.name, displayStatus, student.note, student.marked_at]);

      const primaryStatus = student.status.split(",")[0];
      const color = STATUS_COLORS[primaryStatus];
      if (color) {
        formatRequests.push({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: rowIndex,
              endRowIndex: rowIndex + 1,
              startColumnIndex: 1,
              endColumnIndex: 2,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: color,
              },
            },
            fields: "userEnteredFormat.backgroundColor",
          },
        });
      }
      rowIndex++;
    }

    // Blank row between groups
    rows.push([]);
    rowIndex++;
  }

  rows.push(["SUMMARY"]);
  rows.push([
    "Total Students",
    "Present",
    "Absent",
    "Late",
    "Left Early",
    "Injured",
  ]);
  rows.push([
    String(report.summary.total),
    String(report.summary.present),
    String(report.summary.absent),
    String(report.summary.late),
    String(report.summary.left_early),
    String(report.summary.injured),
  ]);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabName}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });

  if (formatRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: formatRequests },
    });
  }

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${sheetId}`;
}
