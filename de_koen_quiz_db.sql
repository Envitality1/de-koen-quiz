DROP TABLE IF EXISTS answers CASCADE;
DROP TABLE IF EXISTS questions CASCADE;

CREATE TABLE questions (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  choices TEXT, -- optional, for multiple choice
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE answers (
  id SERIAL PRIMARY KEY,
  user_name TEXT,
  answer TEXT,
  question_id INT REFERENCES questions(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
