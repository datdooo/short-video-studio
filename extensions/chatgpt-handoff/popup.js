const channel = "shortcut-studio-chatgpt-handoff-v1";
const providerSelect = document.querySelector("#provider");
const tabsSelect = document.querySelector("#tabs");
const selectButton = document.querySelector("#select");
const forgetButton = document.querySelector("#forget");
const status = document.querySelector("#status");
let busy=false, revision=0;
const origins={"chatgpt-web":"https://chatgpt.com",gemini:"https://gemini.google.com",muse:"https://muse.ai"};
function validUrl(value,provider){try{const u=new URL(value);if(u.origin!==origins[provider])return false;
 if(provider==='chatgpt-web')return u.pathname==='/'||/^\/c\/[a-zA-Z0-9-]+\/?$/.test(u.pathname);
 if(provider==='gemini')return /^\/app(?:\/[a-zA-Z0-9_-]+)?\/?$/.test(u.pathname);
 return u.pathname==='/'||/^\/thread\/[a-zA-Z0-9_-]+\/?$/.test(u.pathname);
}catch{return false;}}
async function refresh(){
 const current=++revision,provider=providerSelect.value;
 const [tabs,stored]=await Promise.all([chrome.tabs.query({url:`${origins[provider]}/*`}),chrome.storage.session.get(['selected-web-ai-tabs','selected-chatgpt-tab'])]);
 if(current!==revision)return;
 tabsSelect.replaceChildren();
 const available=tabs.filter(tab=>tab.status==='complete'&&validUrl(tab.url,provider));
 const binding=stored['selected-web-ai-tabs']?.[provider]||(provider==='chatgpt-web'?stored['selected-chatgpt-tab']:null);
 for(const tab of available){const option=document.createElement('option');option.value=String(tab.id);option.textContent=`${tab.title||providerSelect.selectedOptions[0].textContent} · tab ${tab.id}`;option.selected=tab.id===binding?.tabId;tabsSelect.append(option);}
 selectButton.disabled=busy||!available.length;
 status.textContent=!available.length?'Mở website và đăng nhập trong trình duyệt này trước.':available.length===1?'Studio có thể tự nối tab này.':'Có nhiều tab: chọn tab dùng để phân tích.';
}
providerSelect.addEventListener('change',()=>{void refresh().catch(()=>{status.textContent='Không đọc được danh sách tab.';});});
selectButton.addEventListener('click',()=>{
 if(busy||!tabsSelect.value)return;busy=true;selectButton.disabled=true;forgetButton.disabled=true;providerSelect.disabled=true;
 void chrome.runtime.sendMessage({channel,type:'select-tab',provider:providerSelect.value,tabId:Number(tabsSelect.value)})
 .then(response=>{status.textContent=response?.message||'Chưa xác nhận được tab.';})
 .catch(()=>{status.textContent='Không liên kết được tab. Mở lại extension.';})
 .finally(()=>{busy=false;selectButton.disabled=!tabsSelect.value;forgetButton.disabled=false;providerSelect.disabled=false;});
});
forgetButton.addEventListener('click',()=>{
 if(busy)return;busy=true;selectButton.disabled=true;forgetButton.disabled=true;providerSelect.disabled=true;
 void chrome.runtime.sendMessage({channel,type:'forget-tab',provider:providerSelect.value})
 .then(response=>{status.textContent=response?.ok?'Đã ngắt tab đã chọn. Lượt sau sẽ tự tìm tab phù hợp.':response?.message||'Chưa xác nhận được trạng thái ngắt.';})
 .catch(()=>{status.textContent='Không ngắt được tab. Mở lại extension.';})
 .finally(()=>{busy=false;selectButton.disabled=!tabsSelect.value;forgetButton.disabled=false;providerSelect.disabled=false;});
});
void refresh().catch(()=>{status.textContent='Không đọc được danh sách tab.';selectButton.disabled=true;});
