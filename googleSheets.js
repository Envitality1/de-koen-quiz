import { google } from "googleapis";

// Read credentials from environment variable
const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

export const sheets = google.sheets({ version: "v4", auth });

// Google Sheet ID
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// Fetch questions from columns A (question) & B (choices)
export async function fetchQuestions() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Sheet1!A2:B",
  });
  const rows = res.data.values || [];
  return rows.map(row => ({
    question: row[0],
    choices: row[1] ? row[1].split(",").map(c => c.trim()) : [],
  }));
}

// Insert questions into PostgreSQL
export async function insertQuestionsToDB(pool) {
  const questions = await fetchQuestions();

  // Truncate only questions table (don't touch answers)
  await pool.query("TRUNCATE TABLE questions RESTART IDENTITY CASCADE");

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  for (const q of questions) {
    await pool.query(
      "INSERT INTO questions (question, choices, quiz_date) VALUES ($1, $2, $3)",
      [q.question, JSON.stringify(q.choices), today]
    );
  }
}

// Append answer to Google Sheets (columns D–G)
export async function appendAnswerToSheet(user_name, answer, questionText) {
  const now = new Date();
  const utc1 = new Date(now.getTime() + 1 * 60 * 60 * 1000); // UTC+1
  const timestamp = `${utc1.getFullYear()}-${String(utc1.getMonth()+1).padStart(2,'0')}-${String(utc1.getDate()).padStart(2,'0')};${String(utc1.getHours()).padStart(2,'0')}:${String(utc1.getMinutes()).padStart(2,'0')}:${String(utc1.getSeconds()).padStart(2,'0')}`;

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "Sheet1!D:G",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[user_name, answer, timestamp, questionText]],
    },
  });
}
