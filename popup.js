const uiTranslations = {
  bg: { title: "⚙️ FB Holopost Настройки", key1: "API Ключ 1:", key2: "API Ключ 2:", key3: "API Ключ 3:", langLabel: "Език на отговора:", saveBtn: "💾 Запази", statusActive: "Статус: ● Активен", statusInactive: "Статус: ○ Неактивен", done: "✅ Готово!", wait: "Изчакайте: " },
  en: { title: "⚙️ FB Holopost Settings", key1: "API Key 1:", key2: "API Key 2:", key3: "API Key 3:", langLabel: "Response Language:", saveBtn: "💾 Save", statusActive: "Status: ● Active", statusInactive: "Status: ○ Inactive", done: "✅ Done!", wait: "Wait: " }
};

function applyTranslations(lang) {
  const t = uiTranslations[lang] || uiTranslations.bg;
  document.getElementById('ui-title').textContent = t.title;
  // Ползваме innerHTML само веднъж при зареждане/смяна за структурата
  document.getElementById('ui-key1').innerHTML = `${t.key1} <span id="active-1" class="active-check"></span>`;
  document.getElementById('ui-key2').innerHTML = `${t.key2} <span id="active-2" class="active-check"></span>`;
  document.getElementById('ui-key3').innerHTML = `${t.key3} <span id="active-3" class="active-check"></span>`;
  document.getElementById('ui-lang-label').textContent = t.langLabel;
  document.getElementById('save').textContent = t.saveBtn;
}

document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status-text');
  chrome.storage.local.get(['key1', 'key2', 'key3', 'lang'], (data) => {
    const lang = data.lang || 'bg';
    applyTranslations(lang);
    if (data.key1) document.getElementById('key1').value = data.key1;
    if (data.key2) document.getElementById('key2').value = data.key2;
    if (data.key3) document.getElementById('key3').value = data.key3;
    document.getElementById('lang').value = lang;
    updateStatus(data.key1, statusEl, lang);
  });

  document.getElementById('save').addEventListener('click', () => {
    const lang = document.getElementById('lang').value;
    const settings = {
      key1: document.getElementById('key1').value.trim(),
      key2: document.getElementById('key2').value.trim(),
      key3: document.getElementById('key3').value.trim(),
      lang: lang
    };
    chrome.storage.local.set(settings, () => {
      const btn = document.getElementById('save');
      btn.textContent = uiTranslations[lang].done;
      setTimeout(() => { btn.textContent = uiTranslations[lang].saveBtn; }, 2000);
      updateStatus(settings.key1, statusEl, lang);
      applyTranslations(lang);
    });
  });

  setInterval(checkKeyStatus, 1000);
});

async function checkKeyStatus() {
  const data = await chrome.storage.local.get(['lock_key1', 'lock_key2', 'lock_key3', 'lang', 'active_key_index']);
  const now = Date.now();
  const lang = data.lang || 'bg';
  const t = uiTranslations[lang];
  const activeIdx = data.active_key_index;

  for (let i = 1; i <= 3; i++) {
    const input = document.getElementById(`key${i}`);
    const timerSpan = document.getElementById(`timer-key${i}`);
    const activeSpan = document.getElementById(`active-${i}`);
    const lockTime = data[`lock_key${i}`];

    const isLocked = lockTime && lockTime > now;

    // ВИЗУАЛИЗАЦИЯ НА ✔
    if (activeSpan) {
      // Показваме чека само ако това е последният ползван ключ И той не е в момента блокиран
      activeSpan.textContent = (activeIdx === i && !isLocked) ? "✔" : "";
    }

    // ВИЗУАЛИЗАЦИЯ НА БЛОКИРОВКАТА
    if (isLocked) {
      const remaining = Math.ceil((lockTime - now) / 1000);
      input.style.borderColor = "#d93025";
      input.style.backgroundColor = "#fff5f5";
      if (timerSpan) timerSpan.textContent = `${t.wait}${remaining}s`;
    } else {
      input.style.borderColor = "";
      input.style.backgroundColor = "";
      if (timerSpan) timerSpan.textContent = "";
    }
  }
}

function updateStatus(key, element, lang) {
  const t = uiTranslations[lang];
  if (key && key.length > 10) {
    element.textContent = t.statusActive;
    element.className = "active";
  } else {
    element.textContent = t.statusInactive;
    element.className = "inactive";
  }
}