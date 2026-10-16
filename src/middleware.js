const FixedWindowLimiter = require("./rate-limiters/fixed-window");
const SlidingWindowLimiter = require("./rate-limiters/sliding-window");
const TokenBucketLimiter = require("./rate-limiters/token-bucket");
const redis = require("./redis");

// Initialize rate limiters
const loginLimiter = new FixedWindowLimiter(redis, 5, 60000); // 5 req/min
const searchLimiter = new SlidingWindowLimiter(redis, 10, 60000); // 10 req/min
const dataLimiter = new TokenBucketLimiter(redis, 100, 10); // 100 tokens, 10/sec refill

function addRateLimitHeaders(res, result) {
    res.set("X-RateLimit-Limit", result.limit);
    res.set("X-RateLimit-Remaining", result.remaining);
    res.set("X-RateLimit-Reset", Math.ceil(result.reset / 1000));

    if (result.error) {
        res.set("X-RateLimit-Error", "true");
    }
}

function rateLimitMiddleware(limiter, keyExtractor) {
    return async (req, res, next) => {
        const key = keyExtractor(req);
        const result = await limiter.isAllowed(key);

        addRateLimitHeaders(res, result);

        if (!result.allowed) {
            return res.status(429).json({
                error: "Too Many Requests",
                message: "Rate limit exceeded",
                retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
            });
        }

        next();
    };
}

// Specific middleware for different endpoints
const loginRateLimit = rateLimitMiddleware(
    loginLimiter,
    (req) => `login:${req.ip}`,
);

const searchRateLimit = rateLimitMiddleware(
    searchLimiter,
    (req) => `search:${req.ip}`,
);

const dataRateLimit = rateLimitMiddleware(
    dataLimiter,
    (req) => `data:${req.headers.authorization || req.ip}`,
);

module.exports = {
    loginRateLimit,
    searchRateLimit,
    dataRateLimit,
};
