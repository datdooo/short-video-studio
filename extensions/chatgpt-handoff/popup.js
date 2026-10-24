const channel = "shortcut-studio-chatgpt-handoff-v1";
const tabsSelect = document.querySelector("#tabs");
const selectButton = document.querySelector("#select");
const forgetButton = document.querySelector("#forget");
const status = document.querySelector("#status");
let busy = false;
function validUrl(value) { try { const url = new URL(value); return url.origin === "https://chatgpt.com" && (url.pathname === "/" || /^\/c\/[a-zA-Z0-9-]+\/?$/.test(url.pathname)); } catch { return false; } }
async function refresh() {
  const [tabs, stored] = await Promise.all([chrome.tabs.query({ url: "https://chatgpt.com/*" }), chrome.storage.session.get("selected-chatgpt-tab")]);
  tabsSelect.replaceChildren();
  const available = tabs.filter((tab) => tab.status === "complete" && validUrl(tab.url));
  for (const tab of available) {
    const option = document.createElement("option"); option.value = String(tab.id);
    option.textContent = `${tab.title || "ChatGPT"} · tab ${tab.id}`;
    option.selected = tab.id === stored["selected-chatgpt-tab"]?.tabId;
    tabsSelect.append(option);
  }
  selectButton.disabled = available.length === 0;
  status.textContent = available.length === 0 ? "Mở ChatGPT và đăng nhập trong trình duyệt này trước." : stored["selected-chatgpt-tab"] ? "Đã có tab liên kết. Đổi cuộc trò chuyện hoặc tải lại tab thì cần chọn lại." : "Chưa liên kết tab.";
}
selectButton.addEventListener("click", () => {
  if (busy || !tabsSelect.value) return; busy = true; selectButton.disabled = true;
  void chrome.runtime.sendMessage({ channel, type: "select-tab", tabId: Number(tabsSelect.value) })
    .then((response) => { status.textContent = response?.message || "Chưa xác nhận được tab."; })
    .catch(() => { status.textContent = "Không liên kết được tab. Mở lại extension."; })
    .finally(() => { busy = false; selectButton.disabled = !tabsSelect.value; });
});
forgetButton.addEventListener("click", () => {
  if (busy) return; busy = true;
  void chrome.runtime.sendMessage({ channel, type: "forget-tab" }).then((response) => { status.textContent = response?.ok ? "Đã ngắt liên kết." : response?.message || "Chưa xác nhận được trạng thái ngắt liên kết."; })
    .catch(() => { status.textContent = "Không ngắt được liên kết. Mở lại extension."; }).finally(() => { busy = false; });
});
void refresh().catch(() => { status.textContent = "Không đọc được danh sách tab."; selectButton.disabled = true; });
