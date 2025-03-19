// background.js - m3u8 Sniffer background process
// (C) 2021-2024 Richard Stam, SigmaFxDx Software
console.log("Hello m3u8 Sniffer Background!");
import snifferUtils from "/resources/shared/snifferUtils.mjs";
import * as dev from '/resources/shared/devlog.mjs';
var ctx = {};

//#region Ctx Init
(async () => { await ctxInit(); })();

async function ctxInit() {
    ctx.options = await snifferUtils.getSnifferSettings();
    ctx.options.devForceReloads = false; //Don't cache for dev
    if (!ctx.options.devForceReloads) await loadOverlayHtmlSource();
    else await snifferUtils.clearM3u8NetRules();
    await snifferUtils.setM3u8NetRules(ctx.options.directM3u8Enabled);
    //manifest permission "declarativeNetRequestFeedback", for debugging
    //chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((matchInfo) => { 
    //    dev.debug("background.js onRuleMatchedDebug matchInfo =", matchInfo);
    //});
    dev.verbose("background.js loading ctx =", ctx);
}
async function loadOverlayHtmlSource() {
    let overlayHtmlPath = chrome.runtime.getURL("overlay.html");
    let cache = ctx.options.devForceReloads ? "reload" : "default";
    let overlayHtmlFetch = await fetch(overlayHtmlPath, {cache});
    ctx.overlayHtmlSource = await overlayHtmlFetch.text();
    return ctx.overlayHtmlSource;
}
//#endregion

//#region Handle m3u8
async function webPageHandleM3u8(tabId, tabObj, requestM3u8) {
    //dev.trace("background.js webPageHandleM3u8 tabId =", tabId);
    if (tabId <= 0) return; //Tab was probably closed
    if (!tabObj) tabObj = await chrome.tabs.get(tabId);
    if (!tabObj) return; //Tab was probably closed
    if (tabObj.discarded) return;
    if (tabObj.pendingUrl) return;
    if (tabObj.status == "unloaded") return;
    //dev.verbose("background.js webPageHandleM3u8 tabObj =", tabObj);
    //dev.verbose("background.js webPageHandleM3u8 requestM3u8 =", requestM3u8);
    
    if (!tabObj.url.startsWith("http")) {
        try {
            //dev.verbose("background.js updatePlayerStatus requestM3u8 =", requestM3u8);
            await chrome.tabs.sendMessage(tabId, { command: "updatePlayerStatus", requestM3u8 });
        } catch (err) { /*dev.warn("background.js updatePlayerStatus exception = ", err);*/ }
        return;
    }
    try {
        var scriptIsLoadedResult = await chrome.scripting.executeScript({ target: {tabId}, 
            func: (requestM3u8) => {
                let ctxIsDefined = typeof ctx != "undefined";
                if (!ctxIsDefined) {
                    globalThis.ctx = {}; ctx.m3u8History = [];
                    ctx.firstM3u8 = requestM3u8; ctx.m3u8Count = 0;
                }
                ctx.lastM3u8 = requestM3u8; ctx.m3u8Count++; 
                let scriptIsLoaded = typeof updateOverlayStatus != "undefined";
                return {ctxIsDefined, scriptIsLoaded};
            }, args: [requestM3u8]
        });
    } catch (err) { 
        dev.warn("background.js webPageHandleM3u8 scriptIsLoadedResult exception = ", err);
        return;
    }
    //dev.verbose("background.js webPageHandleM3u8 scriptIsLoadedResult =", scriptIsLoadedResult);

    let overlayCtxIsDefined = scriptIsLoadedResult[0].result.ctxIsDefined;
    if (!overlayCtxIsDefined) {
        await webPageInjectOverlay(tabId, tabObj, requestM3u8);
    } else {
        let scriptIsLoaded = scriptIsLoadedResult[0].result.scriptIsLoaded;
        if (scriptIsLoaded) {
            try {
                await chrome.tabs.sendMessage(tabId, {command: "updateOverlayStatus", requestM3u8});
            } catch (err) { dev.warn("background.js webPageHandleM3u8 scriptIsLoaded exception = ", err); }
        }
    }

    //dev.verbose("background.js webPageHandleM3u8 autoPlayEnabled = ", ctx.options.autoPlayEnabled);
    if (ctx.options.autoPlayEnabled != "None") await checkAutoPlay(tabId, tabObj, requestM3u8);
}

async function checkAutoPlay(tabId, tabObj, requestM3u8) {
    //dev.verbose("background.js checkAutoPlay ctx.options = ", ctx.options);
    var autoPlay = ctx.options.autoPlayEnabled == "All";
    if (!autoPlay) { //Match
        let autoPlayURLs = ctx.options.autoPlayText.toLowerCase();
        autoPlayURLs = snifferUtils.whiteSpaceTrim(autoPlayURLs).trim().split(" ");
        let testUrl = tabObj.url.toLowerCase();
        autoPlay = autoPlayURLs.some((el) => {
            if (el.startsWith("//") || el.trim() == "") return false;
            return testUrl.indexOf(el) >= 0;
        });
    }
    if (autoPlay) {
        try {
            let playerUrl = await snifferUtils.getPlayerUrl(tabObj, requestM3u8);
            //dev.verbose("checkAutoPlay autoPlay playerUrl = ", playerUrl);
            await chrome.tabs.update(tabId, {url: playerUrl});
        } catch (err) { dev.warn("background.js checkAutoPlay tabs.update exception = ", err); }
    }
}
//#endregion

