// snifferUtils.mjs - Shared JS functions
// (C) 2021-2024 Richard Stam, SigmaFxDx Software
import * as dev from './devlog.mjs';
var snifferUtils = {};
snifferUtils.extensionId = chrome.runtime.id;
snifferUtils.playerPath = "player/player.html";
snifferUtils.settingsPath = "player/settings.html";
snifferUtils.redirectTag = "redirected=true";

//#region Net Request
//manifest permission "declarativeNetRequestFeedback", for debugging
snifferUtils.playerFullPath = chrome.runtime.getURL(snifferUtils.playerPath);
snifferUtils.m3u8RegexFilterStr = "^https?://[^#|?]*\\.m3u8([#|?]+.*)?$";
snifferUtils.m3u8RegexFilter = new RegExp(snifferUtils.m3u8RegexFilterStr);
snifferUtils.defaultNetRule = "mainM3u8RedirectRule"; //"mainM3u8BlockRule";
snifferUtils.netRules = {
    mainM3u8RedirectRule: {
        "id": 2, "priority": 1, "action": { "type": "redirect",
        //"redirect": {"regexSubstitution": `${chrome.runtime.getURL(snifferUtils.playerPath)}#\\0`} },
        //"redirect": {"regexSubstitution": `about:blank`} }, // Player loaded from onBeforeRequest
        //"redirect": {"regexSubstitution": `${snifferUtils.playerFullPath}?${snifferUtils.redirectTag}#\\0`} },
        "redirect": {"regexSubstitution": `${snifferUtils.playerFullPath}#\\0`} },
        "condition": { "regexFilter": snifferUtils.m3u8RegexFilterStr, "resourceTypes": ["main_frame"] }
    },
    mainM3u8BlockRule: { // Not used, use redirect instead (avoids blocked screens)
        "id": 1, "priority": 1, "action": { "type": "block" },
        "condition": { "regexFilter": snifferUtils.m3u8RegexFilterStr, "resourceTypes": ["main_frame"] }
    },
}
snifferUtils.clearM3u8NetRules = async function() {
    try { let dynamicRules = await chrome.declarativeNetRequest.getDynamicRules();
        //dev.verbose("snifferUtils.mjs clearM3u8NetRules dynamicRules =", dynamicRules);
        let updateDynamicRules = chrome.declarativeNetRequest.updateDynamicRules;
        await updateDynamicRules({removeRuleIds: dynamicRules.map(r => r.id)});
    } catch (err) { dev.error("snifferUtils.mjs clearM3u8NetRules exception = ", err); }
}
snifferUtils.setM3u8NetRules = async function(enable = true, ruleName) {
    //dev.verbose("snifferUtils.mjs setM3u8NetRules enable, replace =", enable, replace);
    var rule = snifferUtils.netRules[ruleName ?? snifferUtils.defaultNetRule];
    let UpdateRuleOptions = {removeRuleIds: [rule.id]};
    if (enable) UpdateRuleOptions.addRules = [rule];
    try { await chrome.declarativeNetRequest.updateDynamicRules(UpdateRuleOptions);
    } catch (err) { dev.error("snifferUtils.mjs setM3u8NetRules exception = ", err); }
    //let dynamicRules = await chrome.declarativeNetRequest.getDynamicRules(); //??? Debugging
    //dev.verbose("snifferUtils.mjs setM3u8NetRules dynamicRules =", dynamicRules);
}
//#endregion

