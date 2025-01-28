const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

const app = express();
app.use(bodyParser.json());

const pool = new Pool({
  user: "postgres",
  host: process.env.DB_HOST || "localhost",
  database: "users_db",
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
});

const JWT_SECRET = process.env.JWT_SECRET || "JWTSecretSampleValue";

// Регистрация пользователя
app.post("/register", async (req, res) => {
  const { name, email, age, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (name, email, age, password) VALUES ($1, $2, $3, $4) RETURNING id, name, age, email",
      [name, email, age, hashedPassword]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Аутентификация пользователя
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (!result.rows.length) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Валидация токена
app.post("/validate", async (req, res) => {
  const { token } = req.body;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (err) {
    res.status(401).json({ valid: false, error: "Invalid token" });
  }
});

const PORT = process.env.AUTH_PORT || 8081;
app.listen(PORT, () => {
  console.log(`Auth service is running on http://localhost:${PORT}`);
});