import 'dotenv/config';
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import pkg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import { insertQuestionsToDB, appendAnswerToSheet, fetchQuestions } from "./googleSheets.js";

const { Pool } = pkg;
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Sync questions from Google Sheets at server start
(async () => {
  try {
    await insertQuestionsToDB(pool);
    console.log("✅ Questions synced from Google Sheets");
  } catch (err) {
    console.error("❌ Failed to sync questions:", err);
  }
})();

// Serve homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Get today's question
app.get("/question", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const result = await pool.query(
      "SELECT id, question, choices FROM questions WHERE quiz_date = $1 LIMIT 1",
      [today]
    );
    if (result.rows.length === 0) return res.json({ id: null, question: "No question today!", choices: [] });

    const q = result.rows[0];
    // Parse stored choices JSON
    const choices = q.choices ? JSON.parse(q.choices) : [];
    res.json({ id: q.id, question: q.question, choices });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch question" });
  }
});

// Submit answer
app.post("/answer", async (req, res) => {
  try {
    const { user_name, answer, question_id } = req.body;
    if (!user_name || !answer || !question_id) return res.status(400).json({ error: "Missing required fields" });

    // Check if user already answered
    const alreadyAnswered = await pool.query(
      "SELECT id FROM answers WHERE user_name=$1 AND question_id=$2",
      [user_name, question_id]
    );
    if (alreadyAnswered.rows.length > 0) return res.status(400).json({ error: "You already answered today's question" });

    // Insert into PostgreSQL
    await pool.query(
      "INSERT INTO answers (user_name, answer, question_id) VALUES ($1, $2, $3)",
      [user_name, answer, question_id]
    );

    // Get question text
    const qRes = await pool.query("SELECT question FROM questions WHERE id=$1", [question_id]);
    const questionText = qRes.rows[0].question;

    // Append to Google Sheet
    await appendAnswerToSheet(user_name, answer, questionText);

    res.json({ status: "ok" });
  } catch (err) {
    console.error("Error submitting answer:", err);
    res.status(500).json({ error: "Failed to submit answer" });
  }
});

// Optional: auto-sync questions daily at 00:00 UTC+1
import cron from "node-cron";
cron.schedule("0 0 * * *", async () => {
  console.log("Syncing questions from Google Sheets...");
  try {
    await insertQuestionsToDB(pool);
    console.log("✅ Done!");
  } catch (err) {
    console.error("❌ Failed to sync daily questions:", err);
  }
});

app.get("/ping", (req, res) => {
  res.send("pong");
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ De Koen Quiz server running on port ${port}`));