//#region URL & String
snifferUtils.stripLastUrlChar = function(urlString) {
    if (urlString.endsWith("&") || urlString.endsWith("?")) {
        urlString = urlString.substring(0, urlString.length - 1);
    }
    return urlString;
}
snifferUtils.stripProtocol = function(urlString) {
    var pos = urlString.indexOf("://");
    return pos ? urlString.substring(pos + 3) : urlString;
}
snifferUtils.stripUrlHashSpam = function(url = "") {
    let urlHashParts = url.split("#");
    let urlBase = urlHashParts.shift();
    let hash = snifferUtils.stripHashSpam(urlHashParts.join("#"));
    return urlBase + (hash ? "#" : "") + hash;
}
snifferUtils.stripHashSpam = function(hash = "") {
    if (!hash.startsWith("http")) {
        let pos = hash.indexOf("http");
        hash = pos < 0 ? "" : hash.substring(pos);
    }
    return hash;
}
snifferUtils.checkEncodedURL = function(str) {
    var isEncoded = (str && str.indexOf("%3A%2F%2F") >= 0);
    return isEncoded ? decodeURIComponent(str) : str;
}
snifferUtils.getBaseUrl = function(url) {
    return url.split("#")[0].split("?")[0];
}
snifferUtils.getUrlFile = function(url) {
    let baseUrl = snifferUtils.getBaseUrl(url);
    return baseUrl.split("/").pop();
}
snifferUtils.getUrlFileExt = function(url) {
    let urlFile = snifferUtils.getUrlFile(url);
    let fileParts = urlFile.split(".");
    return fileParts.length > 1 ? fileParts.pop() : "";
}

snifferUtils.whiteSpaceTrim = function(string) {
    var str = string.replace(",", " ");
    str = str.replace(/\s/g, " ");
    while (str.indexOf("  ") >= 0) {
        str = str.replaceAll("  ", " ");
    }
    return str.trim();
}
//#endregion

//#region Build HTML
snifferUtils.getHtmlElementObjs = function(htmlRootId, options = {}) {
    return snifferUtils.addHtmlElementObjs({}, htmlRootId, options);
}
snifferUtils.addHtmlElementObjs = function(htmlObjs, htmlRootId, options = {}) {
    let htmlRootObj = document.getElementById(htmlRootId);
    if (htmlRootObj) snifferUtils.addHtmlObjs(htmlObjs, htmlRootObj, options);
    else dev.error("snifferUtils.mjs addHtmlElementObjs rootHtmlId ", rootHtmlId, "NOT found!");
    return htmlObjs;
}
snifferUtils.addHtmlObjs = function(htmlObjs, htmlObj, options = {}) {
    if (htmlObj.id) {
        htmlObjs[htmlObj.id] = document.getElementById(htmlObj.id);
        if (options.onClickHandler) htmlObj.onclick = options.onClickHandler;
        if (options.onChangeHandler && htmlObj.classList.contains("cssDropDown")) {
            htmlObj.onchange = options.onChangeHandler;
        }
    }
    for (const childObj of htmlObj.children) {
        snifferUtils.addHtmlObjs(htmlObjs, childObj, options);
    }
}
//#endregion

//#region Sniffer Storage
snifferUtils.getSnifferSettings = async function() {
    var result = await chrome.storage.local.get([
            "m3u8SniffingEnabled", "m3u8InjectionEnabled", "autoPlayEnabled", 
            "autoPlayText", "directM3u8Enabled", "useKeyboardShortcuts",
    ]);
    let options = {};
    //dev.verbose("snifferUtils.mjs getSnifferSettings result =" + result);
    options.m3u8SniffingEnabled = result.m3u8SniffingEnabled ?? true;
    options.m3u8InjectionEnabled = result.m3u8InjectionEnabled ?? true;
    options.useKeyboardShortcuts = result.useKeyboardShortcuts ?? true;
    options.directM3u8Enabled = result.directM3u8Enabled ?? false;
    options.autoPlayEnabled = result.autoPlayEnabled ?? "None";
    options.autoPlayText = result.autoPlayText ?? "";
    //dev.verbose("snifferUtils.mjs getSnifferSettings options =", options);
    let iconPath = options.m3u8SniffingEnabled ?
        "icons/m3uSniffer-on-64px.png" : "icons/m3uSniffer-off-64px.png";
    chrome.action.setIcon({"path":iconPath});
    return options;
}

