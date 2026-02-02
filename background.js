let lastPendingRequest = null;
const MODELS = ["gemini-2.5-flash", "gemini-1.5-flash"];

const prompts = {
  bg: "Анализирай следния текст за риск от цензура във Facebook. ЗАДЪЛЖИТЕЛНО започни отговора си с 'Риск: XX%'. Отговори на български език: ",
  en: "Analyze the following text for Facebook censorship risk. MUST start your response with 'Risk: XX%'. Answer in English: "
};

function updateMenuTitle() {
  chrome.storage.local.get(['lang'], (data) => {
    const lang = data.lang || 'bg';
    const title = (lang === 'en') ? "FB Holopost: Analyze" : "FB Holopost: Анализирай";
    chrome.contextMenus.update("analyze-content", { title: title });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "analyze-content", title: "FB Holopost: Анализирай", contexts: ["selection"] });
  updateMenuTitle();
});

chrome.storage.onChanged.addListener((changes) => { if (changes.lang) updateMenuTitle(); });

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "analyze-content") {
    chrome.storage.local.get(['key1', 'key2', 'key3', 'lang'], function(data) {
      const keys = [data.key1, data.key2, data.key3].filter(k => k && k.trim() !== "");
      const lang = data.lang || 'bg';

      if (keys.length > 0) {
        chrome.tabs.sendMessage(tab.id, { action: "show_loading", lang: lang });
        callAI(prompts[lang] + info.selectionText, keys, tab.id, 0, 0, lang);
      } else {
        chrome.tabs.sendMessage(tab.id, { 
            action: "show_result", 
            text: (lang === 'en' ? "⚠️ No API keys found!" : "⚠️ Не са намерени API ключове!"), 
            color: "red", lang: lang 
        });
      }
    });
  }
});

async function callAI(prompt, keys, tabId, keyIndex, modelIndex, lang) {
  // АКО СМЕ ИЗЧЕРПАЛИ ВСИЧКИ КЛЮЧОВЕ
  if (keyIndex >= keys.length) {
    chrome.tabs.sendMessage(tabId, { 
        action: "show_result", 
        text: (lang === 'en' ? "❌ No active keys available!" : "❌ Няма активни ключове в момента!"), 
        color: "red", lang: lang 
    });
    return;
  }

  const storageKey = `lock_key${keyIndex + 1}`;
  const lockData = await chrome.storage.local.get([storageKey]);
  
  // Проверка дали текущият ключ е блокиран
  if (lockData[storageKey] && lockData[storageKey] > Date.now()) {
    console.log(`Ключ ${keyIndex + 1} е блокиран. Пробвам следващия...`);
    return callAI(prompt, keys, tabId, keyIndex + 1, 0, lang);
  }

  // Маркираме активния ключ
  chrome.storage.local.set({ active_key_index: keyIndex + 1 });

  const currentModel = MODELS[modelIndex] || MODELS[0];
  const url = `https://generativelanguage.googleapis.com/v1/models/${currentModel}:generateContent?key=${keys[keyIndex]}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const resData = await response.json();

    if (response.status === 429) {
      let seconds = 60;
      const waitMatch = (resData.error?.message || "").match(/retry in ([\d\.]+)s/);
      if (waitMatch) seconds = parseFloat(waitMatch[1]);

      await chrome.storage.local.set({ [storageKey]: Date.now() + (seconds * 1000) });

      // Продължаваме към следващия ключ
      return callAI(prompt, keys, tabId, keyIndex + 1, 0, lang);
    }

    if (response.ok && resData.candidates) {
      const resultText = resData.candidates[0].content.parts[0].text;
      const match = resultText.match(/(?:Риск|Risk):\s*(\d+)%/i);
      const p = match ? parseInt(match[1]) : 0;
      let color = p >= 85 ? "#d93025" : (p >= 45 ? "#f9ab00" : "#28a745");
      chrome.tabs.sendMessage(tabId, { action: "show_result", text: resultText, color: color, lang: lang });
    } else {
      // При друга грешка също пробваме следващия ключ
      return callAI(prompt, keys, tabId, keyIndex + 1, 0, lang);
    }
  } catch (e) {
    return callAI(prompt, keys, tabId, keyIndex + 1, 0, lang);
  }
}