// Simple in-memory blacklist (for demo)
// In production, use Redis
const blacklist = new Set();

const addToBlacklist = (token) => {
    blacklist.add(token);
    // Auto remove after 7 days
    setTimeout(() => blacklist.delete(token), 7 * 24 * 60 * 60 * 1000);
};

const isBlacklisted = (token) => {
    return blacklist.has(token);
};

module.exports = { addToBlacklist, isBlacklisted };