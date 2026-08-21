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
  session_groups: [
    "id",
    "session_id",
    "name",
    "coach_id",
    "notes",
    "coach_comment",
    "submitted_at",
    "submitted_by",
  ],
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

// A sheet's real column order can differ from REQUIRED_SHEETS — older sheets
// have newer columns appended at the end rather than in schema position — so
// writes must follow row 1, not the schema. Cache it per process.
const headerCache = new Map<string, string[]>();

async function getHeaders(sheetName: string): Promise<string[]> {
  const cached = headerCache.get(sheetName);
  if (cached) return cached;

  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${sheetName}!1:1`,
  });
  const headers =
    (res.data.values?.[0] as string[]) || REQUIRED_SHEETS[sheetName] || [];
  headerCache.set(sheetName, headers);
  return headers;
}

// Sheets created by an older version of the app are missing columns added
// since. Append any missing headers to the end of row 1 so reads/writes for
// the new fields line up instead of silently landing in unnamed columns.
async function ensureHeaders(
  sheetName: string,
  required: string[]
): Promise<void> {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`,
  });
  const existing = (res.data.values?.[0] as string[]) || [];
  const missing = required.filter((h) => !existing.includes(h));
  if (missing.length === 0) {
    headerCache.set(sheetName, existing);
    return;
  }

  const updated = [...existing, ...missing];
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [updated] },
  });
  headerCache.set(sheetName, updated);
  invalidateSheet(sheetName);
  console.log(`Added columns to ${sheetName}: ${missing.join(", ")}`);
}

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
      headerCache.set(sheetName, headers);
      console.log(`Created sheet: ${sheetName}`);
    } else {
      await ensureHeaders(sheetName, headers);
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

// --- Read cache -----------------------------------------------------------
// Google Sheets' free tier allows only 60 read requests/min/user. Without
// caching, a single page load can fire 5+ full-sheet reads and gaxios retries
// each failure, which quickly trips a 429 quota error. We cache each sheet's
// parsed rows for a few seconds and de-duplicate concurrent reads, then
// invalidate the relevant sheet whenever we write to it.
type Row = Record<string, string>;

const CACHE_TTL_MS = Number(process.env.SHEETS_CACHE_TTL_MS) || 15000;
const readCache = new Map<string, { data: Row[]; ts: number }>();
const inflight = new Map<string, Promise<Row[]>>();

function invalidateSheet(sheetName: string): void {
  readCache.delete(sheetName);
  inflight.delete(sheetName);
}

async function fetchSheet(sheetName: string): Promise<Row[]> {
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
    const obj: Row = {};
    headers.forEach((h, i) => {
      obj[h] = (row[i] as string) || "";
    });
    return obj;
  });
}

export async function readSheet(
  sheetName: string,
  opts?: { force?: boolean }
): Promise<Row[]> {
  const now = Date.now();

  if (!opts?.force) {
    const hit = readCache.get(sheetName);
    if (hit && now - hit.ts < CACHE_TTL_MS) {
      return hit.data.map((r) => ({ ...r }));
    }
    const pending = inflight.get(sheetName);
    if (pending) return (await pending).map((r) => ({ ...r }));
  }

  const p = fetchSheet(sheetName)
    .then((data) => {
      readCache.set(sheetName, { data, ts: Date.now() });
      inflight.delete(sheetName);
      return data;
    })
    .catch((err) => {
      inflight.delete(sheetName);
      throw err;
    });

  inflight.set(sheetName, p);
  return (await p).map((r) => ({ ...r }));
}

export async function appendRow(
  sheetName: string,
  row: Record<string, string>
): Promise<void> {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();

  const headers = await getHeaders(sheetName);
  const values = headers.map((h: string) => row[h] || "");

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:A`,
    valueInputOption: "RAW",
    requestBody: { values: [values] },
  });

  invalidateSheet(sheetName);
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

  invalidateSheet(sheetName);
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

  invalidateSheet(sheetName);
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
