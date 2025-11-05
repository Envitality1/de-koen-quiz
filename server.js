import 'dotenv/config';
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import pkg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import { insertQuestionsToDB, appendAnswerToSheet } from "./googleSheets.js";

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

// Ping endpoint
app.get("/ping", (req, res) => res.send("pong"));

// Manual sync endpoint
app.get("/sync", async (req, res) => {
  try {
    await insertQuestionsToDB(pool);
    res.redirect("/");
  } catch (err) {
    console.error("Failed to sync:", err);
    res.status(500).send("Sync failed");
  }
});

// Sync questions on server start
insertQuestionsToDB(pool)
  .then(() => console.log("✅ Questions synced from Google Sheets"))
  .catch(err => console.error("❌ Failed to sync questions:", err));

// Serve homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Get latest question (always show the last one)
app.get("/question", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, question, choices FROM questions ORDER BY id DESC LIMIT 1"
    );
    res.json(result.rows[0] || { id: null, question: "No question today yet!", choices: null });
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
    const qRes = await pool.query("SELECT question FROM questions WHERE id=$1", [question_id]);
    const questionText = qRes.rows[0].question;

    await pool.query(
      "INSERT INTO answers (user_name, answer, question_id) VALUES ($1, $2, $3)",
      [user_name, answer, question_id]
    );

    await appendAnswerToSheet(user_name, answer, questionText);
    res.json({ status: "ok" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database insert failed" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Server running on port ${port}`));
