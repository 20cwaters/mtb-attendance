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
    const coach = coaches.find((c) => c.id === group.coach_id);
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
      summary.total++;
      if (status === "present") summary.present++;
      else if (status === "absent") summary.absent++;
      else if (status === "late") summary.late++;
      else if (status === "left_early") summary.left_early++;
      else if (status === "injured") summary.injured++;

      return {
        name: student?.name || "Unknown",
        status,
        note: att?.note || "",
        marked_at: att?.marked_at || "",
      };
    });

    return {
      group,
      coachName: coach?.name || "Unassigned",
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

  const tabName = `Report - ${report.session.name} - ${report.session.date}`;

  const addSheetRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: tabName } } }],
    },
  });

  const sheetId =
    addSheetRes.data.replies?.[0]?.addSheet?.properties?.sheetId || 0;

  const rows: string[][] = [];
  rows.push([`Session: ${report.session.name}`, "", `Date: ${report.session.date}`]);
  rows.push([]);

  let currentRow = 2;
  const formatRequests: any[] = [];

  for (const groupData of report.groups) {
    rows.push([
      `Group: ${groupData.group.name}`,
      "",
      `Coach: ${groupData.coachName}`,
    ]);
    rows.push(["Student Name", "Status", "Note", "Marked At"]);
    currentRow += 2;

    for (const student of groupData.students) {
      rows.push([student.name, student.status, student.note, student.marked_at]);
      currentRow++;

      const color = STATUS_COLORS[student.status];
      if (color) {
        formatRequests.push({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: currentRow - 1,
              endRowIndex: currentRow,
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
    }

    rows.push([]);
    currentRow++;
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
