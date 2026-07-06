import { google, sheets_v4 } from "googleapis";

let sheetsInstance: sheets_v4.Sheets | null = null;

function getSpreadsheetId(): string {
  const id = process.env.SPREADSHEET_ID;
  if (!id) throw new Error("SPREADSHEET_ID not set");
  return id;
}

export function getSheets(): sheets_v4.Sheets {
  if (sheetsInstance) return sheetsInstance;

  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set");

  const key = JSON.parse(keyJson);
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsInstance = google.sheets({ version: "v4", auth });
  return sheetsInstance;
}

// Fixed row id for the head coach / team director-editable default practice
// template. Its groups get cloned into every newly created practice.
export const TEMPLATE_SESSION_ID = "default-template";

const REQUIRED_SHEETS: Record<string, string[]> = {
  coaches: ["id", "name", "email", "pin", "role", "phone", "emergency_contact"],
  students: ["id", "name", "grade", "emergency_contact", "phone", "active"],
  sessions: ["id", "date", "name", "location", "status", "created_by", "created_at"],
  session_groups: ["id", "session_id", "name", "coach_id", "notes"],
  group_assignments: ["id", "session_id", "group_id", "student_id"],
  attendance: [
    "id",
    "session_id",
    "group_id",
    "student_id",
    "status",
    "note",
    "marked_by",
    "marked_at",
  ],
};

export async function ensureSheets(): Promise<void> {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = (spreadsheet.data.sheets || []).map(
    (s) => s.properties?.title || ""
  );

  for (const [sheetName, headers] of Object.entries(REQUIRED_SHEETS)) {
    if (!existing.includes(sheetName)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: sheetName } } }],
        },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      });
      console.log(`Created sheet: ${sheetName}`);
    }
  }

  const sessions = await readSheet("sessions");
  if (!sessions.find((s) => s.id === TEMPLATE_SESSION_ID)) {
    await appendRow("sessions", {
      id: TEMPLATE_SESSION_ID,
      date: "",
      name: "Default Practice",
      location: "",
      status: "template",
      created_by: "",
      created_at: new Date().toISOString(),
    });
    console.log("Created default practice template.");
  }

  console.log("All required sheets verified.");
}

export async function readSheet(
  sheetName: string
): Promise<Record<string, string>[]> {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) return [];

  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] || "";
    });
    return obj;
  });
}

export async function appendRow(
  sheetName: string,
  row: Record<string, string>
): Promise<void> {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`,
  });

  const headers = res.data.values?.[0] || [];
  const values = headers.map((h: string) => row[h] || "");

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:A`,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });
}

export async function updateRowById(
  sheetName: string,
  id: string,
  updates: Record<string, string>
): Promise<boolean> {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) return false;

  const headers = rows[0];
  const idCol = headers.indexOf("id");
  if (idCol === -1) return false;

  const rowIndex = rows.findIndex((r, i) => i > 0 && r[idCol] === id);
  if (rowIndex === -1) return false;

  const updatedRow = [...rows[rowIndex]];
  for (const [key, value] of Object.entries(updates)) {
    const colIndex = headers.indexOf(key);
    if (colIndex !== -1) {
      while (updatedRow.length <= colIndex) updatedRow.push("");
      updatedRow[colIndex] = value;
    }
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A${rowIndex + 1}`,
    valueInputOption: "RAW",
    requestBody: { values: [updatedRow] },
  });

  return true;
}

export async function deleteRowById(
  sheetName: string,
  id: string
): Promise<boolean> {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetMeta = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === sheetName
  );
  if (!sheetMeta?.properties?.sheetId && sheetMeta?.properties?.sheetId !== 0)
    return false;
  const sheetId = sheetMeta.properties.sheetId;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) return false;

  const headers = rows[0];
  const idCol = headers.indexOf("id");
  if (idCol === -1) return false;

  const rowIndex = rows.findIndex((r, i) => i > 0 && r[idCol] === id);
  if (rowIndex === -1) return false;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });

  return true;
}

export async function upsertRow(
  sheetName: string,
  id: string,
  data: Record<string, string>
): Promise<void> {
  const updated = await updateRowById(sheetName, id, data);
  if (!updated) {
    await appendRow(sheetName, { ...data, id });
  }
}

export { getSpreadsheetId };
