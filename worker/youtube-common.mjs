export function youtubeUrl(value) {
  const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (!['youtube.com', 'm.youtube.com', 'youtu.be'].includes(host) || !['http:', 'https:'].includes(url.protocol)) throw new Error('URL phải thuộc YouTube.');
  const parts = url.pathname.split('/').filter(Boolean);
  const id = host === 'youtu.be' ? parts[0] : url.searchParams.get('v') || (['shorts', 'embed', 'live'].includes(parts[0]) ? parts[1] : '');
  if (!/^[\w-]{11}$/.test(id || '')) throw new Error('Không tìm thấy YouTube video ID hợp lệ.');
  return { id, url: `https://www.youtube.com/watch?v=${id}` };
}

// Only fixed messages leave the downloader. Raw errors can contain signed URLs,
// cookie paths, headers or credential values from an upstream library.
export function youtubeFailure(error) {
  if(error?.code==='MEDIA_PROBE_TIMEOUT')return 'Kiểm tra video quá 30 giây. Thử chuẩn bị nguồn lại sau.';
  if(error?.code==='MEDIA_PROBE_BUSY')return 'Đang có nhiều lượt kiểm tra video. Thử lại sau.';
  const value = String(error?.message || error);
  if ([
    'YouTube yêu cầu xác thực hoặc cookie trình duyệt chưa đọc được',
    'Video không khả dụng, riêng tư hoặc bị giới hạn truy cập',
    'Hết thời gian chờ', 'Lỗi mạng/DNS khi kết nối YouTube',
    'File tải về thiếu hình/âm thanh hoặc không hợp lệ',
    'Thiếu công cụ tải/FFmpeg', 'YouTube từ chối yêu cầu hoặc giới hạn tần suất',
    'Không lấy được dữ liệu/định dạng tương thích từ YouTube',
    'macOS chặn quyền đọc cookie Chrome. Cấp Full Disk Access cho ShortCut Studio trong System Settings > Privacy & Security, mở lại app; hoặc dùng file cookies.txt của YouTube',
    'Không đọc được database cookie trình duyệt. Kiểm tra đúng profile Chrome và quyền Full Disk Access, hoặc dùng file cookies.txt',
  ].includes(value)) return value;
  if (/Chrome cookie database permission denied|(?:cookie|chrome).*(?:EPERM|operation not permitted|permission denied)/i.test(value)) return 'macOS chặn quyền đọc cookie Chrome. Cấp Full Disk Access cho ShortCut Studio trong System Settings > Privacy & Security, mở lại app; hoặc dùng file cookies.txt của YouTube';
  if (/could not find.*cookies database/i.test(value)) return 'Không đọc được database cookie trình duyệt. Kiểm tra đúng profile Chrome và quyền Full Disk Access, hoặc dùng file cookies.txt';
  if (/bot|sign in|login.required|authentication|confirm your age|cookies|cookie|keychain|decrypt|xác thực/i.test(value)) return 'YouTube yêu cầu xác thực hoặc cookie trình duyệt chưa đọc được';
  if (/private|unavailable|removed|copyright|not available|not playable|unplayable|geo/i.test(value)) return 'Video không khả dụng, riêng tư hoặc bị giới hạn truy cập';
  if (/timeout|timed out|abort/i.test(value)) return 'Hết thời gian chờ';
  if (/ENOTFOUND|EAI_AGAIN|nodename|network|fetch failed|ECONN|DNS|Lỗi mạng/i.test(value)) return 'Lỗi mạng/DNS khi kết nối YouTube';
  if (/audio|video stream|media validation/i.test(value)) return 'File tải về thiếu hình/âm thanh hoặc không hợp lệ';
  if (/ENOENT|ERR_MODULE_NOT_FOUND|Cannot find package|not installed|missing tool/i.test(value)) return 'Thiếu công cụ tải/FFmpeg';
  if (/403|429|forbidden/i.test(value)) return 'YouTube từ chối yêu cầu hoặc giới hạn tần suất';
  return 'Không lấy được dữ liệu/định dạng tương thích từ YouTube';
}

export function cookieHeader(netscape) {
  return netscape.split(/\r?\n/).flatMap((line) => {
    if (line.startsWith('#HttpOnly_')) line = line.slice(10);
    else if (line.startsWith('#')) return [];
    const fields = line.split('\t');
    if (fields.length !== 7) return [];
    const [domain, , , , expires, name, value] = fields;
    if (!/(^|\.)youtube\.com$/i.test(domain.replace(/^\./, '')) || (+expires && +expires < Date.now() / 1000) || !/^[!#$%&'*+.^_`|~\w-]+$/.test(name) || /[\r\n;]/.test(value)) return [];
    return [`${name}=${value}`];
  }).join('; ');
}

export async function fallback(attempts, execute, signal) {
  const failures = [];
  for (const attempt of attempts) {
    signal?.throwIfAborted();
    try { return await execute(attempt); }
    catch (error) {
      signal?.throwIfAborted();
      // A local bounded probe failure is not an authentication/format failure.
      // Do not redownload the same media through every fallback engine.
      if(['MEDIA_PROBE_TIMEOUT','MEDIA_PROBE_BUSY'].includes(error?.code))throw Object.assign(new Error(youtubeFailure(error)),{code:error.code,status:error.status});
      failures.push(`${attempt.label}: ${youtubeFailure(error)}`);
    }
  }
  throw new Error(`Không thể lấy video YouTube. ${failures.join('. ')}. Hãy thử mở video trên trình duyệt, kiểm tra mạng và cập nhật yt-dlp. Nếu bị xác minh bot, cấu hình cookie từ Chrome/Firefox đã đăng nhập hoặc file cookies.txt (Netscape), rồi thử lại. Cookie không đảm bảo vượt mọi giới hạn của YouTube.`);
}
