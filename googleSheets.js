import { google } from "googleapis";

const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

export const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

/* 🧠 FETCH QUESTIONS
   Sheet: Questions
   A = Question | B = Choices
*/
export async function fetchQuestions() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Questions!A2:B",
  });

  const rows = res.data.values || [];
  return rows.map(row => ({
    question: row[0],
    choices: row[1] || null,
  }));
}

/* 💾 INSERT QUESTIONS INTO DB */
export async function insertQuestionsToDB(pool) {
  const questions = await fetchQuestions();

  await pool.query("TRUNCATE TABLE answers, questions RESTART IDENTITY CASCADE");

  for (const q of questions) {
    if (q.question)
      await pool.query(
        "INSERT INTO questions (question, choices) VALUES ($1, $2)",
        [q.question, q.choices]
      );
  }

  console.log("✅ Questions synced successfully.");
}

/* 🖼️ FETCH AD IMAGE (Ads sheet)
   A = Image URL
*/
export async function fetchAdImageFromSheet() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Ads!A2:A",
  });

  const rows = res.data.values || [];
  return rows.length ? rows[rows.length - 1][0] : null;
}

/* 💾 STORE AD IMAGE IN DB */
export async function syncAdImageToDB(pool) {
  const imageUrl = await fetchAdImageFromSheet();

  await pool.query("TRUNCATE TABLE ad_image RESTART IDENTITY CASCADE");
  if (imageUrl) {
    await pool.query("INSERT INTO ad_image (url) VALUES ($1)", [imageUrl]);
    console.log("✅ Ad image synced successfully:", imageUrl);
  } else {
    console.warn("⚠️ No ad image found in Ads sheet.");
  }
}

/* 📝 APPEND ANSWER TO SHEET (Answers!A–D)
   A = Name | B = Answer | C = Time | D = Question
*/
export async function appendAnswerToSheet(user_name, answer, questionText) {
  const now = new Date();
  const utc1 = new Date(now.getTime() + 1 * 60 * 60 * 1000);
  const timestamp = `${utc1.getFullYear()}-${String(utc1.getMonth() + 1).padStart(2, "0")}-${String(
    utc1.getDate()
  ).padStart(2, "0")} ${String(utc1.getHours()).padStart(2, "0")}:${String(
    utc1.getMinutes()
  ).padStart(2, "0")}:${String(utc1.getSeconds()).padStart(2, "0")}`;

  // Insert a new row after header
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: { sheetId: 0, dimension: "ROWS", startIndex: 1, endIndex: 2 },
          },
        },
      ],
    },
  });

  // Fill the new row
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Answers!A2:D2",
    valueInputOption: "RAW",
    requestBody: {
      values: [[user_name, answer, timestamp, questionText]],
    },
  });
}
