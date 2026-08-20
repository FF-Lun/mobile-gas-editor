/**
 * 手機版 GAS 專案管理工具 — 後端
 * 透過 Google Apps Script API 讀寫、建立版本、更新部署「其他」GAS 專案
 *
 * 第一次設定必做兩件事：
 * 1. appsscript.json 加入 oauthScopes（見檔案底部註解）
 * 2. 到 script.google.com/home/usersettings 打開「Google Apps Script API」開關
 */

const API_BASE = 'https://script.googleapis.com/v1/projects/';
const PROPS = PropertiesService.getUserProperties();
const PROJECTS_KEY = 'REGISTERED_PROJECTS'; // 存放格式：[{name, scriptId}]

// ---------- 網頁進入點 ----------

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Editor')
    .setTitle('手機版 GAS 編輯器')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ---------- Apps Script API 底層呼叫 ----------

function apiFetch_(path, method, payload) {
  const token = ScriptApp.getOAuthToken();
  const options = {
    method: method || 'get',
    headers: { Authorization: 'Bearer ' + token },
    contentType: 'application/json',
    muteHttpExceptions: true
  };
  if (payload) options.payload = JSON.stringify(payload);

  const res = UrlFetchApp.fetch(API_BASE + path, options);
  const code = res.getResponseCode();
  const body = res.getContentText();

  if (code >= 400) {
    throw new Error('Apps Script API 錯誤 (HTTP ' + code + ')：' + body);
  }
  return body ? JSON.parse(body) : null;
}

// ---------- 專案登錄（試算表 <-> scriptId 對應）----------

function listRegisteredProjects() {
  const raw = PROPS.getProperty(PROJECTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function registerProject(name, scriptUrlOrId) {
  const scriptId = extractScriptId_(scriptUrlOrId);
  if (!scriptId) {
    throw new Error('無法解析出 scriptId，請貼上完整的 Apps Script 專案網址（網址列裡那一串），或直接貼 scriptId 本身');
  }
  const list = listRegisteredProjects();
  const existing = list.find(function (p) { return p.scriptId === scriptId; });
  if (existing) {
    existing.name = name;
  } else {
    list.push({ name: name, scriptId: scriptId });
  }
  PROPS.setProperty(PROJECTS_KEY, JSON.stringify(list));
  return list;
}

function removeProject(scriptId) {
  const list = listRegisteredProjects().filter(function (p) { return p.scriptId !== scriptId; });
  PROPS.setProperty(PROJECTS_KEY, JSON.stringify(list));
  return list;
}

function extractScriptId_(input) {
  if (!input) return null;
  const trimmed = input.trim();
  // 已經是 scriptId 本身（純英數字+底線/減號，夠長）
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  // 綁定試算表的專案網址，例如 https://script.google.com/.../d/{scriptId}/edit
  let m = trimmed.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];
  // 獨立（standalone）專案網址，例如 https://script.google.com/u/0/home/projects/{scriptId}/edit
  m = trimmed.match(/\/projects\/([a-zA-Z0-9_-]{20,})/);
  if (m) return m[1];
  return null;
}

// ---------- 讀寫檔案內容 ----------

function getProjectFiles(scriptId) {
  const data = apiFetch_(scriptId + '/content', 'get');
  return data.files.map(function (f) { return { name: f.name, type: f.type }; });
}

function getFileContent(scriptId, fileName) {
  const data = apiFetch_(scriptId + '/content', 'get');
  const file = data.files.filter(function (f) { return f.name === fileName; })[0];
  if (!file) throw new Error('找不到檔案：' + fileName);
  return file.source;
}

function saveFileContent(scriptId, fileName, newSource) {
  // 整包 GET -> 只替換目標檔案 -> 整包 PUT 回去（Apps Script API 是全量覆寫，不能只傳單一檔案）
  const data = apiFetch_(scriptId + '/content', 'get');
  const file = data.files.filter(function (f) { return f.name === fileName; })[0];
  if (!file) throw new Error('找不到檔案：' + fileName);
  file.source = newSource;
  apiFetch_(scriptId + '/content', 'put', { files: data.files });
  return true;
}

// ---------- 版本與部署 ----------

function createVersion(scriptId, description) {
  const res = apiFetch_(scriptId + '/versions', 'post', {
    description: description || ('手機版工具建立於 ' + new Date().toLocaleString('zh-TW'))
  });
  return res.versionNumber;
}

function listDeployments(scriptId) {
  let all = [];
  let pageToken = null;
  do {
    const path = scriptId + '/deployments' + (pageToken ? '?pageToken=' + encodeURIComponent(pageToken) : '');
    const res = apiFetch_(path, 'get');
    all = all.concat(res.deployments || []);
    pageToken = res.nextPageToken || null;
  } while (pageToken);

  return all
    .map(function (d) {
      return {
        deploymentId: d.deploymentId,
        description: d.deploymentConfig && d.deploymentConfig.description,
        versionNumber: d.deploymentConfig && d.deploymentConfig.versionNumber,
        updateTime: d.updateTime
      };
    })
    // 排除唯讀的 HEAD 部署（它沒有固定的 versionNumber，永遠追蹤最新程式碼，API 無法更新它）
    .filter(function (d) { return d.versionNumber != null; })
    // 有明確命名（說明文字非空）的排前面，且依最後更新時間新到舊排序
    .sort(function (a, b) {
      const aNamed = a.description ? 1 : 0;
      const bNamed = b.description ? 1 : 0;
      if (aNamed !== bNamed) return bNamed - aNamed;
      return (b.updateTime || '').localeCompare(a.updateTime || '');
    });
}

// ---------- 記住每個專案上次選定的部署目標，之後不用重複選 ----------

const DEPLOY_TARGET_PREFIX = 'DEPLOY_TARGET_';

function getSavedDeploymentTarget(scriptId) {
  return PROPS.getProperty(DEPLOY_TARGET_PREFIX + scriptId) || null;
}

function saveDeploymentTarget(scriptId, deploymentId) {
  PROPS.setProperty(DEPLOY_TARGET_PREFIX + scriptId, deploymentId);
  return true;
}

function getDeploymentInfo(scriptId, deploymentId) {
  const d = apiFetch_(scriptId + '/deployments/' + deploymentId, 'get');
  return {
    deploymentId: d.deploymentId,
    description: d.deploymentConfig && d.deploymentConfig.description,
    versionNumber: d.deploymentConfig && d.deploymentConfig.versionNumber
  };
}

function updateDeployment(scriptId, deploymentId, versionNumber, description) {
  return apiFetch_(scriptId + '/deployments/' + deploymentId, 'put', {
    deploymentConfig: {
      scriptId: scriptId,
      versionNumber: versionNumber,
      manifestFileName: 'appsscript',
      description: description || '手機版工具更新部署'
    }
  });
}

/*
 * ============================================================
 * 這支工具的 appsscript.json 需要加入以下 oauthScopes
 * （在原生編輯器裡打開專案設定 -> 顯示 appsscript.json 後貼上）：
 *
 * "oauthScopes": [
 *   "https://www.googleapis.com/auth/script.projects",
 *   "https://www.googleapis.com/auth/script.deployments",
 *   "https://www.googleapis.com/auth/script.external_request"
 * ]
 *
 * 另外，第一次使用前，到 script.google.com/home/usersettings
 * 把「Google Apps Script API」開關打開（帳號層級設定，只需做一次）。
 * ============================================================
 */
