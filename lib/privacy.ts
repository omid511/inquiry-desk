export function retentionDays() { const days = Number(process.env.RETENTION_DAYS || 365); return Number.isInteger(days) && days > 0 && days <= 3650 ? days : 365; }
export function retentionCutoff(now = Date.now()) { return new Date(now - retentionDays() * 24 * 60 * 60 * 1000).toISOString(); }
export function redactForLog(value: string, max = 120) { return `[redacted:${Math.min(value.length, max)}]`; }
