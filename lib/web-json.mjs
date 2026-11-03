function syntaxPosition(text) {
  let i = 0;
  const fail = () => {
      throw i;
    },
    space = () => {
      while (/[ \t\r\n]/.test(text[i] || "!")) i++;
    };
  function string() {
    if (text[i++] !== '"') fail();
    while (i < text.length) {
      const c = text[i++];
      if (c === '"') return;
      if (c.charCodeAt(0) < 32) {
        i--;
        fail();
      }
      if (c === "\\") {
        const e = text[i++];
        if (e === "u") {
          if (!/^[a-f0-9]{4}$/i.test(text.slice(i, i + 4))) fail();
          i += 4;
        } else if (!'"\\/bfnrt'.includes(e || "!")) {
          i--;
          fail();
        }
      }
    }
    fail();
  }
  function value(depth = 0) {
    space();
    if (depth > 512) fail();
    const c = text[i];
    if (c === '"') {
      string();
      return;
    }
    if (c === "{" || c === "[") {
      const object = c === "{",
        close = object ? "}" : "]";
      i++;
      space();
      if (text[i] === close) {
        i++;
        return;
      }
      while (i < text.length) {
        if (object) {
          space();
          if (text[i] !== '"') fail();
          string();
          space();
          if (text[i++] !== ":") {
            i--;
            fail();
          }
        }
        value(depth + 1);
        space();
        if (text[i] === close) {
          i++;
          return;
        }
        if (text[i++] !== ",") {
          i--;
          fail();
        }
      }
      fail();
    }
    for (const literal of ["true", "false", "null"])
      if (text.startsWith(literal, i)) {
        i += literal.length;
        return;
      }
    const n = text.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (n) {
      i += n[0].length;
      return;
    }
    fail();
  }
  try {
    value();
    space();
    if (i !== text.length) fail();
  } catch (position) {
    return typeof position === "number" ? Math.min(position, text.length) : i;
  }
  return i;
}
// Clipboard envelope handling only. Never repair quotes, commas, fields or values.
export function parseWebJson(raw, provider = "AI") {
  if (typeof raw !== "string" || !raw.trim()) throw Error(`Dán JSON từ ${provider} trước.`);
  if (raw.length > 2 * 1024 * 1024) throw Error("JSON quá lớn (tối đa 2 MB). Chỉ dán kết quả JSON.");
  const offset = raw.search(/[\[{]/);
  if (offset < 0) throw Error(`Không tìm thấy JSON từ ${provider}. Dán toàn bộ object kết quả.`);
  let normalized = "",
    quoted = false,
    escaped = false;
  for (const c of raw.slice(offset)) {
    if (quoted) {
      normalized += c;
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
    } else if (c === '"') {
      quoted = true;
      normalized += c;
    } else if (c === "\u00a0") normalized += " ";
    else if (!/[\u200b\u200c\u200d\u2060\ufeff]/u.test(c)) normalized += c;
  }
  // A code fence can be inline or multiline. Prose outside the object is ignored;
  // more than one root value is ambiguous and is never selected arbitrarily.
  const start = 0;
  let end = -1;
  const stack = [];
  quoted = false;
  escaped = false;
  for (let i = start; i < normalized.length; i++) {
    const c = normalized[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') {
      quoted = true;
      continue;
    }
    if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") {
      const open = stack.pop();
      if (open !== (c === "}" ? "{" : "[")) {
        end = i + 1;
        break;
      }
      if (!stack.length) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0)
    throw Object.assign(
      Error(
        `JSON từ ${provider} có vẻ bị cắt cụt hoặc thiếu dấu đóng. Lấy lại toàn bộ câu trả lời; bản cắt hiện tại được giữ.`,
      ),
      { code: "WEB_JSON_INCOMPLETE" },
    );
  if (/[\[{]/.test(normalized.slice(end)))
    throw Error("Có nhiều khối JSON hoặc dấu ngoặc ngoài kết quả. Chỉ dán một object đầy đủ.");
  const text = normalized.slice(start, end);
  try {
    return JSON.parse(text);
  } catch (error) {
    const match = String(error.message).match(/position (\d+)/);
    const pos = match ? Number(match[1]) : syntaxPosition(text);
    const lines = text.slice(0, pos).split(/\r\n|\r|\n/),
      location = ` tại dòng ${lines.length}, cột ${lines.at(-1).length + 1}`;
    throw Object.assign(
      Error(
        `JSON từ ${provider} sai cú pháp${location}. Kiểm tra dấu nháy thẳng, dấu phẩy và ngoặc; app không tự sửa nội dung.`,
      ),
      { code: "WEB_JSON_SYNTAX" },
    );
  }
}
