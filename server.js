import 'dotenv/config';
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import pkg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import { insertQuestionsToDB, appendAnswerToSheet, syncAdImageToDB } from "./googleSheets.js";

const { Pool } = pkg;
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve all static files from 'public' folder
app.use(express.static(path.join(__dirname, "public")));

// Database setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Routes

// ping
app.get("/ping", (req, res) => res.send("pong"));

// Sync questions from Google Sheets -> DB
app.get("/sync", async (req, res) => {
  try {
    await insertQuestionsToDB(pool);
    res.redirect("/");
  } catch (err) {
    console.error("Sync failed:", err);
    res.status(500).send("Sync failed");
  }
});

// Sync ad image
app.get("/syncimg", async (req, res) => {
  try {
    await syncAdImageToDB(pool);
    res.redirect("/");
  } catch (err) {
    console.error("Sync image failed:", err);
    res.status(500).send("Sync image failed");
  }
});

// Get latest question
app.get("/question", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, question, choices FROM questions ORDER BY id DESC LIMIT 1"
    );
    const row = result.rows[0];
    if (!row) return res.json({ id: null, question: "No questions available", choices: null });
    res.json({ id: row.id, question: row.question, choices: row.choices });
  } catch (err) {
    console.error("GET /question error:", err);
    res.status(500).json({ error: "Failed to fetch question" });
  }
});

// Get latest ad image
app.get("/ad", async (req, res) => {
  try {
    const result = await pool.query("SELECT url FROM ad_image ORDER BY id DESC LIMIT 1");
    res.json({ image: result.rows[0]?.url || null });
  } catch (err) {
    console.error("GET /ad error:", err);
    res.status(500).json({ error: "Failed to fetch ad" });
  }
});

// Submit answer with IP restriction
app.post("/answer", async (req, res) => {
  const { user_name, answer, question_id } = req.body;
  if (!user_name || !answer || !question_id)
    return res.status(400).json({ error: "Missing fields" });

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const check = await pool.query(
      "SELECT * FROM answers WHERE ip_address=$1 AND created_at::date=$2",
      [ip, today]
    );
    if (check.rows.length > 0) {
      return res.status(403).json({ error: "Je hebt vandaag al een antwoord ingevuld." });
    }

    const qRes = await pool.query("SELECT question FROM questions WHERE id=$1", [question_id]);
    if (!qRes.rows.length) return res.status(400).json({ error: "Invalid question_id" });
    const questionText = qRes.rows[0].question;

    await pool.query(
      "INSERT INTO answers (user_name, answer, question_id, ip_address) VALUES ($1,$2,$3,$4)",
      [user_name, answer, question_id, ip]
    );

    await appendAnswerToSheet(user_name, answer, questionText);

    res.json({ status: "ok" });
  } catch (err) {
    console.error("POST /answer error:", err);
    res.status(500).json({ error: "Failed to submit answer" });
  }
});

// Serve index.html on root path
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ De Koen Quiz server running on port ${port}`));
