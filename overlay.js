// overlay.js - JS to handle the m3u8 web page overlays
// (C) 2021-2024 Richard Stam, SigmaFxDx Software
console.log("Hello overlay.js!");

//#region ctx Init
if (typeof ctx == "undefined") {
    var ctx = {};
    ctx.firstM3u8 = "[none]";
    ctx.lastM3u8 = "[none]";
    ctx.m3u8Count = 0;
    ctx.webPageDivHtml = "";
    ctx.playerUrl = "";
    ctx.m3u8History = [];
}
var html = {}, fun = {};
ctx.html = html;
ctx.fun = fun;
ctx.isAltRight = false;
ctx.isAltKey = false;
ctx.isCtrlKey = false;
ctx.isShiftKey = false;

(async () => {
    await getLocalStorage(); //???
    await loadOverlayDiv();
    await updateOverlayProperties();
    addEventListeners();
    addMessageHandlers(); 
    //console.log("overlay.js init ctx =", ctx);
})();

async function updateOverlayProperties() {
    await getLocalStorage();
    setDisplayStatus();
    updateOverlayStatus();
    setKeepAliveLevel();
}
async function getLocalStorage(callback, ...args) {
    let result = await chrome.storage.local.get(
        ["m3u8ShortOverlay", "m3u8ShowFirstLast", "m3u8FirstLastIndex", 
        "m3u8InjectionEnabled", "useKeyboardShortcuts", "directM3u8Enabled"]
    );
    //console.trace("overlay.js getLocalStorage result =", result);
    ctx.isShortMsg = result.m3u8ShortOverlay ?? false;
    ctx.showFirstLast = result.m3u8ShowFirstLast ?? "first";
    ctx.firstLastIndex = result.m3u8FirstLastIndex ?? 0;
    ctx.m3u8InjectionEnabled = result.m3u8InjectionEnabled ?? true;
    ctx.useKeyboardShortcuts = result.useKeyboardShortcuts ?? true;
    ctx.directM3u8Enabled = result.directM3u8Enabled ?? false;
    let keepAliveLevel = sessionStorage.getItem("keepAliveLevel") ?? "2";
    ctx.keepAliveLevel = parseInt(keepAliveLevel);
}
async function setKeepAliveLevel() {
    sessionStorage.setItem("keepAliveLevel", ctx.keepAliveLevel);
    if (ctx.keepAliveLevel) await sendKeepAliveMessage();
    if (ctx.KeepAliveId) clearInterval(ctx.KeepAliveId);
    if (ctx.keepAliveLevel == 2) {
        ctx.KeepAliveId = setInterval(sendKeepAliveMessage, 3000);
    }
}
//#endregion

