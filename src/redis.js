const { createClient } = require("redis");

class RedisClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
    }

    async connect() {
        const url = process.env.REDIS_URL || "redis://localhost:6379";

        this.client = createClient({ url });

        this.client.on("error", (err) => {
            console.error("Redis Client Error:", err);
            this.isConnected = false;
        });

        this.client.on("connect", () => {
            console.log("Connected to Redis");
            this.isConnected = true;
        });

        this.client.on("reconnecting", () => {
            console.log("Reconnecting to Redis...");
            this.isConnected = false;
        });

        await this.client.connect();
    }

    async disconnect() {
        if (this.client) {
            await this.client.disconnect();
            this.isConnected = false;
        }
    }

    isHealthy() {
        return this.isConnected;
    }

    // Atomic increment with expiry
    async increment(key, windowMs) {
        try {
            const multi = this.client.multi();
            multi.incr(key);
            multi.expire(key, Math.ceil(windowMs / 1000));
            const results = await multi.exec();
            return results[0]; // Current count
        } catch (error) {
            console.error("Redis increment error:", error);
            throw error;
        }
    }

    async get(key) {
        try {
            return await this.client.get(key);
        } catch (error) {
            console.error("Redis get error:", error);
            throw error;
        }
    }

    async slidingWindowIncrement(key, timestamp, windowMs) {
        try {
            const windowStart = timestamp - windowMs;
            const multi = this.client.multi();

            // Remove old entries
            multi.zremrangebyscore(key, 0, windowStart);
            // Add new entry
            multi.zadd(key, timestamp, `${timestamp}-${Math.random()}`);
            multi.expire(key, Math.ceil(windowMs / 1000) * 2);
            // Count current entries
            multi.zcard(key);

            const results = await multi.exec();
            return results[3];
        } catch (error) {
            console.error("Redis sliding window error:", error);
            throw error;
        }
    }

    // Token bucket operations
    async tokenBucket(key, tokensToAdd, maxTokens, lastRefillKey) {
        try {
            const multi = this.client.multi();

            multi.get(key);
            multi.get(lastRefillKey);

            const results = await multi.exec();
            const currentTokens = parseFloat(results[0]) || maxTokens;
            const lastRefill = parseFloat(results[1]) || Date.now();

            const now = Date.now();
            const timePassed = (now - lastRefill) / 1000;
            const newTokens = Math.min(
                maxTokens,
                currentTokens + timePassed * tokensToAdd,
            );

            const multi2 = this.client.multi();
            multi2.set(key, newTokens);
            multi2.set(lastRefillKey, now);
            await multi2.exec();

            return newTokens;
        } catch (error) {
            console.error("Redis token bucket error:", error);
            throw error;
        }
    }
}

module.exports = new RedisClient();