snifferUtils.saveSnifferSettings = async function(options = {}) {
    //dev.verbose("snifferUtils.mjs saveSnifferSettings options = " + options);
    if (options.hasOwnProperty("m3u8SniffingEnabled")) {
        await chrome.storage.local.set({"m3u8SniffingEnabled": options.m3u8SniffingEnabled});
    }
    if (options.hasOwnProperty("m3u8InjectionEnabled")) {
        await chrome.storage.local.set({"m3u8InjectionEnabled": options.m3u8InjectionEnabled});
    }
    if (options.hasOwnProperty("useKeyboardShortcuts")) {
        await chrome.storage.local.set({"useKeyboardShortcuts": options.useKeyboardShortcuts});
    }
    if (options.hasOwnProperty("directM3u8Enabled")) {
        await chrome.storage.local.set({"directM3u8Enabled": options.directM3u8Enabled});
    }
    if (options.hasOwnProperty("autoPlayEnabled")) {
        await chrome.storage.local.set({"autoPlayEnabled": options.autoPlayEnabled});
    }
    if (options.hasOwnProperty("autoPlayText")) {
        await chrome.storage.local.set({"autoPlayText": options.autoPlayText});
    }
}
//#endregion

//#region Tab Functions
snifferUtils.sendMessage = async function(message) {
    //dev.verbose("snifferUtils.mjs sendMessage message = ", message);
    try { await chrome.runtime.sendMessage(message);
    } catch (err) { /*dev.verbose("snifferUtils.mjs sendMessage exception = ", err);*/ }
}
snifferUtils.sendToAllTabs = async function(message = {}) {
    let allTabs = await chrome.tabs.query({});
    allTabs.forEach(tab => { snifferUtils.sendMessageToTab(message, tab); }); //??? await
}
snifferUtils.getAllTabResponses = async function(message = {}, options) {
    //dev.debug("*** snifferUtils.mjs getAllTabsResponses message =", message);
    let responses = [], allTabs = await chrome.tabs.query({});
    for (const tabObj of allTabs) {
        let response = await snifferUtils.sendMessageToTab(message, tabObj);
        if (response && Object.keys(response).length > 0) {
            //dev.debug("*** snifferUtils.mjs getAllTabsResponses tabId, response =", tabObj.id, response.historyIndex);
            responses.push({tabId:tabObj.id, response});
        }
    }
    //dev.debug("*** snifferUtils.mjs getAllTabsResponses responses =", responses.length, responses);
    return responses;
}
snifferUtils.sendMessageToTab = async function(message, tabObj = null) { //??? tabId?
    var targetTabObj = tabObj ?? await snifferUtils.getLastActiveTab();
    //dev.debug("snifferUtils.mjs sendMessageToTab targetTabObj =", targetTabObj);
    if (!targetTabObj) return {};
    try { var response = await chrome.tabs.sendMessage(targetTabObj.id, message);
    } catch (err) { /*dev.verbose("snifferUtils.mjs sendMessageToTab exception = ", err);*/ }
    //dev.verbose("snifferUtils.mjs sendMessageToTab response = ", response);
    return response ?? {};
}
snifferUtils.getTabObj = async function(tabId) {
    try { var tabObj = await chrome.tabs.get(tabId);
    } catch (err) { /*dev.verbose("snifferUtils.mjs getTabObj exception = ", err);*/ }
    return tabObj;
}
snifferUtils.getActiveTab = async function() {
    var queryOptions = { active: true, currentWindow: true };
    try { var tabs = await chrome.tabs.query(queryOptions);
    } catch (err) { /*dev.verbose("snifferUtils.mjs getActiveTab exception = ", err);*/ }
    return tabs ? tabs[0] : null;
}
snifferUtils.clearRedirectHistory = async function(urlText = snifferUtils.redirectTag) {
/* v2.0.1 - Don't use history permissions
    //dev.verbose("background.js clearRedirectHistory urlText =", urlText);
    let textHistory = await chrome.history.search({text:urlText});
    //dev.verbose("background.js clearRedirectHistory textHistory =", textHistory);
    textHistory.forEach(async (item) => {chrome.history.deleteUrl({url:item.url});});
    //textHistory = await chrome.history.search({text:urlText}); //??? Debugging
    //dev.verbose("background.js clearRedirectHistory textHistory (1) =", textHistory);
*/
}
snifferUtils.openLinkInNewTab = async function(url) { //??? Add to SnifferUtils???
    if (!url) return;
    try { await chrome.tabs.create({active:true, url});
    } catch (err) { /*dev.alert("background.js openLinkInNewTab exception = " + err);*/ }
}
snifferUtils.openLinkInNewWindow = async function(url) {
    if (!url) return;
    try { await chrome.windows.create({focused:true, url});
    } catch (err) { /*dev.alert("background.js openLinkInNewWindow exception = " + err);*/ }
}
//#endregion

