document.addEventListener('DOMContentLoaded', async () => {
    const data = await browser.storage.local.get(['lastResult', 'updateAvailable', 'updateUrl']);

    // Показване на резултата от анализа
    if (data.lastResult) {
        document.getElementById('result').textContent = data.lastResult;
    }

    // Проверка за ъпдейт
    if (data.updateAvailable) {
        const updateDiv = document.getElementById('update-notice');
        updateDiv.style.display = 'block';
        updateDiv.onclick = () => {
            window.open(data.updateUrl || 'https://github.com/nikolay-holodenko/FB-Holopost');
        };
    }

    // Отваряне на настройките
    document.getElementById('open-options').onclick = () => {
        browser.runtime.openOptionsPage();
    };
});