import { mkdir, chmod, copyFile, writeFile, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';

// The app reads this configuration on every request, so no restart is needed.
const root = path.resolve(process.env.MEDIA_WORKER_DATA_DIR || path.join(homedir(), 'Library/Application Support/ShortCut Studio/media'));
const [option, value] = process.argv.slice(2);
const privateRoot = path.join(root, 'youtube-private');
const configPath = path.join(root, 'youtube-download.json');
try {
  let config;
  if (option === '--browser' && /^(chrome|chromium|firefox|edge|brave|safari|opera|vivaldi)(?::[^\r\n]+)?$/.test(value || '')) config = { cookiesFromBrowser: value };
  else if (option === '--file' && value) {
    const input = await readFile(path.resolve(value), 'utf8');
    if (!/^# (?:Netscape HTTP Cookie File|HTTP Cookie File)/m.test(input)) throw new Error('File cần dùng định dạng Netscape cookies.txt, không phải JSON hoặc Cookie header.');
    await mkdir(privateRoot, { recursive: true, mode: 0o700 }); await chmod(privateRoot, 0o700);
    const target = path.join(privateRoot, 'cookies.txt');
    await copyFile(path.resolve(value), target); await chmod(target, 0o600);
    config = { cookiesFile: target };
  } else if (option === '--clear') config = {};
  else throw new Error('Dùng --browser chrome (hoặc firefox), --file /đường/dẫn/cookies.txt, hoặc --clear.');
  await mkdir(root, { recursive: true });
  await writeFile(configPath, JSON.stringify(config), { mode: 0o600 }); await chmod(configPath, 0o600);
  if (!config.cookiesFile) await rm(path.join(privateRoot, 'cookies.txt'), { force: true });
  console.log(option === '--clear' ? 'Đã bỏ cấu hình và bản sao cookie riêng của app.' : 'Đã lưu cấu hình cookie local. Không cần khởi động lại app.');
} catch (error) {
  // Never print an OS error, which might include private file names/content.
  console.error(error.code ? 'Không đọc/ghi được cấu hình cookie. Kiểm tra quyền truy cập.' : error.message);
  process.exitCode = 1;
}
