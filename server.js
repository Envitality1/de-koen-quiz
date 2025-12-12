import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import pkg from "pg";
import path from "path";
import session from "express-session";
import { fileURLToPath } from "url";
import {
  insertQuestionsToDB,
  appendAnswerToSheet,
  syncAdImageToDB,
} from "./googleSheets.js";

const { Pool } = pkg;
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- CONFIG ---
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const SESSION_SECRET = process.env.SESSION_SECRET || "secret";
const DATABASE_URL = process.env.DATABASE_URL;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public"))); // serve your public folder

// sessions for admin login
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// --- POSTGRES ---
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// --- ROUTES ---

// ping
app.get("/ping", (req, res) => res.send("pong"));

// get latest question
app.get("/question", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, question, choices FROM questions ORDER BY id DESC LIMIT 1"
    );
    const row = result.rows[0];
    if (!row)
      return res.json({ id: null, question: "No questions available", choices: null });
    res.json({ id: row.id, question: row.question, choices: row.choices });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch question" });
  }
});

// submit answer
app.post("/answer", async (req, res) => {
  const { user_name, answer, question_id } = req.body;
  if (!user_name || !answer || !question_id)
    return res.status(400).json({ error: "Missing fields" });

  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const check = await pool.query(
      "SELECT * FROM answers WHERE ip_address=$1 AND created_at::date=$2",
      [ip, today]
    );
    if (check.rows.length > 0)
      return res.status(403).json({ error: "Je hebt vandaag al een antwoord ingevuld." });

    const qRes = await pool.query("SELECT question FROM questions WHERE id=$1", [
      question_id,
    ]);
    if (!qRes.rows.length) return res.status(400).json({ error: "Invalid question_id" });

    await pool.query(
      "INSERT INTO answers (user_name, answer, question_id, ip_address) VALUES ($1,$2,$3,$4)",
      [user_name, answer, question_id, ip]
    );

    await appendAnswerToSheet(user_name, answer, qRes.rows[0].question);

    res.json({ status: "ok" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit answer" });
  }
});

// --- ADMIN LOGIN ---
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.admin = true;
    return res.json({ status: "ok" });
  }
  res.status(401).json({ error: "Invalid credentials" });
});

app.get("/admin", (req, res) => {
  if (!req.session.admin) return res.status(401).send("Unauthorized");
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// --- SYNC ROUTES (optional) ---
app.get("/sync", async (req, res) => {
  try {
    await insertQuestionsToDB(pool);
    res.redirect("/admin");
  } catch (err) {
    console.error(err);
    res.status(500).send("Sync failed");
  }
});

app.get("/syncimg", async (req, res) => {
  try {
    await syncAdImageToDB(pool);
    res.redirect("/admin");
  } catch (err) {
    console.error(err);
    res.status(500).send("Sync image failed");
  }
});

// === ANNOUNCEMENTS ===

// Get announcement
app.get("/announcements", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT content FROM my_schema.announcements ORDER BY updated_at DESC LIMIT 1"
    );

    if (result.rows.length === 0)
      return res.json({ content: "" });

    res.json({ content: result.rows[0].content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load announcement" });
  }
});

// Update announcement – admin only
// Get announcement
app.get("/announcements", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT content FROM announcements ORDER BY updated_at DESC LIMIT 1"
    );

    if (result.rows.length === 0)
      return res.json({ content: "" });

    res.json({ content: result.rows[0].content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load announcement" });
  }
});

// --- START SERVER ---
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ Server running on port ${port}`));
