import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { userInfo } from 'node:os';

// Only this app's own OAuth connection is read/written. No browser/Codex tokens.
export function createChatGPTStore({ dataRoot, platform = process.platform, env = process.env, exists = existsSync, execute = spawnSync, accountHome = () => userInfo().homedir }) {
  const service = env.CHATGPT_KEYCHAIN_SERVICE || 'ShortCut Studio ChatGPT', account = 'default';
  const helper = env.CHATGPT_CREDENTIAL_HELPER || '';
  const filename = (platform === 'win32' ? path.win32 : path).join(dataRoot, 'chatgpt-credentials.dpapi');
  const available = platform === 'darwin' ? exists('/usr/bin/security') : platform === 'win32' && Boolean(helper && exists(helper));
  function invoke(operation, credentials) {
    if (!available) throw new Error('Bản app chưa có kho lưu phiên ChatGPT cho hệ điều hành này. Hãy cập nhật app.');
    const options = { encoding: 'utf8', timeout: 8_000, maxBuffer: 1024 * 1024, windowsHide: true };
    if (platform === 'win32') {
      // Tokens travel only over a private pipe, never argv, shell or logs.
      return execute(helper, [operation, filename], { ...options, input: credentials === undefined ? undefined : JSON.stringify(credentials) });
    }
    // Only the OS credential subprocess uses the real logged-in account HOME.
    // All media/tools/browser children retain the isolated DEV HOME. Service
    // namespace remains DEV-specific: no lookup of production credentials.
    options.env = { ...env, HOME: accountHome(), CFFIXED_USER_HOME: accountHome() };
    if (operation === 'write') {
      const probe = execute('/usr/bin/security', ['default-keychain', '-d', 'user'], options);
      if (probe.error || probe.status !== 0 || !probe.stdout?.trim()) throw new Error('Không tìm thấy Keychain mặc định của tài khoản macOS. Mở Keychain Access kiểm tra login keychain; app không tạo/reset/đổi Keychain.');
    }
    const args = operation === 'read'  ? ['find-generic-password', '-a', account, '-s', service, '-w']
      : operation === 'delete' ? ['delete-generic-password', '-a', account, '-s', service]
      : ['add-generic-password', '-a', account, '-s', service, '-U', '-X', Buffer.from(JSON.stringify(credentials)).toString('hex'), '-T', '/usr/bin/security'];
    return execute('/usr/bin/security', args, options);
  }
  return {
    available,
    read() {
      if (!available) return null;
      const result = invoke('read');
      if (platform === 'darwin' && result.status === 44) return null;
      if (result.error || result.status !== 0) throw new Error('Không đọc được phiên ChatGPT đã lưu. Hãy Disconnect rồi đăng nhập lại trên máy này.');
      try {
        const value = JSON.parse(result.stdout.trim());
        if (value !== null && (typeof value !== 'object' || Array.isArray(value))) throw new Error();
        return value;
      } catch { throw new Error('Dữ liệu phiên ChatGPT bị hỏng. Hãy Disconnect rồi đăng nhập lại.'); }
    },
    write(credentials) {
      const result = invoke('write', credentials);
      if (result.error || result.status !== 0) throw new Error('Không lưu được phiên ChatGPT vào kho bảo vệ của máy này.');
    },
    delete() {
      if (!available) return false;
      const result = invoke('delete');
      if (platform === 'darwin' && result.status === 44) return false;
      if (result.error || result.status !== 0) throw new Error('Không xóa được phiên ChatGPT đã lưu.');
      return true;
    },
  };
}
