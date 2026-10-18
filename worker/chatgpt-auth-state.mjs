// No tokens or raw provider errors are exposed through auth polling.
export function createAuthAttempts({ now = Date.now, ttl = 600_000 } = {}) {
  const attempts = new Map();
  return {
    add(attempt) {
      for (const [key, value] of attempts) if (now() - value.createdAt >= ttl) attempts.delete(key);
      attempts.set(attempt.state, { ...attempt, createdAt: now(), status: 'pending' });
    },
    get(key) {
      const a = attempts.get(key);
      if (a && now() - a.createdAt >= ttl) { a.status = 'expired'; a.error = 'Phiên đăng nhập hết hạn. Bấm kết nối lại.'; }
      return a;
    },
    take(key) {
      const a = this.get(key);
      if (!a || a.status !== 'pending') throw new Error('Phiên đăng nhập đã dùng/hủy/hết hạn. Bấm kết nối lại.');
      a.status = 'exchanging'; return a;
    },
    finish(key, status, error) { const a = attempts.get(key); if (a) { a.status = status; a.error = error; } },
    public(key) { const a = this.get(key); return a ? { status: a.status, ...(a.error ? { error: a.error } : {}) } : { status: 'expired', error: 'Phiên đăng nhập không còn tồn tại. Bấm kết nối lại.' }; },
    cancel(key) { const a = this.get(key); if (a && ['pending','exchanging'].includes(a.status)) { a.status = 'cancelled'; a.error = 'Đã hủy đăng nhập.'; } },
    cancelAll() { for (const key of attempts.keys()) this.cancel(key); },
  };
}
export function localAuthOrigin(origin) {
  if (!origin) return true; // Native/CLI clients do not send browser origins.
  try { const url = new URL(origin); return url.protocol === 'http:' && ['127.0.0.1','localhost'].includes(url.hostname); } catch { return false; }
}
export function tokenError(body, status) {
  const code = String(body?.error || '');
  if (code === 'invalid_grant' || status === 401) return Object.assign(new Error('AUTH_EXPIRED: Phiên/code không còn hiệu lực. Đăng nhập lại; không cần xoá dữ liệu DEV.'), { status: 401 });
  if (code === 'access_denied') return new Error('Bạn đã hủy cấp quyền ChatGPT.');
  return new Error(`Không trao đổi/refresh được phiên ChatGPT (HTTP ${status}). Thử lại sau; không gửi token hoặc mật khẩu vào báo lỗi.`);
}
export function assertTokenResponse(token) {
  if (typeof token.access_token !== 'string' || !token.access_token || !Number.isFinite(Number(token.expires_in)) || Number(token.expires_in) <= 0) throw new Error('OpenAI trả token thiếu/không hợp lệ; phiên cũ được giữ nguyên.');
}
export function sessionHealth(credentials, now = Date.now()) {
  if (!credentials) return { connected: false, sharing: false, needsSignIn: true };
  const expiry = Date.parse(credentials.expires_at || '');
  const expired = !Number.isFinite(expiry) || expiry <= now;
  return { connected: true, sharing: Boolean(credentials.scopes?.includes('chatgpt.tokens.use.direct')) && !expired,
    needsSignIn: expired, ...(expired ? { error: 'Phiên đã hết hạn. Kết nối lại để tiếp tục.' } : {}) };
}
