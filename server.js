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

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // serves index.html from project root

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ping
app.get("/ping", (req, res) => res.send("pong"));

// /sync -> sync Questions sheet -> DB (wipes DB questions + answers)
app.get("/sync", async (req, res) => {
  try {
    console.log("Manual /sync triggered");
    await insertQuestionsToDB(pool);
    res.redirect("/");
  } catch (err) {
    console.error("Sync failed:", err);
    res.status(500).send("Sync failed");
  }
});

// /syncimg -> sync ad image from Questions!D -> DB (wipes ad_image)
app.get("/syncimg", async (req, res) => {
  try {
    console.log("Manual /syncimg triggered");
    await syncAdImageToDB(pool);
    res.redirect("/");
  } catch (err) {
    console.error("syncimg failed:", err);
    res.status(500).send("Sync image failed");
  }
});

// get latest question (last imported)
app.get("/question", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, question, choices FROM questions ORDER BY id DESC LIMIT 1");
    const row = result.rows[0];
    if (!row) return res.json({ id: null, question: "No questions available", choices: null });
    res.json({ id: row.id, question: row.question, choices: row.choices });
  } catch (err) {
    console.error("GET /question error:", err);
    res.status(500).json({ error: "Failed to fetch question" });
  }
});

// get latest ad
app.get("/ad", async (req, res) => {
  try {
    const result = await pool.query("SELECT url FROM ad_image ORDER BY id DESC LIMIT 1");
    res.json({ image: result.rows[0]?.url || null });
  } catch (err) {
    console.error("GET /ad error:", err);
    res.status(500).json({ error: "Failed to fetch ad" });
  }
});

// post answer -> insert into DB then append to Answers sheet top
app.post("/answer", async (req, res) => {
  const { user_name, answer, question_id } = req.body;
  if (!user_name || !answer || !question_id) return res.status(400).json({ error: "Missing fields" });

  try {
    // ensure question exists (defensive)
    const qRes = await pool.query("SELECT question FROM questions WHERE id=$1", [question_id]);
    if (!qRes.rows.length) return res.status(400).json({ error: "Invalid question_id" });
    const questionText = qRes.rows[0].question;

    // insert into DB
    await pool.query("INSERT INTO answers (user_name, answer, question_id) VALUES ($1, $2, $3)", [
      user_name,
      answer,
      question_id,
    ]);

    // append to sheet (top)
    await appendAnswerToSheet(user_name, answer, questionText);

    res.json({ status: "ok" });
  } catch (err) {
    console.error("POST /answer error:", err);
    res.status(500).json({ error: "Failed to submit answer" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ De Koen Quiz server running on port ${port}`));
