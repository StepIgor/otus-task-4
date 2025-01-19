const express = require("express");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const prom = require("prom-client");

const app = express();
app.use(bodyParser.json());

// Prometheus
const collectDefaultMetrics = prom.collectDefaultMetrics;
collectDefaultMetrics(); // Сбор базовых метрик (CPU, память и т.д.)

// Создаем метрики
const httpRequestDurationMicroseconds = new prom.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.1, 0.5, 0.9, 1, 2, 5], // Квантили 0.5, 0.95, 0.99 будут вычислены Prometheus
});

const httpRequestsTotal = new prom.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

const httpErrorRate = new prom.Counter({
  name: "http_errors_total",
  help: "Total number of HTTP 500 responses",
  labelNames: ["route"],
});

// Endpoint для метрик
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", prom.register.contentType);
  res.end(await prom.register.metrics());
});

// Database configuration
const pool = new Pool({
  user: "postgres",
  host: process.env.DB_HOST || "localhost",
  database: "users_db",
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
});


// Middleware для метрик
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on("finish", () => {
    const { method, path: route } = req;
    const statusCode = res.statusCode;

    httpRequestsTotal.inc({ method, route, status_code: statusCode });

    if (statusCode === 500) {
      httpErrorRate.inc({ route });
    }

    end({ method, route, status_code: statusCode });
  });
  next();
});

// ROUTES

// Get all users
app.get("/users", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get a single user
app.get("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    if (!result.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create a new user
app.post("/users", async (req, res) => {
  try {
    const { name, email, age } = req.body;
    const result = await pool.query(
      "INSERT INTO users (name, email, age) VALUES ($1, $2, $3) RETURNING *",
      [name, email, age]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update a user
app.put("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, age } = req.body;
    const result = await pool.query(
      "UPDATE users SET name = $1, email = $2, age = $3 WHERE id = $4 RETURNING *",
      [name, email, age, id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete a user
app.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM users WHERE id = $1 RETURNING *",
      [id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start server
const PORT = process.env.APP_PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
