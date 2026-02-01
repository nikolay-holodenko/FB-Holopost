// Създаване на контекстно меню
browser.contextMenus.create({
  id: "check-risk",
  title: "FB Holopost: Analyze Content",
  contexts: ["selection", "image"]
});

// Основна функция за анализ с "Чифте пищови"
async function callAI(content, keys, index = 0) {
  if (index >= keys.length) throw new Error("API_LIMIT_REACHED");
  
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${keys[index]}`;
  
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: content }] }] })
    });
    
    if (response.status === 429) return callAI(content, keys, index + 1);
    return await response.json();
  } catch (e) {
    return callAI(content, keys, index + 1);
  }
}

// Слушател за клик върху менюто
browser.contextMenus.onClicked.addListener(async (info) => {
  const data = await browser.storage.local.get(["key1", "key2", "key3", "lang"]);
  const keys = [data.key1, data.key2, data.key3].filter(k => k);
  const lang = data.lang || (navigator.language.includes('bg') ? 'bg' : 'en');

  if (keys.length === 0) {
    alert(lang === 'bg' ? "Моля, въведете API ключ в настройките!" : "Please enter an API key in settings!");
    return;
  }

  const prompt = `Analyze this for Facebook censorship risk (0-100%). Answer in ${lang}. Content: ${info.selectionText || info.srcUrl}`;

  try {
    const result = await callAI(prompt, keys);
    const text = result.candidates[0].content.parts[0].text;
    await browser.storage.local.set({ lastResult: text });
    alert("FB Holopost: Analysis Complete / Анализът е завършен! Check the popup.");
  } catch (e) {
    alert("Error: All API keys failed or limit reached.");
  }
});

// ПРОВЕРКА ЗА НОВА ВЕРСИЯ (Survivor Module)
async function checkForUpdates() {
  const GITHUB_VER_URL = "https://raw.githubusercontent.com/nikolay-holodenko/FB-Holopost/main/version.json";
  try {
    const response = await fetch(GITHUB_VER_URL);
    const data = await response.json();
    if (data.version !== "1.0.0") {
      await browser.storage.local.set({ 
        updateAvailable: true, 
        newVersion: data.version,
        updateUrl: data.update_link 
      });
    }
  } catch (e) {
    console.log("Update check skipped.");
  }
}

// Проверявай при всяко стартиране
checkForUpdates();