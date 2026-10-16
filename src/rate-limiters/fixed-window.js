class FixedWindowLimiter {
    constructor(redisClient, maxRequests, windowMs) {
        this.redis = redisClient;
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
    }

    async isAllowed(key) {
        const redisKey = `ratelimit:${key}`;

        try {
            const count = await this.redis.increment(redisKey, this.windowMs);

            return {
                allowed: count <= this.maxRequests,
                limit: this.maxRequests,
                remaining: Math.max(0, this.maxRequests - count),
                reset: Date.now() + this.windowMs,
            };
        } catch (error) {
            // Fail-open: allow request if Redis is down
            console.error("Rate limiter error:", error);
            return {
                allowed: true,
                limit: this.maxRequests,
                remaining: this.maxRequests,
                reset: Date.now() + this.windowMs,
                error: true,
            };
        }
    }
}

module.exports = FixedWindowLimiter;
