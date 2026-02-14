let mouseX = 0, mouseY = 0, hostElement = null, timerInterval = null;
let lastRightClickedElement = null;

const translations = {
  bg: { loading: "⏳ Анализиране...", wait: "Изчакайте", sec: "сек.", retry: "🔄 Опитай пак", getKey: "🔑 Вземи безплатен ключ", quota: "🚫 Квотата е пълна.", updateTitle: "🚨 КРИТИЧЕН ЪПДЕЙТ!", updateMsg: "Вашата версия е остаряла. Моля, изтеглете новата.", updateBtn: "⬇️ ИЗТЕГЛИ" },
  en: { loading: "⏳ Analyzing...", wait: "Please wait", sec: "sec.", retry: "🔄 Try Again", getKey: "🔑 Get free API key", quota: "🚫 Quota exceeded.", updateTitle: "🚨 CRITICAL UPDATE!", updateMsg: "Your version is outdated. Please update.", updateBtn: "⬇️ DOWNLOAD" }
};

document.addEventListener("contextmenu", (e) => {
  lastRightClickedElement = e.target;
  mouseX = e.clientX; 
  mouseY = e.clientY;
}, true);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const lang = request.lang || 'bg';
  const t = translations[lang];

  if (request.action === "debug_msg") {
    console.log("%c[FB Holopost Debug]", "color: #00ff00; background: #000; padding: 4px;", request.log);
    return;
  }

  if (request.action === "get_content") {
    const selectedText = window.getSelection().toString().trim();
    // Филтър: ако текстът е под 3 символа, преминаваме към проверка за снимка
    if (selectedText.length >= 3) {
      sendResponse({ type: "text", data: selectedText });
      return true;
    }

    findImage(lastRightClickedElement).then(imgData => {
      if (imgData && imgData.base64) {
        sendResponse({ type: "image", data: imgData.base64, mime: imgData.mime });
      } else {
        // Ако няма нито текст, нито адекватна снимка, не пращаме заявка
        sendResponse({ type: "none" });
      }
    });
    return true;
  }

  if (request.action === "show_loading") createUI(t.loading, "#666", false, 0, false, lang);
  else if (request.action === "show_result") {
    let txt = (request.text === "QUOTA_EXCEEDED") ? t.quota : request.text;
    createUI(txt, request.color, request.isTimer, request.seconds, request.missingKey, lang);
  }
  else if (request.action === "show_update_block") createUI(t.updateMsg, "#d93025", false, 0, false, lang, true, request.updateUrl);
});

async function findImage(el) {
  if (!el) return null;

  const getSrc = (node) => {
    if (node.tagName === "IMG") return node.src;
    const style = window.getComputedStyle(node);
    if (style.backgroundImage && style.backgroundImage.includes("url")) {
      return style.backgroundImage.match(/url\(["']?([^"']+)["']?\)/)?.[1];
    }
    return null;
  };

  let src = getSrc(el);
  if (!src) {
    let p = el.parentElement;
    for (let i = 0; i < 5 && p; i++) {
      src = getSrc(p) || p.querySelector('img')?.src;
      if (src) break;
      p = p.parentElement;
    }
  }

  if (src && !src.startsWith('data:image/svg+xml')) {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const bmp = await createImageBitmap(blob);
      
      // Филтър: игнорираме системни икони и UI елементи под 100x100
      if (bmp.width < 100 || bmp.height < 100) return null;

      const canvas = document.createElement('canvas');
      let w = bmp.width, h = bmp.height;
      if (w > 1024 || h > 1024) {
        const r = Math.min(1024 / w, 1024 / h);
        w *= r; h *= r;
      }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bmp, 0, 0, w, h);
      
      return { base64: canvas.toDataURL('image/jpeg', 0.8).split(',')[1], mime: 'image/jpeg' };
    } catch (e) {
      return null;
    }
  }
  return null;
}

function createUI(text, color, isTimer, seconds, missingKey, lang, isUpdate = false, updateUrl = "") {
  const t = translations[lang];
  if (hostElement) { hostElement.remove(); clearInterval(timerInterval); }
  hostElement = document.createElement("div");
  hostElement.style.cssText = `position: fixed; top: ${mouseY + 10}px; left: ${mouseX + 10}px; z-index: 2147483647;`;
  document.body.appendChild(hostElement);

  const shadowRoot = hostElement.attachShadow({ mode: "open" });
  const styleLink = document.createElement("link");
  styleLink.rel = "stylesheet";
  styleLink.href = chrome.runtime.getURL("content.css");
  shadowRoot.appendChild(styleLink);

  const wrapper = document.createElement("div");
wrapper.className = "holopost-box";
if (text !== t.loading && !isUpdate) {
  wrapper.classList.add("is-result");
}
  wrapper.style.borderLeft = `5px solid ${color}`;
  
  const headerText = isUpdate ? t.updateTitle : 'FB Holopost';
  const header = document.createElement("div");
  header.className = "header";
  header.innerHTML = `<span>${headerText}</span><span class="close">✖</span>`;

  const content = document.createElement("div");
  content.className = "content";
  content.innerHTML = text;

  if (isUpdate) {
    const upDiv = document.createElement("div");
    upDiv.style.marginTop = "10px";
    upDiv.innerHTML = `<button id="hp-up-btn" style="background:#d93025;color:white;border:none;padding:8px;border-radius:4px;cursor:pointer;width:100%;font-weight:bold;">${t.updateBtn}</button>`;
    content.appendChild(upDiv);
    setTimeout(() => {
        const btn = shadowRoot.getElementById("hp-up-btn");
        if(btn) btn.onclick = () => window.open(updateUrl, '_blank');
    }, 0);
  }

  if (missingKey && !isUpdate) {
    const linkDiv = document.createElement("div");
    linkDiv.style.marginTop = "10px";
    linkDiv.innerHTML = `<a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:#1877f2;text-decoration:none;font-weight:bold;">${t.getKey}</a>`;
    content.appendChild(linkDiv);
  }

  if (isTimer && !isUpdate) {
    const tDiv = document.createElement("div");
    tDiv.style.marginTop = "10px";
    tDiv.innerHTML = `${t.wait} <span id="hp-timer">${seconds}</span> ${t.sec}`;
    content.appendChild(tDiv);
    let rem = seconds;
    timerInterval = setInterval(() => {
      rem--;
      const span = shadowRoot.getElementById("hp-timer");
      if (span) span.innerText = rem;
      if (rem <= 0) {
        clearInterval(timerInterval);
        tDiv.innerHTML = `<button id="retry-btn" style="margin-top:5px;cursor:pointer;">${t.retry}</button>`;
        const rBtn = shadowRoot.getElementById("retry-btn");
        if(rBtn) rBtn.onclick = () => chrome.runtime.sendMessage({ action: "retry_last_scan" });
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