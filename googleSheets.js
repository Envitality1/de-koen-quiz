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
    range: "Sheet1!A2:B", // Column A = question, B = multiple-choice
  });

  const rows = res.data.values || [];

  // Filter out empty questions
  return rows
    .filter(row => row[0] && row[0].trim() !== "")
    .map(row => ({
      question: row[0].trim(),
      choices: row[1] ? row[1].trim() : null
    }));
}

// Insert questions into DB
export async function insertQuestionsToDB(pool) {
  const questions = await fetchQuestions();

  if (questions.length === 0) {
    console.log("⚠️ No valid questions found in the sheet.");
    return;
  }

  // Reset tables
  await pool.query("TRUNCATE TABLE answers, questions RESTART IDENTITY CASCADE");

  for (const q of questions) {
    await pool.query(
      "INSERT INTO questions (question, choices) VALUES ($1, $2)",
      [q.question, q.choices]
    );
  }

  console.log(`✅ Inserted ${questions.length} questions into the DB.`);
}

// Append user answer to Google Sheets (columns D–G: Name, Answer, Time, Question)
export async function appendAnswerToSheet(user_name, answer, questionText) {
  // Get current time in UTC+1
  const now = new Date();
  const utc1 = new Date(now.getTime() + 1 * 60 * 60 * 1000);

  const timestamp = `${utc1.getFullYear()}-${String(utc1.getMonth() + 1).padStart(2, '0')}-${String(utc1.getDate()).padStart(2, '0')} ${String(utc1.getHours()).padStart(2, '0')}:${String(utc1.getMinutes()).padStart(2, '0')}:${String(utc1.getSeconds()).padStart(2, '0')}`;

  // Insert a blank row after header (row 1) to push older answers down
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId: 0, // first sheet
              dimension: "ROWS",
              startIndex: 1, // below header
              endIndex: 2,
            },
            inheritFromBefore: false,
          },
        },
      ],
    },
  });

  // Update new second row with the answer
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Sheet1!D2:G2", // D = Name, E = Answer, F = Time, G = Question
    valueInputOption: "RAW",
    requestBody: {
      values: [[user_name, answer, timestamp, questionText]],
    },
  });
}
