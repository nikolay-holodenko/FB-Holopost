document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['key1', 'key2', 'key3', 'lang'], (res) => {
    if (res.key1) document.getElementById('key1').value = res.key1;
    if (res.key2) document.getElementById('key2').value = res.key2;
    if (res.key3) document.getElementById('key3').value = res.key3;
    if (res.lang) document.getElementById('lang').value = res.lang;
  });
});

document.getElementById('save').addEventListener('click', () => {
  const settings = {
    key1: document.getElementById('key1').value.trim(),
    key2: document.getElementById('key2').value.trim(),
    key3: document.getElementById('key3').value.trim(),
    lang: document.getElementById('lang').value
  };

  chrome.storage.local.set(settings, () => {
    const status = document.getElementById('status');
    status.textContent = "✅ Настройките са запазени!";
    status.style.color = "#42b72a";
    setTimeout(() => { status.textContent = ""; }, 3000);
  });
});