//#region Player Functions
snifferUtils.getPlayerUrl = async function(tabObj = null, m3u8Url = "", siteUrl) {
    //dev.verbose("snifferUtils.mjs getPlayerUrl m3u8Url =", m3u8Url);
    //dev.verbose("snifferUtils.mjs getPlayerUrl siteUrl =", siteUrl);
    var playerUrl = chrome.runtime.getURL(snifferUtils.playerPath) + "?";
    var siteParam = "";
    if (siteUrl) siteParam = siteUrl; //???
    else if (tabObj) {
        //dev.verbose("snifferUtils.mjs getPlayerUrl tabObj =", tabObj);
        //dev.alert("snifferUtils.mjs getPlayerUrl tabObj.id =", tabObj.id);
        if (tabObj.url.startsWith("http")) {
            siteParam = encodeURI(snifferUtils.stripUrlHashSpam(tabObj.url));
        } 
    }
    if (siteParam) {
        if (snifferUtils.getUrlFileExt(siteParam) == "m3u8") siteParam = "";
        else siteParam = siteParam.split("#")[0].split("?")[0];
    }
    //dev.verbose("getPlayer siteParam = " + siteParam);
    if (siteParam) playerUrl += "site=" + siteParam + "&";
    playerUrl = snifferUtils.stripLastUrlChar(playerUrl);
    if (m3u8Url) playerUrl += "#" + m3u8Url;
    //dev.verbose(snifferUtils.mjs "getPlayer playerUrl done =", playerUrl);
    return playerUrl;
}

snifferUtils.playM3u8 = async function(m3u8Url, siteUrl, tabId, event) {
    //dev.trace(snifferUtils.mjs "playM3u8 m3u8Url =", m3u8Url);
    var activeTabObj = await snifferUtils.getTabObj(tabId);
    if (!m3u8Url || !activeTabObj) return;
    var playerUrl = await snifferUtils.getPlayerUrl(activeTabObj, m3u8Url, siteUrl);
    //dev.debug("snifferUtils.mjs playM3u8 play playerUrl =", playerUrl);
    //dev.alert("snifferUtils.mjs playM3u8 play playerUrl =", playerUrl);
    if (event.ctrlKey || event.shiftKey) {
        try {
            if (event.shiftKey) await chrome.windows.create({focused:true, url:playerUrl});
            else await chrome.tabs.create({active:true, url:playerUrl});
            return;
        } catch (err) { dev.warn("snifferUtils.mjs playM3u8 new tab/window exception = ", err); }
    }
    //if (activeTabObj.url == playerUrl) await chrome.tabs.reload(activeTabObj.id); //??? For block?
    //else {
        if (activeTabObj.url.startsWith("http")) { //Adds history
            try { await chrome.scripting.executeScript({target: {tabId: activeTabObj.id}, 
                func: (playerUrl) => { window.location.assign(playerUrl); }, args: [playerUrl]});
            } catch (err) { /*dev.log("snifferUtils.mjs playM3u8 executeScript exception = ", err);*/ }
        } else {                
            try { await chrome.tabs.update(activeTabObj.id, {url: playerUrl}); //No history
            } catch (err) { /*dev.warn("snifferUtils.mjs playM3u8 update url exception = ", err);*/ }
            //setTimeout(async () => await chrome.tabs.reload(activeTabObj.id), 10);
            await chrome.tabs.reload(activeTabObj.id); //??? Update hash
       }
    //}
    await chrome.tabs.update(activeTabObj.id, { active: true });
    return m3u8Url;
}
//#endregion

export default snifferUtils;
