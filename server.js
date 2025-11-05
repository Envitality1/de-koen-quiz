import 'dotenv/config';
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import pkg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import { insertQuestionsToDB, appendAnswerToSheet } from "./googleSheets.js";
import cron from "node-cron";

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


// Manual sync route (browser-accessible)
app.get("/sync", async (req, res) => {
  try {
    await insertQuestionsToDB(pool);
    res.redirect("/"); // redirect back to home
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to sync questions");
  }
});


// Ping endpoint for uptime monitors
app.get("/ping", (req, res) => res.send("pong"));

// Sync questions on server start
insertQuestionsToDB(pool)
  .then(() => console.log("✅ Questions synced from Google Sheets"))
  .catch(err => console.error("❌ Failed to sync questions:", err));

// Serve homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Get latest question
app.get("/question", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM questions ORDER BY id DESC LIMIT 1"
    );
    res.json(result.rows[0] || { id: null, question: "No question today yet!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch question" });
  }
});



// Submit answer
app.post("/answer", async (req, res) => {
  const { user_name, answer, question_id } = req.body;
  if (!user_name || !answer || !question_id) return res.status(400).json({ error: "Missing fields" });

  try {
    const result = await pool.query(
      "INSERT INTO answers (user_name, answer, question_id) VALUES ($1, $2, $3) RETURNING *",
      [user_name, answer, question_id]
    );

    const qRes = await pool.query(
      "SELECT question FROM questions WHERE id=$1",
      [question_id]
    );
    const questionText = qRes.rows[0].question;

    await appendAnswerToSheet(user_name, answer, questionText);
    res.json({ status: "ok" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database insert failed" });
  }
});

// Daily cron job at 00:00 UTC+1
cron.schedule("0 23 * * *", async () => { // 23:00 UTC = 00:00 UTC+1
  console.log("Syncing questions from Google Sheets...");
  await insertQuestionsToDB(pool);
  console.log("✅ Done!");
});



const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ De Koen Quiz server running on port ${port}`));
