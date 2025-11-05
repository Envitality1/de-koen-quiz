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

// Fetch questions and multiple-choice options from columns A & B
export async function fetchQuestions() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Sheet1!A2:B", // questions start at row 2
  });

  const rows = res.data.values || [];

  // Return an array of { question, choices }
  return rows.map(row => ({
    question: row[0],
    choices: row[1] ? row[1].split(",").map(s => s.trim()) : [],
  }));
}

//sync to DB
export async function insertQuestionsToDB(pool) {
  const questions = await fetchQuestions();

  // Reset table
  await pool.query("TRUNCATE TABLE answers, questions RESTART IDENTITY CASCADE");

  let today = new Date();

  for (let i = 0; i < questions.length; i++) {
    const quizDate = new Date(today);
    quizDate.setDate(today.getDate() + i);

    const { question, choices } = questions[i];
    await pool.query(
      "INSERT INTO questions (question, choices, quiz_date) VALUES ($1, $2, $3)",
      [question, choices || null, quizDate]
    );
  }
}


// Append a user answer to Google Sheets (Columns D–G)
export async function appendAnswerToSheet(user_name, answer, questionText) {
  const now = new Date();
  const utc1 = new Date(now.getTime() + 1 * 60 * 60 * 1000); // UTC+1

  const timestamp = `${utc1.getFullYear()}-${String(utc1.getMonth() + 1).padStart(2,'0')}-${String(utc1.getDate()).padStart(2,'0')};${String(utc1.getHours()).padStart(2,'0')}:${String(utc1.getMinutes()).padStart(2,'0')}:${String(utc1.getSeconds()).padStart(2,'0')}`;

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "Sheet1!D:G", // Name, Answer, Timestamp, Question
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[user_name, answer, timestamp, questionText]],
    },
  });
}