//#region Html Init
async function loadOverlayDiv() {
    if (!ctx.webPageDivHtml) return;
    var m3u8LayerObj = document.getElementById("m3u8Layer");
    if (!m3u8LayerObj) {
        let m3u8LayerDiv = document.createElement("div");
        m3u8LayerDiv.id = "m3u8Layer";
        m3u8LayerDiv.style.display = "inline";
        document.body.appendChild(m3u8LayerDiv);
    }
    html.m3u8Layer = document.getElementById("m3u8Layer");
    html.m3u8Layer.innerHTML = ctx.webPageDivHtml;
    addHtmlElements(html); 
    ctx.webPageDivHtml = "";
}
function addHtmlElements(html, htmlObj = html.m3u8Layer) {
    return addElement(html, htmlObj);
}
function addElement(html, htmlObj) {
    if (htmlObj.id) html[htmlObj.id] = document.getElementById(htmlObj.id);
    if (typeof fun[htmlObj.id] == "function") htmlObj.onclick = buttonClick;
    for (const childObj of htmlObj.children) addElement(html, childObj);
    return html;
}
async function buttonClick(event) { 
    let htmlObj = event.target;
    if (!htmlObj || !htmlObj.id) return;
    //console.log("overlay.js buttonClick htmlObj.id =", htmlObj.id);
    //console.log("overlay.js buttonClick event =", event);
    htmlObj.classList.add("olClicked");
    setTimeout(() => {htmlObj.classList.remove("olClicked");}, 80);
    if (typeof fun[htmlObj.id] == 'function') {
        //alert("overlay.js buttonClick function htmlObj.id = " + htmlObj.id);
        await fun[htmlObj.id](event);
    }
}
async function doLinkClick(element, event, useAltKey = true) {
    //console.log("overlay.js doLinkClick event =", event);
    //alert("overlay.js doLinkClick element.id = " + element.id);
    if (ctx.keepAliveLevel) await sendKeepAliveMessage(); //???
    event.preventDefault();
    keyClickLink(element, event, useAltKey);
}
function keyClickLink(element, event, useAltKey = false) {
    //console.log("overlay.js keyClickLink element.id =", element.id);
    //console.log("overlay.js keyClickLink event =", event);
    //alert("overlay.js keyClickLink element.id = " + element.id);
    let altKey = event.altlKey || ctx.isAltKey || ctx.isAltRight;
    let ctrlKey = event.ctrlKey || ctx.isCtrlKey;
    let shiftKey = event.shiftlKey || ctx.isShiftKey;
    //console.log("overlay.js keyClickLink isAltKey, isCtrlKey, isShiftKey =", 
    //        ctx.isAltKey, ctx.isCtrlKey, ctx.isShiftKey);
    let eventOptions = {ctrlKey, shiftKey};
    if (useAltKey) eventOptions.altKey = altKey;
    //ctx.isAltRight = ctx.isAltKey = ctx.isCtrlKey = ctx.isShiftKey = false; //???
    var clickEvent = new MouseEvent("click", eventOptions);
    event.stopPropagation();
    event.stopImmediatePropagation();
    element.dispatchEvent(clickEvent);
}
//#endRegion

//#region Html Buttons
/*
fun.m3u8PlayLink = async function(event) {
    if (!ctx.options.directM3u8Enabled) {
        preventDefault();
        await fun.m3u8PlayButton(event);
    }
}
*/
fun.m3u8PlayButton = async function(event) {
    //console.trace("overlay.js m3u8PlayButton event =", event);
    //alert("overlay.js m3u8PlayButton ctx.playerUrl = " + ctx.playerUrl);
    event.preventDefault(); //Needed!
    let m3u8Url = ctx.showFirstLast == "first" ? ctx.firstM3u8 : ctx.lastM3u8;
    let url = ctx.playerUrl + "#" + m3u8Url;
    if (ctx.keepAliveLevel) await sendKeepAliveMessage();
    //ctx.isAltRight = ctx.isAltKey = ctx.isCtrlKey = ctx.isShiftKey = false; //???
    if (event.ctrlKey || event.shiftKey) {
        if (event.shiftKey) sendMessage({command:"openLinkInNewWindow", url}); //??? error?
        else sendMessage({command:"openLinkInNewTab", url}); //??? await 
        return;
    }
    if (url == window.location.href) window.location.reload();
    else window.location.assign(url);
};
fun.m3u8CopyButton = function(event) {
    let savPageYOffset = window.scrollY;
    let savPageXOffset = window.scrollX;
    let m3u8Url = ctx.showFirstLast == "first" ? ctx.firstM3u8 : ctx.lastM3u8;
    let m3u8InputObj = document.createElement("input");
    m3u8InputObj.value = m3u8Url.trim();
    document.body.appendChild(m3u8InputObj);
    m3u8InputObj.focus(); m3u8InputObj.select();
    document.execCommand('copy');
    m3u8InputObj.parentNode.removeChild(m3u8InputObj);
    //console.log("overlay.js copyText = ", m3u8InputObj.value);
    window.scrollTo(savPageXOffset, savPageYOffset);
};
fun.m3u8CloseButton = function(event) {
    html.m3u8Layer.style.display = "none";
};
fun.m3u8HideButton = async function(event) {
    await chrome.storage.local.set({"m3u8ShortOverlay": "left"});
    setDisplayStatus("left");
    sendUpdatePropertiesMessage();
};
fun.m3u8HideRightButton = async function(event) {
    await chrome.storage.local.set({"m3u8ShortOverlay": "right"});
    setDisplayStatus("right");
    sendUpdatePropertiesMessage();
};
fun.m3u8ExpandOverlay = async function(event) {
    await chrome.storage.local.set({"m3u8ShortOverlay": false});
    setDisplayStatus(false);
    sendUpdatePropertiesMessage();
};
fun.showFirstLastChange = async function(event) {
    let selectedIndex = html.showFirstLast.selectedIndex;
    ctx.showFirstLast = html.showFirstLast.options[selectedIndex].value;
    ctx.firstLastIndex = selectedIndex;
    await chrome.storage.local.set({"m3u8FirstLastIndex": selectedIndex});
    await chrome.storage.local.set({"m3u8ShowFirstLast": ctx.showFirstLast});
    updateOverlayStatus();
    sendUpdatePropertiesMessage();
};
//#endregion

