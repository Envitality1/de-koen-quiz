import { google } from "googleapis";
import fs from "fs";

// Load service account credentials
const credentials = JSON.parse(fs.readFileSync("service-account.json"));

// Authenticate with Google Sheets
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

// Replace this with your actual Google Sheet ID
const SPREADSHEET_ID = "1eJLd2rerfazwQDozdF-bKxNfr068Lb6TfOXEwplCElA";

const QUESTIONS_RANGE = "Sheet1!A2:A";  // column A for questions
const ANSWERS_RANGE = "Sheet1!C:E";     // columns C–E for answers

// Fetch questions from Google Sheets (Column A)
export async function fetchQuestions() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: QUESTIONS_RANGE,
  });

  const rows = res.data.values || [];
  return rows.map(r => r[0]); // array of question strings
}

// Insert questions into PostgreSQL if they don't already exist
export async function insertQuestionsToDB(pool) {
  const questions = await fetchQuestions();
  for (const question of questions) {
    await pool.query(
      "INSERT INTO questions (question) VALUES ($1) ON CONFLICT DO NOTHING",
      [question]
    );
  }
}

export async function appendAnswerToSheet(user_name, answer, question) {
  const now = new Date();

  // Format: 2025-11-02;14:18:22
  const formattedTime = now.getFullYear() + "-" +
                        String(now.getMonth() + 1).padStart(2, "0") + "-" +
                        String(now.getDate()).padStart(2, "0") + ";" +
                        String(now.getHours()).padStart(2, "0") + ":" +
                        String(now.getMinutes()).padStart(2, "0") + ":" +
                        String(now.getSeconds()).padStart(2, "0");

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: ANSWERS_RANGE,
    valueInputOption: "RAW",
    resource: {
      values: [[user_name, answer, formattedTime, question]],
    },
  });
}

// Truncate questions table and resync
export async function resetQuestionsInDB(pool) {
  try {
    // Delete all questions (and answers related to them)
    await pool.query("TRUNCATE TABLE questions RESTART IDENTITY CASCADE");

    console.log("✅ Questions table cleared");
    // Insert questions from Google Sheets
    await insertQuestionsToDB(pool);
    console.log("✅ Questions resynced from Google Sheets");
  } catch (err) {
    console.error("❌ Failed to reset questions:", err);
  }
}
