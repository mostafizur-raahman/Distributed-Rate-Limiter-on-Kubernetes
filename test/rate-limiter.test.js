const request = require("supertest");
const app = require("../src/index");
const redis = require("../src/redis");

beforeAll(async () => {
    await redis.connect();
});

afterAll(async () => {
    await redis.disconnect();
});

describe("Rate Limiter API", () => {
    describe("GET /", () => {
        it("should return API info", async () => {
            const res = await request(app).get("/");
            expect(res.status).toBe(200);
            expect(res.body.service).toBe("Distributed Rate Limiter");
        });
    });

    describe("GET /health", () => {
        it("should return health status", async () => {
            const res = await request(app).get("/health");
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty("status");
            expect(res.body).toHaveProperty("redis");
        });
    });

    describe("GET /ready", () => {
        it("should return readiness status", async () => {
            const res = await request(app).get("/ready");
            expect(res.status).toBe(200);
            expect(res.body.ready).toBe(true);
        });
    });

    describe("POST /login", () => {
        it("should allow login within rate limit", async () => {
            const res = await request(app)
                .post("/login")
                .send({ username: "admin", password: "password" });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.headers["x-ratelimit-limit"]).toBeDefined();
            expect(res.headers["x-ratelimit-remaining"]).toBeDefined();
        });

        it("should block login after rate limit exceeded", async () => {
            // Make 5 requests to exhaust the limit
            for (let i = 0; i < 5; i++) {
                await request(app)
                    .post("/login")
                    .send({ username: "test", password: "test" });
            }

            // 6th request should be blocked
            const res = await request(app)
                .post("/login")
                .send({ username: "test", password: "test" });

            expect(res.status).toBe(429);
            expect(res.body.error).toBe("Too Many Requests");
        });
    });

    describe("GET /search", () => {
        it("should return search results with rate limit headers", async () => {
            const res = await request(app).get("/search?q=test");

            expect(res.status).toBe(200);
            expect(res.body.results).toBeDefined();
            expect(res.headers["x-ratelimit-limit"]).toBeDefined();
        });
    });

    describe("GET /api/v1/data", () => {
        it("should return data with token bucket rate limiting", async () => {
            const res = await request(app).get("/api/v1/data");

            expect(res.status).toBe(200);
            expect(res.body.data).toBeDefined();
            expect(res.headers["x-ratelimit-limit"]).toBeDefined();
        });
    });
});

describe("Rate Limit Headers", () => {
    it("should include standard rate limit headers", async () => {
        const res = await request(app).get("/search?q=test");

        expect(res.headers["x-ratelimit-limit"]).toBeDefined();
        expect(res.headers["x-ratelimit-remaining"]).toBeDefined();
        expect(res.headers["x-ratelimit-reset"]).toBeDefined();
    });
});