//#region Utility Functions
function setDisplayStatus(isShortMsg = ctx.isShortMsg || false) {
    //console.log("overlay.js setDisplayStatus isShortMsg =", isShortMsg);
    html.showFirstLast.selectedIndex = ctx.firstLastIndex;
    if (isShortMsg && isShortMsg != "right") isShortMsg = "left";
    html.m3u8LinkSpan.style.display = isShortMsg ? "none" : "inline";
    html.titleText.innerText = isShortMsg ? "m3u8" : "m3u8 Sniffer";
    html.m3u8OverlayDiv.style.minWidth = isShortMsg ? "12px" : html.m3u8OverlayDiv.style.maxWidth;
    html.m3u8OverlayDiv.style.left = isShortMsg != "right" ? "0px" : null;
    html.m3u8OverlayDiv.style.right = isShortMsg == "right" ? "0px" : null;
    html.m3u8ExpandOverlay.style.display = isShortMsg ? "inline" : "none";
    html.m3u8HideButton.style.display = isShortMsg == "left" ? "none" : "inline";
    html.m3u8HideRightButton.style.display = isShortMsg == "right" ? "none" : "inline";
    html.m3u8OverlayDiv.style.display = ctx.m3u8InjectionEnabled ? "inline" : "none";
}
function updateOverlayStatus(message = {}) {
    if (message.requestM3u8) updateM3u8History(message.requestM3u8);
    if (message.hasOwnProperty("m3u8InjectionEnabled")) {
        ctx.m3u8InjectionEnabled = message.m3u8InjectionEnabled;
        html.m3u8OverlayDiv.style.display = ctx.m3u8InjectionEnabled ? "inline" : "none";
    }
    if (message.hasOwnProperty("useKeyboardShortcuts")) {
        ctx.useKeyboardShortcuts = message.useKeyboardShortcuts;
    }
    if (message.hasOwnProperty("directM3u8Enabled")) {
        ctx.directM3u8Enabled = message.directM3u8Enabled;
        //console.log("overlay.js updateOverlayStatus directM3u8Enabled =", ctx.directM3u8Enabled);
    }
    html.tabM3u8Count.innerText = ctx.m3u8Count.toString().trim();
    let m3u8LinkText = ctx.showFirstLast == "first" ? ctx.firstM3u8 : ctx.lastM3u8;
    if (m3u8LinkText.length > 350) m3u8LinkText = m3u8LinkText.substring(0, 347) + " ...";
    html.m3u8LinkText.innerText = m3u8LinkText;
    html.m3u8Link.href = (ctx.showFirstLast == "first" ? ctx.firstM3u8 : ctx.lastM3u8);
    html.titleM3u8Link.href = ctx.showFirstLast == "first" ? ctx.firstM3u8 : ctx.lastM3u8;
    html.titleM3u8Link.title = ctx.showFirstLast == "first" ? ctx.firstM3u8 : ctx.lastM3u8;
    html.m3u8PlayLink.href = ctx.playerUrl + "#" + html.m3u8Link.href;
}
function updateM3u8History(requestM3u8) {
    //console.log("*** overlay.js updateM3u8History requestM3u8 =", requestM3u8);
    if (ctx.m3u8History.length == 0) m3u8HistoryInit();
    let historyIndex = ctx.m3u8History.findIndex((item) => item.m3u8Url == requestM3u8);
    if (historyIndex >= 0) ctx.m3u8History[historyIndex].count++;
    else {
        ctx.m3u8History.push({ m3u8Url:requestM3u8, count:1 });
        historyIndex = ctx.m3u8History.length - 1;
        //console.log("*** overlay.js updateM3u8History NEW m3u8History =", ctx.m3u8History);
    }
    ctx.m3u8History.lastIndex = historyIndex;
    ctx.m3u8History.count++;
}
function m3u8HistoryInit() {
    ctx.m3u8History.push({ m3u8Url:ctx.firstM3u8, count:1 });
    ctx.m3u8History.count = 1;
    if (ctx.firstM3u8 != ctx.lastM3u8) {
        ctx.m3u8History.push({ m3u8Url:ctx.lastM3u8, count:1 });
        ctx.m3u8History.count++;
    }
    //console.log("*** overlay.js m3u8HistoryInit m3u8History =", ctx.m3u8History);
}
//#endregion

