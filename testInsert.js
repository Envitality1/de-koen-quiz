import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function testInsert() {
  try {
    // Insert a test question
    const questionText = "What is Koen's favorite color?";
    await pool.query("INSERT INTO questions (question) VALUES ($1)", [questionText]);

    console.log("✅ Question inserted successfully!");

    // Check it saved
    const result = await pool.query("SELECT * FROM questions ORDER BY id DESC LIMIT 1");
    console.log("🧾 Latest question:", result.rows[0]);

  } catch (err) {
    console.error("❌ Error inserting question:", err);
  } finally {
    await pool.end();
  }
}

testInsert();
