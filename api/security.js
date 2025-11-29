// Security headers middleware for all API routes
export const setSecurityHeaders = (res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Content-Security-Policy", "default-src 'self'");
};

// Input sanitization
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/[<>'"]/g, '');
};

// Email validation
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
};

// Rate limiter (in-memory)
const rateLimits = new Map();

export const rateLimit = (key, maxRequests = 100, windowMs = 60000) => {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  let requests = rateLimits.get(key) || [];
  requests = requests.filter(time => time > windowStart);
  
  if (requests.length >= maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((requests[0] + windowMs - now) / 1000) };
  }
  
  requests.push(now);
  rateLimits.set(key, requests);
  
  return { allowed: true };
};

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, requests] of rateLimits.entries()) {
    const filtered = requests.filter(time => time > now - 60000);
    if (filtered.length === 0) {
      rateLimits.delete(key);
    } else {
      rateLimits.set(key, filtered);
    }
  }
}, 60000);
