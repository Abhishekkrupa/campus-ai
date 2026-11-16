const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toString = (value, maxLen = 500) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
};

const toEnum = (value, allowed, fallback) => {
  if (typeof value !== 'string') return fallback;
  return allowed.includes(value) ? value : fallback;
};

const toInt = (value, { min = 1, max = 1000, def = 1 } = {}) => {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
};

module.exports = { escapeRegExp, toString, toEnum, toInt };