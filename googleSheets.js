import { google } from "googleapis";

const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

export const sheets = google.sheets({ version: "v4", auth });

async function getSheetIdByName(name) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = (meta.data.sheets || []).find(s => s.properties?.title === name);
  return sheet ? sheet.properties.sheetId : null;
}

// fetch questions
export async function fetchQuestions() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Questions!A2:B",
  });
  const rows = res.data.values || [];
  return rows.filter(r => r[0]?.trim() !== "").map(r => ({
    question: r[0].trim(),
    choices: r[1]?.trim() || null,
  }));
}

// insert questions into DB
export async function insertQuestionsToDB(pool) {
  const questions = await fetchQuestions();
  console.log("Fetched questions:", questions.length);
  await pool.query("TRUNCATE TABLE answers, questions RESTART IDENTITY CASCADE");
  for (const q of questions) {
    if (q.question) {
      await pool.query("INSERT INTO questions (question, choices) VALUES ($1,$2)", [q.question, q.choices]);
    }
  }
}

// fetch latest ad image
export async function fetchAdImageFromQuestions() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Questions!D2:D",
  });
  const rows = res.data.values || [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = rows[i]?.[0];
    if (v?.trim() !== "") return v.trim();
  }
  return null;
}

// sync ad image into DB
export async function syncAdImageToDB(pool) {
  const imageUrl = await fetchAdImageFromQuestions();
  console.log("Fetched ad image URL:", imageUrl);
  await pool.query("TRUNCATE TABLE ad_image RESTART IDENTITY CASCADE");
  if (imageUrl) await pool.query("INSERT INTO ad_image (url) VALUES ($1)", [imageUrl]);
}

// append answer to Google Sheet
export async function appendAnswerToSheet(user_name, answer, questionText) {
  const now = new Date();
  const utc1 = new Date(now.getTime() + 1 * 60 * 60 * 1000);
  const timestamp = `${utc1.getFullYear()}-${String(utc1.getMonth()+1).padStart(2,"0")}-${String(utc1.getDate()).padStart(2,"0")} ${String(utc1.getHours()).padStart(2,"0")}:${String(utc1.getMinutes()).padStart(2,"0")}:${String(utc1.getSeconds()).padStart(2,"0")}`;

  const sheetId = await getSheetIdByName("Answers");
  if (sheetId === null) throw new Error("Answers sheet not found");

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{ insertDimension: { range: { sheetId, dimension: "ROWS", startIndex:1, endIndex:2 }, inheritFromBefore:false } }],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Answers!A2:D2",
    valueInputOption: "RAW",
    requestBody: { values: [[user_name, answer, timestamp, questionText]] },
  });

  console.log("Appended answer to Answers sheet");
}
