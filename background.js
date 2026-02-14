let isAnalyzing = false;
let debugEnabled = false;

// Твоите оригинални модели
const MODELS = ["gemini-2.5-flash", "gemini-1.5-flash"];

const prompts = {
  bg: "Анализирай следния текст за риск от цензура във Facebook. ЗАДЪЛЖИТЕЛНО започни отговора си с 'Риск: XX%'. Отговори на български език: ",
  en: "Analyze the following text for Facebook censorship risk. MUST start your response with 'Risk: XX%'. Answer in English: "
};

function setupMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.storage.local.get(['lang'], (data) => {
      const lang = data.lang || 'bg';
      const title = (lang === 'en') ? "FB Holopost: Analyze" : "FB Holopost: Анализирай";
      chrome.contextMenus.create({ id: "analyze-content", title: title, contexts: ["all"] });
    });
  });
}

chrome.runtime.onInstalled.addListener(setupMenu);
chrome.runtime.onStartup.addListener(setupMenu);
chrome.storage.onChanged.addListener((changes) => { if (changes.lang) setupMenu(); });

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "analyze-content" && !isAnalyzing) {
    startAnalysis(info, tab);
  }
});

async function startAnalysis(info, tab) {
  isAnalyzing = true;
  const data = await chrome.storage.local.get(['key1', 'key2', 'key3', 'lang']);
  const lang = data.lang || 'bg';

  const rawKeys = [
    { val: data.key1?.trim(), id: 1 },
    { val: data.key2?.trim(), id: 2 },
    { val: data.key3?.trim(), id: 3 }
  ];

  debugEnabled = rawKeys.some(k => k.val === "debuglogtrue");
  const validKeys = rawKeys.filter(k => k.val && k.val.length > 20 && k.val !== "debuglogtrue");

  if (validKeys.length === 0) {
    const msg = (lang === 'en' ? "⚠️ Missing API Key!" : "⚠️ Липсва API ключ!");
    chrome.tabs.sendMessage(tab.id, { action: "show_result", text: msg, color: "orange", missingKey: true, lang: lang });
    isAnalyzing = false;
    return;
  }

chrome.tabs.sendMessage(tab.id, { action: "get_content" }, (response) => {
if (chrome.runtime.lastError || !response || response.type === "none") {
isAnalyzing = false;
return;
}
chrome.tabs.sendMessage(tab.id, { action: "show_loading", lang: lang });
processCall(response, validKeys, tab.id, 0, lang);
});
}

async function processCall(content, keys, tabId, kIdx, lang) {
  if (kIdx >= keys.length) {
    const msg = (lang === 'en' ? "❌ All keys exhausted!" : "❌ Всички ключове са блокирани!");
    chrome.tabs.sendMessage(tabId, { action: "show_result", text: msg, color: "red", lang: lang });
    isAnalyzing = false;
    return;
  }

  const currentKeyObj = keys[kIdx];
  const lockKey = `lock_key${currentKeyObj.id}`;
  const lockData = await chrome.storage.local.get([lockKey]);

  if (lockData[lockKey] && lockData[lockKey] > Date.now()) {
    return processCall(content, keys, tabId, kIdx + 1, lang);
  }

  // Запазваме отбелязването на активния ключ (зеления маркер)
  chrome.storage.local.set({ active_key_index: currentKeyObj.id });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS[0]}:generateContent?key=${currentKeyObj.val}`;
  
  if (debugEnabled) {
    chrome.tabs.sendMessage(tabId, { action: "debug_msg", log: `Using Key ID: ${currentKeyObj.id}` });
    chrome.tabs.sendMessage(tabId, { action: "debug_msg", log: `URL: ${url}` });
  }

  let payload;
  if (content.type === "text") {
    payload = { contents: [{ parts: [{ text: prompts[lang] + content.data }] }] };
  } else if (content.type === "image") {
    payload = {
      contents: [{
        parts: [
          { text: prompts[lang] },
          { inline_data: { mime_type: content.mime, data: content.data } }
        ]
      }]
    };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const resData = await response.json();

    if (debugEnabled) {
      chrome.tabs.sendMessage(tabId, { action: "debug_msg", log: `Status: ${response.status}` });
    }

    if (response.status === 429) {
      let sec = 60;
      const m = (resData.error?.message || "").match(/retry in ([\d\.]+)s/);
      if (m) sec = parseFloat(m[1]);
      await chrome.storage.local.set({ [lockKey]: Date.now() + (sec * 1000) });
      return processCall(content, keys, tabId, kIdx + 1, lang);
    }

    if (response.ok && resData.candidates) {
      const resultText = resData.candidates[0].content.parts[0].text;
      const match = resultText.match(/(?:Риск|Risk):\s*(\d+)%/i);
      const p = match ? parseInt(match[1]) : 0;
      let color = p >= 85 ? "#d93025" : (p >= 45 ? "#f9ab00" : "#28a745");
      chrome.tabs.sendMessage(tabId, { action: "show_result", text: resultText, color: color, lang: lang });
    } else {
      let errText = resData.error?.message || "API Error";
      chrome.tabs.sendMessage(tabId, { action: "show_result", text: "❌ " + errText, color: "red", lang: lang });
    }
  } catch (e) {
    if (debugEnabled) chrome.tabs.sendMessage(tabId, { action: "debug_msg", log: `Fetch Error: ${e.message}` });
    return processCall(content, keys, tabId, kIdx + 1, lang);
  } finally {
    isAnalyzing = false;
  }
}