//#region Inject Overlay
async function webPageInjectOverlay(tabId, tabObj, requestM3u8) {
    //dev.verbose("background.js webPageInjectOverlay tabId = ", tabId);
    if (tabId <= 0) return; //Tab was probably closed
    var overlayHtmlSource = ctx.overlayHtmlSource;
    if (!overlayHtmlSource || ctx.options.devForceReloads) {
        overlayHtmlSource = await loadOverlayHtmlSource();
        ctx.overlayHtmlSource = overlayHtmlSource;
    }
    let playerUrl = await snifferUtils.getPlayerUrl(tabObj, null);
    try {
        await chrome.scripting.executeScript({ target: {tabId}, 
            func: (overlayHtmlSource, playerUrl, m3u8InjectionEnabled) => { 
                ctx.webPageDivHtml = overlayHtmlSource; 
                ctx.playerUrl = playerUrl;
                ctx.m3u8InjectionEnabled = m3u8InjectionEnabled;
            }, args: [overlayHtmlSource, playerUrl, ctx.options.m3u8InjectionEnabled]
        });
        await chrome.scripting.insertCSS({target: {tabId}, files:["overlay.css"]});
        await chrome.scripting.executeScript({target: {tabId}, files: ["./overlay.js"] });
    } catch (err) { dev.warn("background.js webPageInjectOverlay inject exception = ", err); }
}
//#endregion

//#region Message Handlers
chrome.runtime.onMessage.addListener(
function(message, sender, sendResponse) {
    //dev.trace("background.js runtime.onMessage message =", message);
    //dev.verbose("background.js runtime.onMessage, sender =", sender);
    var response = null;
    switch (message.command) {
        case "keepAlive":
            //dev.verbose("background.js onMessage keepAlive OK");
            response = { result:"OK" };
            break;
        case "SetSnifferOptions":
            Object.assign(ctx.options, message.snifferOptions);
            break;
        case "clearRedirectHistory":
            //dev.verbose("background.js onMessage clearRedirectHistory...");
            snifferUtils.clearRedirectHistory(); //??? await
            break;
        case "sendToAllTabs":
            if (message.message) snifferUtils.sendToAllTabs(message.message); //??? await
            break;
        case "openLinkInNewTab":
            snifferUtils.openLinkInNewTab(message.url); //??? await
            break;
        case "openLinkInNewWindow":
            snifferUtils.openLinkInNewWindow(message.url); //??? await
            break;
        default:
            dev.warn("background.js onMessage unkown command =", message.command);
    }
    if (response) {
        //dev.verbose("background.js onMessage sendResponse response =", response);
        sendResponse(response);
    }
    //return true; // Needed if sendResponse is called asynclly
});
//#endregion

//#region Network Sniffer
const networkFilters = { urls: [ /* "*://*.shidurlive.com/*", ... */] };

