import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import pkg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pkg;
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// connect to database (Render gives this URL later)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// serve homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// get today's question
app.get("/question", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM questions ORDER BY id DESC LIMIT 1"
  );
  res.json(result.rows[0] || { question: "No question today yet!" });
});

// submit an answer
app.post("/answer", async (req, res) => {
  const { user, answer } = req.body;
  await pool.query("INSERT INTO answers (username, answer) VALUES ($1, $2)", [
    user,
    answer,
  ]);
  res.json({ status: "ok" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`✅ De Koen Quiz server running on port ${port}`));
