// background.js

const reloadTabs = new Map();  // tabId -> { interval, timeoutId }

function startReloadForTab(tabId, interval) {
  reloadTabs.set(tabId, { interval, timeoutId: null });
  updateIcon(tabId);
  saveState();
  scheduleReload(tabId);
}

function scheduleReload(tabId) {
  if (!reloadTabs.has(tabId)) return;
  const { interval, timeoutId } = reloadTabs.get(tabId);

  if (timeoutId) clearTimeout(timeoutId);

  const newTimeoutId = setTimeout(() => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        console.debug(`scheduleReload: タブ${tabId}取得失敗 → 停止`, chrome.runtime.lastError?.message);
        void chrome.runtime.lastError; // ★ lastError を読むことで警告回避
        stopReloadForTab(tabId);
        return;
      }

      chrome.tabs.reload(tabId, { bypassCache: true }, () => {
        if (chrome.runtime.lastError) {
          console.debug(`scheduleReload: リロード失敗 → 停止`, chrome.runtime.lastError.message);
          void chrome.runtime.lastError; // ★ ここも同様に
          stopReloadForTab(tabId);
          return;
        }

        console.log(`Tab ${tabId} をリロード (interval: ${interval}秒)`);
        scheduleReload(tabId);
      });
    });
  }, interval * 1000);

  reloadTabs.set(tabId, { interval, timeoutId: newTimeoutId });
}

function stopReloadForTab(tabId) {
  console.log(`stopReloadForTab: タブ ${tabId} を停止`);
  if (!reloadTabs.has(tabId)) return;
  const { timeoutId } = reloadTabs.get(tabId);
  if (timeoutId) clearTimeout(timeoutId);
  reloadTabs.delete(tabId);
  updateIcon(tabId);
  saveState();
}

function updateIcon(tabId) {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) {
      console.debug(`updateIcon: 無効なタブ(${tabId}) → スキップ`, chrome.runtime.lastError?.message);
      void chrome.runtime.lastError;
      return;
    }
    const path = reloadTabs.has(tabId) ? "icon_color.png" : "icon_gray.png";
    chrome.action.setIcon({ path, tabId }, () => {
      if (chrome.runtime.lastError) {
        console.debug(`updateIcon: setIcon失敗`, chrome.runtime.lastError.message);
        void chrome.runtime.lastError;
      }
    });
  });
}

function saveState() {
  const obj = {};
  reloadTabs.forEach(({ interval }, tabId) => {
    obj[tabId] = interval;
  });
  chrome.storage.local.set({ reloadTabs: obj }, () => {
    console.log("saveState: 状態を保存", obj);
  });
}

function loadState() {
  chrome.storage.local.get(["reloadTabs"], (data) => {
    const tabs = data.reloadTabs || {};
    reloadTabs.clear();
    console.log("loadState: 状態を復元", tabs);
    for (const tabIdStr in tabs) {
      const tabId = Number(tabIdStr);
      const interval = tabs[tabIdStr];
      startReloadForTab(tabId, interval);
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "toggleTabReload") {
    const tabId = message.tabId;
    const interval = message.interval || 10;

    console.log(`onMessage: toggleTabReload タブ ${tabId} interval=${interval}`);

    if (reloadTabs.has(tabId)) {
      stopReloadForTab(tabId);
    } else {
      startReloadForTab(tabId, interval);
    }
    sendResponse({ status: "ok" });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (reloadTabs.has(tabId)) {
    stopReloadForTab(tabId);
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  updateIcon(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") {
    updateIcon(tabId);
  }
});

// 起動時に状態復元
loadState();
