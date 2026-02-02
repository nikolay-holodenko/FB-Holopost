let lastPendingRequest = null;
const CURRENT_VERSION = "1.1";
const GITHUB_JSON_URL = "https://github.com/nikolay-holodenko/FB-Holopost/version.json";
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
    // 1. ПЪРВО ПРОВЕРЯВАМЕ ЗА ЪПДЕЙТ
    fetch(GITHUB_JSON_URL)
      .then(res => res.json())
      .then(updateData => {
        if (updateData.version !== CURRENT_VERSION && updateData.critical) {
          // КРИТИЧЕН ЪПДЕЙТ - БЛОКИРАМЕ РАБОТАТА
          chrome.tabs.sendMessage(tab.id, { 
            action: "show_update_block", 
            updateUrl: updateData.update_url,
            lang: "bg" // Може да се вземе от сторидж, ако е важно
          });
          return;
        }

        // 2. АКО НЯМА КРИТИЧЕН ЪПДЕЙТ, ПРОДЪЛЖАВАМЕ КЪМ АНАЛИЗА
        runMainLogic(info, tab);
      })
      .catch(() => runMainLogic(info, tab)); // При грешка в GitHub, все пак пускаме анализа
  }
});

function runMainLogic(info, tab) {
  chrome.storage.local.get(['key1', 'key2', 'key3', 'lang'], function(data) {
    const keys = [data.key1, data.key2, data.key3].filter(k => k && k.trim() !== "");
    const lang = data.lang || 'bg';
    if (keys.length > 0) {
      chrome.tabs.sendMessage(tab.id, { action: "show_loading", lang: lang });
      callAI(prompts[lang] + info.selectionText, keys, tab.id, 0, 0, lang);
    } else {
      chrome.tabs.sendMessage(tab.id, { action: "show_result", text: (lang === 'en' ? "⚠️ Missing API Key!" : "⚠️ Липсва API ключ!"), color: "orange", missingKey: true, lang: lang });
    }
  });
}

async function callAI(prompt, keys, tabId, keyIndex, modelIndex, lang) {
  if (keyIndex >= keys.length) {
    chrome.tabs.sendMessage(tabId, { action: "show_result", text: (lang === 'en' ? "❌ No active keys!" : "❌ Няма активни ключове!"), color: "red", lang: lang });
    return;
  }

  const storageKey = `lock_key${keyIndex + 1}`;
  const lockData = await chrome.storage.local.get([storageKey]);
  if (lockData[storageKey] && lockData[storageKey] > Date.now()) {
    return callAI(prompt, keys, tabId, keyIndex + 1, 0, lang);
  }

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
      return callAI(prompt, keys, tabId, keyIndex + 1, 0, lang);
    }

    if (response.ok && resData.candidates) {
      const resultText = resData.candidates[0].content.parts[0].text;
      const match = resultText.match(/(?:Риск|Risk):\s*(\d+)%/i);
      const p = match ? parseInt(match[1]) : 0;
      let color = p >= 85 ? "#d93025" : (p >= 45 ? "#f9ab00" : "#28a745");
      chrome.tabs.sendMessage(tabId, { action: "show_result", text: resultText, color: color, lang: lang });
    } else {
      callAI(prompt, keys, tabId, keyIndex + 1, 0, lang);
    }
  } catch (e) { callAI(prompt, keys, tabId, keyIndex + 1, 0, lang); }
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "retry_last_scan" && lastPendingRequest) {
    const { prompt, keys, tabId, lang } = lastPendingRequest;
    callAI(prompt, keys, tabId, 0, 0, lang);
    lastPendingRequest = null;
  }
});