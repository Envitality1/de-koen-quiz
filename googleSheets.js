import { google } from "googleapis";

// Read credentials from environment variable (set in Render or local .env)
const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

export const sheets = google.sheets({ version: "v4", auth });

// Replace with your actual Google Sheet ID
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "YOUR_SHEET_ID_HERE";

// Fetch questions from column A and insert into PostgreSQL
export async function fetchQuestions() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Sheet1!A2:A", // questions start at A2
  });
  const rows = res.data.values || [];
  return rows.map((row) => row[0]);
}

// Insert questions into DB
export async function insertQuestionsToDB(pool) {
  const questions = await fetchQuestions();

  // Reset questions table (truncates answers too)
  await pool.query("TRUNCATE TABLE answers, questions RESTART IDENTITY CASCADE");

  for (const question of questions) {
    await pool.query("INSERT INTO questions (question) VALUES ($1)", [question]);
  }
}

// Append a user answer to Google Sheets (answers start from column C)
export async function appendAnswerToSheet(user_name, answer, questionText) {
  // Get current time in UTC+1
  const now = new Date();
  const utc1 = new Date(now.getTime() + 1 * 60 * 60 * 1000); // add 1 hour

  const timestamp = `${utc1.getFullYear()}-${String(utc1.getMonth() + 1).padStart(2,'0')}-${String(utc1.getDate()).padStart(2,'0')};${String(utc1.getHours()).padStart(2,'0')}:${String(utc1.getMinutes()).padStart(2,'0')}:${String(utc1.getSeconds()).padStart(2,'0')}`;

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "Sheet1!A:D", // Name, Answer, Time, Question
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[user_name, answer, timestamp, questionText]],
    },
  });
}
