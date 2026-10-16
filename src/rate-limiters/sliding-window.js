class SlidingWindowLimiter {
    constructor(redisClient, maxRequests, windowMs) {
        this.redis = redisClient;
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
    }

    async isAllowed(key) {
        const redisKey = `sliding:${key}`;
        const now = Date.now();

        try {
            const count = await this.redis.slidingWindowIncrement(
                redisKey,
                now,
                this.windowMs,
            );

            return {
                allowed: count <= this.maxRequests,
                limit: this.maxRequests,
                remaining: Math.max(0, this.maxRequests - count),
                reset: now + this.windowMs,
            };
        } catch (error) {
            console.error("Sliding window error:", error);
            return {
                allowed: true,
                limit: this.maxRequests,
                remaining: this.maxRequests,
                reset: now + this.windowMs,
                error: true,
            };
        }
    }
}

module.exports = SlidingWindowLimiter;