//#region Message Handlers
async function sendMessage(message) {
    try { var response = await chrome.runtime.sendMessage(message);
    } catch (err) { /*console.log("overlay.js sendMessage exception =", err);*/ }
    //console.log("overlay.js sendMessage result =", response?.result);
    return response?.result;
}
async function sendKeepAliveMessage() {
    var response = await sendMessage({"command":"keepAlive"});
    //console.log("overlay.js sendKeepAliveMessage result =", response?.result);
}
async function sendUpdatePropertiesMessage() {
    await sendMessage({command:"sendToAllTabs", message:{command:"updateOverlayProperties"}});
}

function addMessageHandlers() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        //console.log("overlay.js updateOverlayStatus message =", message);
        //console.log("overlay.js updateOverlayStatus sender =", sender);
        var response = null;
        switch (message.command) {
            case "updateOverlayStatus":
                updateOverlayStatus(message);
                break;
            case "updateOverlayProperties":
                updateOverlayProperties();
                break;
            case "PopUpRefreshData":
                response = { siteUrl: window.location.href, m3u8Count: ctx.m3u8Count,
                    firstM3u8: ctx.firstM3u8, lastM3u8: ctx.lastM3u8, };
                break;
            case "getM3u8HistoryMatch":
                //console.log("*** overlay.js onMessage getM3u8HistoryMatch message =", message);
                let sameSource = window.location.href.startsWith(message.initiator);
                if (!sameSource) {
                    let frames = document.getElementsByTagName("iframe");
                    for (const frame of frames) {
                        sameSource = frame.src.startsWith(message.initiator);
                        if (sameSource) break;
                    }
                }
                let historyIndex = ctx.m3u8History.findIndex((item) => item.m3u8Url == message.requestM3u8);
                if (historyIndex >= 0) ctx.hasUnkownTab = true;
                //console.log("*** overlay.js onMessage getM3u8HistoryMatch sameSource, historyIndex =", sameSource, historyIndex);
                if (historyIndex < 0 && !ctx.hasUnkownTab && !sameSource) response = {};
                else response = { hasUnkownTab:ctx.hasUnkownTab, historyIndex, isSameSource:sameSource };
                break;
            default:
                //console.log("overlay.js onMessage unkown command =", message);
        }
        if (response) {
            //console.log("overlay.js onMessage sendResponse response =", response);
            sendResponse(response);
        }
        //return true; // Needed if sendResponse is called asynclly
    });
}
//#endregion

