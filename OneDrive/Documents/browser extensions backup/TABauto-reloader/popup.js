const toggleButton = document.getElementById("toggleButton");
const intervalInput = document.getElementById("interval");
const labelInterval = document.getElementById("labelInterval");
const labelSec = document.getElementById("labelSec");

let isRunning = false;
let currentTabId = null;

// ブラウザの言語を取得（例: "ja", "en"）
let lang = navigator.language || navigator.userLanguage;

// 【テスト用】英語固定したい場合は以下のコメントを外す
// lang = "en";

function setLanguageTexts() {
  if (lang.startsWith("ja")) {
    labelInterval.textContent = "リロード間隔（5～600秒）:";
    labelSec.textContent = "秒";
    toggleButton.textContent = isRunning ? "停止" : "開始";
  } else {
    labelInterval.textContent = "Reload Interval (5–600):";
    labelSec.textContent = "Sec.";
    toggleButton.textContent = isRunning ? "Stop" : "Start";
  }
}

async function restoreState() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab.id;

  const data = await chrome.storage.local.get(["reloadTabs"]);
  const reloadTabs = data.reloadTabs || {};

  if (reloadTabs[currentTabId]) {
    isRunning = true;
    intervalInput.value = reloadTabs[currentTabId];
  } else {
    isRunning = false;
    intervalInput.value = 10;  // デフォルト値
  }
  setLanguageTexts();  // ボタンやラベルのテキストを言語に合わせて更新
  console.log(`popup restoreState: タブ ${currentTabId} は ${isRunning ? "実行中" : "停止中"}`);
}

toggleButton.addEventListener("click", async () => {
  const interval = Number(intervalInput.value);
  if (interval < 5 || interval > 600) {
    alert(lang.startsWith("ja")
      ? "5秒から600秒の間で設定してください。"
      : "Please set the interval between 5 and 600 seconds.");
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab.id;

  if (isRunning) {
    chrome.runtime.sendMessage({ type: "toggleTabReload", tabId: currentTabId });
    isRunning = false;
  } else {
    chrome.runtime.sendMessage({ type: "toggleTabReload", tabId: currentTabId, interval });
    isRunning = true;
  }
  setLanguageTexts();
});

// 初期化
setLanguageTexts();
restoreState();
