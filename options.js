document.addEventListener('DOMContentLoaded', async () => {
    // Зареждане на съществуващите настройки
    const data = await browser.storage.local.get(['key1', 'key2', 'key3', 'lang']);
    if (data.key1) document.getElementById('key1').value = data.key1;
    if (data.key2) document.getElementById('key2').value = data.key2;
    if (data.key3) document.getElementById('key3').value = data.key3;
    if (data.lang) document.getElementById('lang').value = data.lang;
});

document.getElementById('save').onclick = async () => {
    const key1 = document.getElementById('key1').value;
    const key2 = document.getElementById('key2').value;
    const key3 = document.getElementById('key3').value;
    const lang = document.getElementById('lang').value;

    await browser.storage.local.set({ key1, key2, key3, lang });
    
    const status = document.getElementById('status');
    status.textContent = lang === 'bg' ? "Настройките са запазени!" : "Settings saved!";
    
    setTimeout(() => { status.textContent = ""; }, 2000);
};