import { google } from "googleapis";

const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

export const sheets = google.sheets({ version: "v4", auth });

/**
 * Utility: get sheetId (numeric) by sheet name
 */
async function getSheetIdByName(name) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = (meta.data.sheets || []).find(s => s.properties && s.properties.title === name);
  return sheet ? sheet.properties.sheetId : null;
}

/* 🧠 FETCH QUESTIONS
   Sheet: Questions
   A = Question | B = Choices | D = Image URL (col index 3)
*/
export async function fetchQuestions() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Questions!A2:B",
  });

  const rows = res.data.values || [];
  // filter empty question rows and trim
  return rows
    .filter(r => r[0] && String(r[0]).trim() !== "")
    .map(r => ({ question: String(r[0]).trim(), choices: r[1] ? String(r[1]).trim() : null }));
}

/* 💾 INSERT QUESTIONS INTO DB
   - wipes DB questions + answers (but not spreadsheet)
*/
export async function insertQuestionsToDB(pool) {
  const questions = await fetchQuestions();
  console.log("Fetched questions count:", questions.length);

  // wipe DB tables
  await pool.query("TRUNCATE TABLE answers, questions RESTART IDENTITY CASCADE");
  console.log("Truncated answers and questions tables.");

  for (const q of questions) {
    // safety: avoid inserting empty question
    if (q.question && q.question.trim() !== "") {
      await pool.query("INSERT INTO questions (question, choices) VALUES ($1, $2)", [
        q.question,
        q.choices,
      ]);
    }
  }

  console.log(`Inserted ${questions.length} questions into DB.`);
}

/* 🖼️ FETCH LATEST AD IMAGE FROM QUESTIONS!D (column D)
   Returns the last non-empty value found in Questions!D2:D
*/
export async function fetchAdImageFromQuestions() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Questions!D2:D",
  });

  const rows = res.data.values || [];
  // pick the last non-empty entry
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = rows[i] && rows[i][0];
    if (v && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

/* 💾 SYNC AD IMAGE INTO DB
   - truncates ad_image and inserts the latest URL (if any)
*/
export async function syncAdImageToDB(pool) {
  const imageUrl = await fetchAdImageFromQuestions();
  console.log("Fetched ad image URL:", imageUrl);
  await pool.query("TRUNCATE TABLE ad_image RESTART IDENTITY CASCADE");
  if (imageUrl) {
    await pool.query("INSERT INTO ad_image (url) VALUES ($1)", [imageUrl]);
    console.log("Inserted ad image to DB.");
  } else {
    console.log("No ad image found; ad_image table cleared.");
  }
}

/* 📝 APPEND ANSWER AT TOP OF Answers SHEET (A2:D2)
   - finds sheetId by name (Answers)
   - inserts a blank row below header, then updates A2:D2 with values
*/
export async function appendAnswerToSheet(user_name, answer, questionText) {
  // timestamp UTC+1
  const now = new Date();
  const utc1 = new Date(now.getTime() + 1 * 60 * 60 * 1000);
  const timestamp = `${utc1.getFullYear()}-${String(utc1.getMonth() + 1).padStart(2, "0")}-${String(
    utc1.getDate()
  ).padStart(2, "0")} ${String(utc1.getHours()).padStart(2, "0")}:${String(utc1.getMinutes()).padStart(
    2,
    "0"
  )}:${String(utc1.getSeconds()).padStart(2, "0")}`;

  // find sheetId for Answers
  const sheetId = await getSheetIdByName("Answers");
  if (sheetId === null) {
    throw new Error("Answers sheet not found in spreadsheet");
  }

  // insert a new row after header (row 1) -> new empty row becomes row 2
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId,
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

  // write to the new row A2:D2
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Answers!A2:D2",
    valueInputOption: "RAW",
    requestBody: {
      values: [[user_name, answer, timestamp, questionText]],
    },
  });

  console.log("Appended answer to Answers sheet (top).");
}
