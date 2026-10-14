// One allocator per worker/app session. Reloading the web page does not reset it.
export function createExportNameAllocator() {
  const counters = new Map();
  return {
    reserve(prefix, partCount = 2) {
      if (!/^[a-z]{2}$/.test(prefix) || partCount !== 2) throw new Error("Mã ngôn ngữ hoặc số part không hợp lệ.");
      const index = (counters.get(prefix) || 0) + 1;
      if (index > 240) throw new Error(`Tên ${prefix} đã quá dài sau 240 video. Mở lại app để bắt đầu phiên mới.`);
      counters.set(prefix, index);
      return [1, 2].map((part) => `${prefix}${String(part).repeat(index)}.mp4`);
    },
  };
}
