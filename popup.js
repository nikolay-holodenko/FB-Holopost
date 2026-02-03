const CURRENT_VERSION = "1.2.1";
const GITHUB_VER_URL = "https://raw.githubusercontent.com/nikolay-holodenko/FB-Holopost/main/version.json";

const uiTranslations = {
  bg: { title: "⚙️ FB Holopost Настройки", key1: "API Ключ 1:", key2: "API Ключ 2:", key3: "API Ключ 3:", langLabel: "Език на отговора:", saveBtn: "💾 Запази", statusActive: "Статус: ● Активен", statusInactive: "Статус: ○ Неактивен", done: "✅ Готово!", wait: "Изчакайте: ", update: "🚀 Има нова версия" },
  en: { title: "⚙️ FB Holopost Settings", key1: "API Key 1:", key2: "API Key 2:", key3: "API Key 3:", langLabel: "Response Language:", saveBtn: "💾 Save", statusActive: "Status: ● Active", statusInactive: "Status: ○ Inactive", done: "✅ Done!", wait: "Wait: ", update: "🚀 New version" }
};

function applyTranslations(lang) {
  const t = uiTranslations[lang] || uiTranslations.bg;
  document.getElementById('ui-title').textContent = t.title;
  
  const k1 = document.getElementById('ui-key1'); k1.childNodes[0].textContent = t.key1 + " ";
  const k2 = document.getElementById('ui-key2'); k2.childNodes[0].textContent = t.key2 + " ";
  const k3 = document.getElementById('ui-key3'); k3.childNodes[0].textContent = t.key3 + " ";
  
  document.getElementById('ui-lang').textContent = t.langLabel;
  document.getElementById('save').textContent = t.saveBtn;
  document.getElementById('update-btn').textContent = t.update;
}

// Помощна функция за сравняване на версии (напр. 1.2.1 vs 1.1)
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const n1 = parts1[i] || 0;
    const n2 = parts2[i] || 0;
    if (n1 > n2) return 1;  // v1 е по-голяма
    if (n1 < n2) return -1; // v2 е по-голяма (има ъпдейт)
  }
  return 0; // Равни са
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('current-version').textContent = CURRENT_VERSION;

  chrome.storage.local.get(['key1', 'key2', 'key3', 'lang'], (res) => {
    if (res.key1) document.getElementById('key1').value = res.key1;
    if (res.key2) document.getElementById('key2').value = res.key2;
    if (res.key3) document.getElementById('key3').value = res.key3;
    if (res.lang) {
      document.getElementById('lang').value = res.lang;
      applyTranslations(res.lang);
    } else {
      applyTranslations('bg');
    }
  });

  // УМНА ПРОВЕРКА ЗА ЪПДЕЙТ
  fetch(GITHUB_VER_URL).then(r => r.json()).then(data => {
    const hasNewVersion = compareVersions(CURRENT_VERSION, data.version) === -1; // Ако текущата е по-малка
    const isCritical = data.critical === true;

    if (hasNewVersion || isCritical) {
      const btn = document.getElementById('update-btn');
      btn.style.display = "block";
      btn.onclick = () => window.open(data.update_url || "https://github.com/nikolay-holodenko/FB-Holopost", "_blank");
    }
  }).catch(e => console.log("Update check failed", e));

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

    if (activeSpan) {
      activeSpan.textContent = (activeIdx === i && !isLocked) ? "✔" : "";
    }

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

document.getElementById('save').addEventListener('click', () => {
  const settings = {
    key1: document.getElementById('key1').value.trim(),
    key2: document.getElementById('key2').value.trim(),
    key3: document.getElementById('key3').value.trim(),
    lang: document.getElementById('lang').value
  };

  chrome.storage.local.set(settings, () => {
    const status = document.getElementById('status');
    const lang = settings.lang || 'bg';
    status.textContent = uiTranslations[lang].done;
    status.style.color = "#42b72a";
    applyTranslations(lang);
    setTimeout(() => { status.textContent = ""; }, 3000);
  });
});

document.getElementById('lang').addEventListener('change', (e) => {
  applyTranslations(e.target.value);
});