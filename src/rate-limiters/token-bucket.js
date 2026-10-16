class TokenBucketLimiter {
    constructor(redisClient, maxTokens, refillRate) {
        this.redis = redisClient;
        this.maxTokens = maxTokens;
        this.refillRate = refillRate; // tokens per second
    }

    async isAllowed(key) {
        const tokenKey = `bucket:${key}:tokens`;
        const refillKey = `bucket:${key}:refill`;

        try {
            const currentTokens = await this.redis.tokenBucket(
                tokenKey,
                this.refillRate,
                this.maxTokens,
                refillKey,
            );

            const allowed = currentTokens >= 1;

            if (allowed) {
                // Consume one token
                await this.redis.client.decr(tokenKey);
            }

            return {
                allowed,
                limit: this.maxTokens,
                remaining: Math.floor(
                    allowed ? currentTokens - 1 : currentTokens,
                ),
                reset: Date.now() + (this.maxTokens / this.refillRate) * 1000,
            };
        } catch (error) {
            console.error("Token bucket error:", error);
            return {
                allowed: true,
                limit: this.maxTokens,
                remaining: this.maxTokens,
                reset: Date.now() + (this.maxTokens / this.refillRate) * 1000,
                error: true,
            };
        }
    }
}

module.exports = TokenBucketLimiter;
