browser.contextMenus.create({
  id: "check-risk",
  title: "FB Holopost: Analyze Content",
  contexts: ["selection", "image"]
});

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

browser.contextMenus.onClicked.addListener(async (info) => {
  const data = await browser.storage.local.get(["key1", "key2", "key3", "lang"]);
  const keys = [data.key1, data.key2, data.key3].filter(k => k);
  const lang = data.lang || (navigator.language.includes('bg') ? 'bg' : 'en');

  if (keys.length === 0) {
    const msg = lang === 'bg' ? "Моля, въведете API ключ в настройките!" : "Please enter an API key in settings!";
    alert(msg);
    return;
  }

  const prompt = `Analyze this for Facebook censorship risk (0-100%). Language: ${lang}. Content: ${info.selectionText || info.srcUrl}`;

  try {
    const result = await callAI(prompt, keys);
    const text = result.candidates[0].content.parts[0].text;
    browser.storage.local.set({ lastResult: text });
    alert("FB Holopost: Analysis Complete / Анализът е завършен!");
  } catch (e) {
    alert("Error: All API keys failed or limit reached.");
  }
});