chrome.webRequest.onBeforeRequest.addListener(
async function (details) {
    //dev.trace("background.js onBeforeRequest webRequest details =", details)
    //if (details.tabId <= 0) return; //???
    //dev.verbose("background.js onBeforeRequest tabId =", details.tabId);
    if (!ctx || !ctx.options) { await ctxInit(); }
    //dev.trace("background.js onBeforeRequest webRequest ctx =", ctx)
    if (!ctx.options.m3u8SniffingEnabled) return;
    let requestM3u8 = details.url;

    if (!snifferUtils.m3u8RegexFilter.test(requestM3u8)) return;
    //dev.verbose("background.js onBeforeRequest m3u8 details =", details);

/*
    let tabObj = null;
    if (details.tabId >= 0) tabObj = await snifferUtils.getTabObj(details.tabId);
    else tabObj = await snifferUtils.getActiveTab(); //???
*/

    let tabObj = null;
    if (details.tabId >= 0) tabObj = await snifferUtils.getTabObj(details.tabId);
    else /*if (ctx.options.useActiveTabEnabled)*/ { //???
/*
        let activeTabObj = await snifferUtils.getActiveTab();
        //dev.verbose("*** background.js onBeforeRequest getM3u8HistoryMatch tabId, activeTabObj =", activeTabObj?.id, activeTabObj);
        let message = { command: "getM3u8HistoryMatch", requestM3u8};
        if (activeTabObj) {
            let response = await snifferUtils.sendMessageToTab(message, activeTabObj);
            if (response && response.historyIndex >= 0) {
                //dev.verbose("*** background.js onBeforeRequest getM3u8HistoryMatch tabId, response =", activeTabObj.id, response);
                tabObj = activeTabObj;
            }
        }
*/
        let activeResponse, isSameSource = false, activeTabObj = await snifferUtils.getActiveTab();
        let message = { command: "getM3u8HistoryMatch", requestM3u8, initiator:details.initiator};
        if (activeTabObj) {
            activeResponse = await snifferUtils.sendMessageToTab(message, activeTabObj);
            //dev.verbose("*** background.js onBeforeRequest getM3u8HistoryMatch tabId, activeResponse=", activeTabObj.id, activeResponse);
            isSameSource = activeResponse.isSameSource ?? false;
            if (activeResponse.historyIndex >= 0) {
                //dev.verbose("*** background.js onBeforeRequest getM3u8HistoryMatch tabId, activeResponse=", activeTabObj.id, activeResponse);
                tabObj = activeTabObj;
            }
        }
        if (!tabObj) {
            let responses = await snifferUtils.getAllTabResponses(message);
            if (responses.length > 0) {
                //dev.verbose("*** background.js onBeforeRequest getAllTabResponses responses =", responses);
                let historyIndex = responses.findIndex((item) => item.response.historyIndex >= 0);
                if (historyIndex >= 0) {
                    tabObj = await snifferUtils.getTabObj(responses[historyIndex].tabId);
                    //dev.verbose("*** background.js onBeforeRequest historyIndex tabId =", tabObj.id, responses[historyIndex].response);
                    //dev.verbose("*** background.js onBeforeRequest historyIndex tabObj =", tabObj);
                }
            }
        }
        if (!tabObj && activeTabObj && !isSameSource) {
            try {
                let isSameSourceQuery = await chrome.scripting.executeScript({ target: {tabId:activeTabObj.id}, 
                    func: (initiator) => {
                        let isSameSource = window.location.href.startsWith(initiator);
                        if (!isSameSource) {
                            let frames = document.getElementsByTagName("iframe");
                            for (const frame of frames) {
                                isSameSource = frame.src.startsWith(initiator);
                                if (isSameSource) break;
                            }
                        }
                        //dev.verbose("*** overlay.js INJECTED isSameSource, initiator", isSameSource, initiator)
                        return isSameSource;
                    }, args: [details.initiator]
                });
                //dev.verbose("*** background.js onBeforeRequest isSameSourceQuery =", isSameSourceQuery[0]);
                isSameSource = isSameSourceQuery[0].result;
            } catch (err) { 
                dev.warn("background.js webPageHandleM3u8 scriptIsLoadedResult exception = ", err);
            }
        }
        //dev.verbose("*** background.js onBeforeRequest isSameSource =", isSameSource);
        if (!tabObj && isSameSource) tabObj = activeTabObj;
        //if (!tabObj) tabObj = activeTabObj;
    }
    if (!tabObj) return;
    let tabId = tabObj.id;
    //dev.verbose("background.js onBeforeRequest tabId =", tabId);
    //dev.verbose("background.js onBeforeRequest m3u8 tabObj =", tabObj);

    if (details.type != "main_frame") {
        await webPageHandleM3u8(tabId, tabObj, requestM3u8);
    } else {
        if (!ctx.options.directM3u8Enabled) return;
        //dev.verbose("background.js onBeforeRequest main_frame m3u8 details =", details);
        //dev.verbose("background.js onBeforeRequest main_frame m3u8 tabObj =", tabObj);
        //let playerTabObj = details.initiator ? tabObj : null;
        let playerTabObj = null, siteUrl = "";
        if (details.initiator) {
            playerTabObj = tabObj;
            //dev.verbose("background.js onBeforeRequest initiator url =", tabObj.url);
            if (tabObj.url) {
                if (tabObj.url.startsWith("http")) siteUrl = tabObj.url;
                else {
                    let playerUrlObj = new URL(tabObj.url)
                    siteUrl = playerUrlObj.searchParams.get("site");
                    //dev.verbose("background.js onBeforeRequest initiator siteUrl =", siteUrl);
                }
            }
        }
        if (!siteUrl) return; //Redirect Rules handle m3u8 playing

        //let playerUrl = chrome.runtime.getURL(snifferUtils.playerPath) + "#" + requestM3u8;
        //let playerUrl = await snifferUtils.getPlayerUrl(tabObj, requestM3u8, "", lastTabId);
        let playerUrl = await snifferUtils.getPlayerUrl(playerTabObj, requestM3u8, siteUrl);
        //dev.alert("background.js onBeforeRequest main_frame playerUrl =", playerUrl);
        try {
            //if (playerUrl == tabObj.url) await chrome.tabs.reload(tabId); //For block only?
            //else {
                //dev.verbose("background.js onBeforeRequest main m3u8 details =", details);
                //dev.verbose("background.js onBeforeRequest main m3u8 tabObj =", tabObj);
                await chrome.tabs.update(tabId, {url: playerUrl});
                //await chrome.tabs.reload(tabId); //reload hash?
            //}
        } catch (err) {
            dev.warn("background.js onBeforeRequest main_frame direct m3u8 exception =", err);
        }
    }
}, networkFilters);
//#endregion
