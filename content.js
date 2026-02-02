let mouseX = 0, mouseY = 0, hostElement = null, timerInterval = null;

const translations = {
  bg: { 
    loading: "⏳ Анализиране...", 
    wait: "Изчакайте", 
    sec: "сек.", 
    retry: "🔄 Опитай пак", 
    getKey: "🔑 Вземи безплатен ключ", 
    quota: "🚫 Квотата е пълна.",
    updateTitle: "🚨 КРИТИЧЕН ЪПДЕЙТ!",
    updateMsg: "Вашата версия е остаряла и не се поддържа. Моля, изтеглете новата версия.",
    updateBtn: "⬇️ ИЗТЕГЛИ СЕГА"
  },
  en: { 
    loading: "⏳ Analyzing...", 
    wait: "Please wait", 
    sec: "sec.", 
    retry: "🔄 Try Again", 
    getKey: "🔑 Get free API key", 
    quota: "🚫 Quota exceeded.",
    updateTitle: "🚨 CRITICAL UPDATE!",
    updateMsg: "Your version is outdated. Please download the newest version.",
    updateBtn: "⬇️ DOWNLOAD NOW"
  }
};

document.addEventListener("mousedown", (e) => { if (e.button === 2) { mouseX = e.clientX; mouseY = e.clientY; } }, true);

chrome.runtime.onMessage.addListener((request) => {
  const lang = request.lang || 'bg';
  const t = translations[lang];

  if (request.action === "show_loading") {
    createUI(t.loading, "#666", false, 0, false, lang);
  } 
  else if (request.action === "show_result") {
    let displayText = request.text;
    if (request.text === "QUOTA_EXCEEDED") displayText = t.quota;
    createUI(displayText, request.color, request.isTimer, request.waitSeconds, request.missingKey, lang);
  }
  else if (request.action === "show_update_block") {
    createUI(t.updateMsg, "#d93025", false, 0, false, lang, true, request.updateUrl);
  }
});

function createUI(text, color, isTimer, seconds, missingKey, lang, isUpdate = false, updateUrl = "") {
  const t = translations[lang];
  if (hostElement) { hostElement.remove(); clearInterval(timerInterval); }

  hostElement = document.createElement("div");
  hostElement.id = "holopost-host";
  hostElement.style.cssText = `position: fixed; top: ${mouseY + 10}px; left: ${mouseX + 10}px; z-index: 2147483647;`;
  document.body.appendChild(hostElement);

  const shadowRoot = hostElement.attachShadow({ mode: "open" });
  const styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  styleLink.href = chrome.runtime.getURL("content.css") + "?t=" + new Date().getTime();
  shadowRoot.appendChild(styleLink);

  const wrapper = document.createElement("div");
  wrapper.className = "holopost-box";
  wrapper.style.borderLeft = `5px solid ${color}`;

  const header = document.createElement("div");
  header.className = "header";
  header.innerHTML = `<span>${isUpdate ? t.updateTitle : 'FB Holopost'}</span><span class="close">✖</span>`;
  
  const content = document.createElement("div");
  content.className = "content";
  content.innerText = text;

  // ЛОГИКА ЗА КРИТИЧЕН ЪПДЕЙТ
  if (isUpdate) {
    const upDiv = document.createElement("div");
    upDiv.className = "action-container";
    upDiv.innerHTML = `<button id="hp-update-btn" style="background:#d93025; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; width:100%; font-weight:bold;">${t.updateBtn}</button>`;
    content.appendChild(upDiv);
    shadowRoot.getElementById("hp-update-btn").onclick = () => window.open(updateUrl, '_blank');
  }

  if (missingKey && !isUpdate) {
    const linkDiv = document.createElement("div");
    linkDiv.className = "action-container";
    linkDiv.innerHTML = `<a href="https://aistudio.google.com/app/apikey" target="_blank" class="get-key-btn">${t.getKey}</a>`;
    content.appendChild(linkDiv);
  }

  if (isTimer && !isUpdate) {
    const timerDiv = document.createElement("div");
    timerDiv.className = "timer-container";
    timerDiv.innerHTML = `${t.wait} <span id="hp-timer">${seconds}</span> ${t.sec}`;
    content.appendChild(timerDiv);

    let rem = seconds;
    timerInterval = setInterval(() => {
      rem--;
      const span = shadowRoot.getElementById("hp-timer");
      if (span) span.innerText = rem;
      if (rem <= 0) {
        clearInterval(timerInterval);
        timerDiv.innerHTML = `<button id="retry-btn">${t.retry}</button>`;
        shadowRoot.getElementById("retry-btn").onclick = () => {
          chrome.runtime.sendMessage({ action: "retry_last_scan" });
          createUI(t.loading, "#666", false, 0, false, lang);
        };
      }
    }, 1000);
  }

  wrapper.appendChild(header);
  wrapper.appendChild(content);
  shadowRoot.appendChild(wrapper);
  shadowRoot.querySelector(".close").onclick = () => { hostElement.remove(); hostElement = null; };
  makeDraggable(header, hostElement);
}

function makeDraggable(trigger, move) {
  let isDrag = false, sx, sy, il, it;
  trigger.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('close')) return;
    isDrag = true; sx = e.clientX; sy = e.clientY;
    const r = move.getBoundingClientRect();
    il = r.left; it = r.top;
    trigger.style.cursor = 'grabbing';
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDrag) return;
    move.style.left = `${il + (e.clientX - sx)}px`;
    move.style.top = `${it + (e.clientY - sy)}px`;
  });
  document.addEventListener('mouseup', () => { isDrag = false; trigger.style.cursor = 'move'; });
}