//#region Event Handlers
function addEventListeners() {
    html.showFirstLast.onchange = fun.showFirstLastChange;

    html.m3u8PlayLink.onclick = (event) => {
        event.preventDefault(); //Needed!
        //event.stopPropagation(); //Needed?
        doLinkClick(html.m3u8PlayButton, event, false);
    }
    html.titleM3u8Link.onclick = (event) => {
        if (ctx.directM3u8Enabled) {
            if (!event.altKey) {
                event.preventDefault();
                doLinkClick(html.m3u8PlayButton, event);
            }
        } else {
            event.stopPropagation();
            event.stopImmediatePropagation();
        }
    }
    html.m3u8Link.onclick = (event) => {
        if (ctx.directM3u8Enabled) {
            if (!event.altKey) {
                event.preventDefault();
                doLinkClick(html.m3u8PlayButton, event);
            }
        } else {
            event.stopPropagation();
            event.stopImmediatePropagation();
        }
    }

    window.addEventListener("focus", function(event) {
        //console.log("overlay.js focus event =", event);
        ctx.isAltRight = ctx.isAltKey = ctx.isCtrlKey = ctx.isShiftKey = false;
    });
    window.addEventListener("keyup", function(event) {
        if (event.code == "AltRight") ctx.isAltRight = false;
        if (event.key == "Alt") ctx.isAltKey = false;
        if (event.key == "Control") ctx.isCtrlKey = false;
        if (event.key == "Shift") ctx.isShiftKey = false;
    });
    window.addEventListener("keydown", async function(event) {
        //console.log("overlay.js keydown event =", event);
        if (!ctx.useKeyboardShortcuts) return;
        if (event.code == "AltRight") ctx.isAltRight = true;
        if (event.key == "Alt") {ctx.isAltKey = true; event.preventDefault();}
        if (event.key == "Control") ctx.isCtrlKey = true;
        if (event.key == "Shift") ctx.isShiftKey = true;
        let code = event.code, key = event.key;
        let shiftKey = event.shiftKey || ctx.isShiftKey;
        let ctrlKey = event.ctrlKey || ctx.isCtrlKey;
        let altKey = event.altKey || ctx.isAltKey || ctx.isAltRight;
        if (altKey && shiftKey && code == "KeyX") {
            html.m3u8Layer.style.display = "inline";
            return;
        }
        if (html.m3u8Layer.style.display == "none") return;
        //console.log("overlay.js keydown key, code =", key, code);
        //console.log("overlay.js keydown isAltKey, isCtrlKey, isShiftKey =", 
        //        ctx.isAltKey, ctx.isCtrlKey, ctx.isShiftKey);
        if (altKey) {
            if (shiftKey) {
                if (code == "KeyF" || code == "KeyL") {
                    html.showFirstLast.value = code == "KeyF" ? "first" : "last";
                    fun.showFirstLastChange();
                }
            }
            if (code == "KeyC" ) html.m3u8CopyButton.click();
            else if (code == "KeyP") keyClickLink(html.m3u8PlayButton, event);
            else if (code == "KeyX") html.m3u8CloseButton.click();
            else if (key == "<" || key == ",") html.m3u8HideButton.click();
            else if (key == ">" || key == ".") html.m3u8HideRightButton.click();
            else if (key == "+" || key == "=") html.m3u8ExpandOverlay.click();
            else if (key == "Enter") {
                if (ctx.directM3u8Enabled) keyClickLink(html.m3u8PlayButton, event);
                else {
                    event.preventDefault();
                    keyClickLink(html.m3u8Link, event, true);
                }
            }
            else if (key == "?") {
                console.log("*** overlay.js keydown ? ctx =", ctx);
            }
        }
    });
}
//#endregion    
