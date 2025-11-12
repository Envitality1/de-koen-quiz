import { google } from "googleapis";

// Read credentials from environment variable (Render or local .env)
const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

export const sheets = google.sheets({ version: "v4", auth });

// Replace with your actual Google Sheet ID
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// Fetch questions and choices from Google Sheets
export async function fetchQuestions() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Sheet1!A2:B", // A = question, B = multiple-choice
  });

  const rows = res.data.values || [];
  return rows.map(row => ({
    question: row[0],
    choices: row[1] || null
  }));
}

// Insert questions into DB
export async function insertQuestionsToDB(pool) {
  const questions = await fetchQuestions();

  // Reset tables
  await pool.query("TRUNCATE TABLE answers, questions RESTART IDENTITY CASCADE");

  for (const q of questions) {
    await pool.query(
      "INSERT INTO questions (question, choices) VALUES ($1, $2)",
      [q.question, q.choices]
    );
  }
}

// Append user answer to Google Sheets (columns D–G: Name, Answer, Time, Question)
export async function appendAnswerToSheet(user_name, answer, questionText) {
  // Get current time in UTC+1
  const now = new Date();
  const utc1 = new Date(now.getTime() + 1 * 60 * 60 * 1000); // add 1 hour

  const timestamp = `${utc1.getFullYear()}-${String(utc1.getMonth() + 1).padStart(2, '0')}-${String(utc1.getDate()).padStart(2, '0')} ${String(utc1.getHours()).padStart(2, '0')}:${String(utc1.getMinutes()).padStart(2, '0')}:${String(utc1.getSeconds()).padStart(2, '0')}`;

  // Insert a blank row after the header (row 1)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId: 0, // usually 0 for the first sheet
              dimension: "ROWS",
              startIndex: 1, // insert just below the header
              endIndex: 2,
            },
            inheritFromBefore: false,
          },
        },
      ],
    },
  });

  // Now update that new second row with the answer
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Sheet1!C2:F2",
    valueInputOption: "RAW",
    requestBody: {
      values: [[user_name, answer, timestamp, questionText]],
    },
  });
}
