const express = require("express");
const redis = require("./redis");
const {
    loginRateLimit,
    searchRateLimit,
    dataRateLimit,
} = require("./middleware");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
    const redisHealth = redis.isHealthy();
    const status = redisHealth ? "healthy" : "degraded";

    res.status(redisHealth ? 200 : 503).json({
        status,
        redis: redisHealth,
        timestamp: new Date().toISOString(),
    });
});

// Readiness probe (tied to Redis health)
app.get("/ready", (req, res) => {
    if (redis.isHealthy()) {
        res.status(200).json({ ready: true });
    } else {
        res.status(503).json({ ready: false, reason: "Redis unavailable" });
    }
});

// Login endpoint with rate limiting (Phase 1.2)
app.post("/login", loginRateLimit, (req, res) => {
    const { username, password } = req.body;

    // Simulate login logic
    if (username === "admin" && password === "password") {
        res.json({
            success: true,
            token: "fake-jwt-token",
            message: "Login successful",
        });
    } else {
        res.status(401).json({
            success: false,
            message: "Invalid credentials",
        });
    }
});

// Search endpoint with sliding window (Phase 3.1)
app.get("/search", searchRateLimit, (req, res) => {
    const { q } = req.query;

    res.json({
        query: q,
        results: [
            { id: 1, title: `Result for ${q}` },
            { id: 2, title: `Another result for ${q}` },
        ],
        timestamp: new Date().toISOString(),
    });
});

// Data endpoint with token bucket (Phase 3.2)
app.get("/api/v1/data", dataRateLimit, (req, res) => {
    res.json({
        data: {
            id: 1,
            value: "sample data",
            timestamp: new Date().toISOString(),
        },
        rateLimit: {
            algorithm: "token-bucket",
            maxTokens: 100,
            refillRate: "10 tokens/second",
        },
    });
});

// Info endpoint
app.get("/", (req, res) => {
    res.json({
        service: "Distributed Rate Limiter",
        version: "1.0.0",
        endpoints: {
            "/login": "POST - Rate limited (5 req/min)",
            "/search": "GET - Rate limited (sliding window, 10 req/min)",
            "/api/v1/data": "GET - Rate limited (token bucket, 100 tokens)",
            "/health": "GET - Health check",
            "/ready": "GET - Readiness probe",
        },
    });
});

// Start server
async function start() {
    try {
        await redis.connect();

        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Redis connected: ${redis.isHealthy()}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
    console.log("SIGTERM received, shutting down gracefully");
    await redis.disconnect();
    process.exit(0);
});

process.on("SIGINT", async () => {
    console.log("SIGINT received, shutting down gracefully");
    await redis.disconnect();
    process.exit(0);
});

start();

module.exports = app;
