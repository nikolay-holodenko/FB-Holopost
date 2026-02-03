let isAnalyzing = false;
let debugEnabled = false;

// Твоите оригинални модели от v1.1
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
      // Променяме contexts на "all", за да хваща и снимки в бъдеще, но логиката долу решава какво да прави
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

  // Запазваме връзката между стойност и номер на ключа (ID)
  const rawKeys = [
    { val: data.key1?.trim(), id: 1 },
    { val: data.key2?.trim(), id: 2 },
    { val: data.key3?.trim(), id: 3 }
  ];

  // Проверка за дебъг режим
  debugEnabled = rawKeys.some(k => k.val === "debuglogtrue");
  
  // Филтриране: Махаме празните и debug фразата. Остават само истинските.
  const validKeys = rawKeys.filter(k => k.val && k.val.length > 20 && k.val !== "debuglogtrue");

  if (debugEnabled) {
    chrome.tabs.sendMessage(tab.id, { 
      action: "debug_msg", 
      log: `Start Analysis. Found ${validKeys.length} valid keys.` 
    });
  }

  if (validKeys.length === 0) {
    const msg = (lang === 'en' ? "⚠️ Missing API Key!" : "⚠️ Липсва API ключ!");
    chrome.tabs.sendMessage(tab.id, { action: "show_result", text: msg, color: "orange", missingKey: true, lang: lang });
    isAnalyzing = false;
    return;
  }

  // Питаме content.js какво има под мишката
  chrome.tabs.sendMessage(tab.id, { action: "get_content" }, (response) => {
    if (!response || response.type === "none") {
      const msg = (lang === 'en' ? "❌ No content found." : "❌ Не е открито съдържание.");
      chrome.tabs.sendMessage(tab.id, { action: "show_result", text: msg, color: "orange", lang: lang });
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
  const lockKey = `lock_key${currentKeyObj.id}`; // Ползваме оригиналното ID (1, 2 или 3)
  const lockData = await chrome.storage.local.get([lockKey]);

  if (lockData[lockKey] && lockData[lockKey] > Date.now()) {
    if (debugEnabled) chrome.tabs.sendMessage(tabId, { action: "debug_msg", log: `Key ${currentKeyObj.id} is locked. Skipping.` });
    return processCall(content, keys, tabId, kIdx + 1, lang);
  }

  // Маркираме активния ключ (за popup.js)
  chrome.storage.local.set({ active_key_index: currentKeyObj.id });

  // URL - Връщаме се към v1, защото v1beta правеше проблеми с някои модели
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS[0]}:generateContent?key=${currentKeyObj.val}`;
  
  let payload;

  // СТРУКТУРАТА ЗА ТЕКСТ - АБСОЛЮТНО СЪЩАТА КАТО В v1.1
  if (content.type === "text") {
    payload = { 
      contents: [{ parts: [{ text: prompts[lang] + content.data }] }] 
    };
  } 
  // ПОДГОТОВКА ЗА СНИМКИ (Нова логика, изолирана)
  else if (content.type === "image") {
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
    if (debugEnabled) chrome.tabs.sendMessage(tabId, { action: "debug_msg", log: `Sending request with Key ${currentKeyObj.id} to ${MODELS[0]}...` });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const resData = await response.json();

    if (debugEnabled) {
      chrome.tabs.sendMessage(tabId, { action: "debug_msg", log: `Response Status: ${response.status}` });
      if (!response.ok) chrome.tabs.sendMessage(tabId, { action: "debug_msg", log: `Error Body: ${JSON.stringify(resData)}` });
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
      // При техническа грешка (400) не въртим ключовете, а спираме и показваме грешката
      let errText = resData.error?.message || "API Error";
      chrome.tabs.sendMessage(tabId, { action: "show_result", text: "❌ " + errText, color: "red", lang: lang });
    }
  } catch (e) {
    if (debugEnabled) chrome.tabs.sendMessage(tabId, { action: "debug_msg", log: `Network Exception: ${e.message}` });
    return processCall(content, keys, tabId, kIdx + 1, lang);
  } finally {
    isAnalyzing = false;
  }
}