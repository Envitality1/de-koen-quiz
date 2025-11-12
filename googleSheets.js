import { google } from "googleapis";

// Read credentials from environment variable
const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

export const sheets = google.sheets({ version: "v4", auth });

// Your Google Sheet ID
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// Fetch questions and multiple-choice options from the "Questions" sheet
export async function fetchQuestions() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Questions!A2:B", // Column A = question, Column B = choices (comma-separated)
  });

  const rows = res.data.values || [];
  return rows.map(row => ({
    question: row[0],
    choices: row[1] || null,
  }));
}

// Insert questions into PostgreSQL DB
export async function insertQuestionsToDB(pool) {
  const questions = await fetchQuestions();

  // Clear old questions and answers
  await pool.query("TRUNCATE TABLE answers, questions RESTART IDENTITY CASCADE");

  for (const q of questions) {
    await pool.query(
      "INSERT INTO questions (question, choices) VALUES ($1, $2)",
      [q.question, q.choices]
    );
  }
}

// Append a user answer to the "Answers" sheet at the top
export async function appendAnswerToSheet(user_name, answer, questionText) {
  // Time in UTC+1
  const now = new Date();
  const utc1 = new Date(now.getTime() + 1 * 60 * 60 * 1000);
  const timestamp = `${utc1.getFullYear()}-${String(utc1.getMonth() + 1).padStart(2,'0')}-${String(utc1.getDate()).padStart(2,'0')} ${String(utc1.getHours()).padStart(2,'0')}:${String(utc1.getMinutes()).padStart(2,'0')}:${String(utc1.getSeconds()).padStart(2,'0')}`;

  // Insert a new row at the top (row index 1, below headers)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId: 0, // Make sure "Answers" is the first sheet or update its sheetId
              dimension: "ROWS",
              startIndex: 1,
              endIndex: 2,
            },
            inheritFromBefore: false,
          },
        },
      ],
    },
  });

  // Update the new row with the answer
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Answers!A2:D2", // D=Name, E=Answer, F=Time, G=Question
    valueInputOption: "RAW",
    requestBody: {
      values: [[user_name, answer, timestamp, questionText]],
    },
  });
}
