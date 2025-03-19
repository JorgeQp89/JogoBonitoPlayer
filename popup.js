// popup.js - JS to handle the m3u8 Sniffer popup page
// (C) 2021-2024 Richard Stam, SigmaFxDx Software
console.info("Hello m3u8 Sniffer Popup!");
import snifferUtils from "/resources/shared/snifferUtils.mjs";
import * as dev from '/resources/shared/devlog.mjs';
var noneMsg = "No m3u8 links have been found on this site";

//#region Context Variabless
var html = {}, fun = {}, ctx = {html, fun};
ctx.options = {};
ctx.options.m3u8SniffingEnabled = true;
ctx.options.m3u8InjectionEnabled = true;
ctx.options.useKeyboardShortcuts = true;
ctx.options.directM3u8Enabled = false;
ctx.options.autoPlayEnabled = "None";
ctx.options.autoPlayText = "";
ctx.firstUrl = ""; ctx.firstM3u8 = noneMsg;
ctx.lastUrl = ""; ctx.lastM3u8 = noneMsg;
ctx.activeTabId = null;
ctx.activeTabObj = null;
ctx.isAltRight = false;
ctx.isAltKey = false;
ctx.isCtrlKey = false;
ctx.isShiftKey = false;
ctx.isTouch = false;
//#endRegion

//#region Init and Exit
//window.addEventListener("load", async function(event) {
document.addEventListener("DOMContentLoaded", async function(event) {
    //dev.verbose("popup.js window load navigator =", navigator);
    //ctx.isTouch = window.matchMedia("(pointer:coarse)").matches; //any-pointer
    //dev.verbose("popup.js window load isTouch =", ctx.isTouch);
    popupInit(); //??? await?
});
async function popupInit() {
    //dev.verbose("popup.js popupInit ...");
    let htmlOptions = {};
    htmlOptions.onClickHandler = htmlButtonClick;
    htmlOptions.onChangeHandler = htmlOnChange;
    html = snifferUtils.getHtmlElementObjs("popupBodyId", htmlOptions);
    ctx.html = html;

    let result = await snifferUtils.getSnifferSettings();
    Object.assign(ctx.options, result);
    html.m3u8SniffingEnabled.checked = ctx.options.m3u8SniffingEnabled;
    html.m3u8InjectionEnabled.checked = ctx.options.m3u8InjectionEnabled;
    html.useKeyboardShortcuts.checked = ctx.options.useKeyboardShortcuts;
    html.directM3u8Enabled.checked = ctx.options.directM3u8Enabled;
    html.autoPlayEnabled.value = ctx.options.autoPlayEnabled;
    html.autoPlayText.value = ctx.options.autoPlayText;
    addEventListeners();
    await sendRefreshMessage();
    dev.verbose("popup.js load done ctx =", ctx);
    //manifest permission "declarativeNetRequestFeedback", for debugging
    //let matchedRules = await chrome.declarativeNetRequest.getMatchedRules();
    //dev.verbose("popup.js EventListener load m3u8 matchedRules =", matchedRules);
    //dev.verbose("popup.js DOMContentLoaded done.");
}
//#endregion

//#region HTML Setup
async function htmlButtonClick(event) { 
    //dev.verbose("popup.js htmlButtonClick event =", event);
    //dev.verbose("popup.js htmlButtonClick tagName =", event.target.tagName);
    //dev.verbose("popup.js htmlButtonClick htmlObj.id =", event.target.id);
    //dev.alert("popup.js htmlButtonClick htmlObj.id =", event.target.id);
    if (!event.target.id) return;
    let htmlObj = event.target;
    if (htmlObj.classList.contains("cssbutton")) {
        showButtonClicked(htmlObj);
    }
    let buttonAction = fun[htmlObj.id];
    if (typeof buttonAction == 'function') {
        event.stopPropagation();
        await buttonAction(event);
    }
}
function showButtonClicked(buttonObj) {
    buttonObj.classList.add("clicked");
    setTimeout(() => { buttonObj.classList.remove("clicked"); }, 80);        
}
function htmlOnChange(event) {
    //dev.verbose("popup.js htmlOnChange event =", event.target.id);
    if (!event.target.id) return;
    let htmlObj = event.target;
    let onChangeAction = fun[htmlObj.id];
    if (typeof onChangeAction == 'function') {
        event.stopPropagation();
        onChangeAction(event);
    }
}
function updatePopupHtml() {
    //dev.trace("popup.js updatePopupHtml");
    let isPlayer = ctx.firstUrl.indexOf(snifferUtils.playerPath) >= 0;
    if (!isPlayer && ctx.firstUrl.indexOf(snifferUtils.settingsPath) >= 0) isPlayer = true;
    let siteUrl = !isPlayer ? ctx.firstUrl : "Sniffer TV Integrated Video Player (playing m3u8)";
    if (siteUrl.length > 140) siteUrl = siteUrl.substring(0, 138) + " ...";
    html.firstUrlLink.href = ctx.firstUrl;
    html.firstUrlDiv.innerText = siteUrl;
    html.firstUrlDiv.title = ctx.firstUrl;

    let firstM3u8Text = ctx.firstM3u8;
    if (firstM3u8Text.length > 350) firstM3u8Text = firstM3u8Text.substring(0, 347) + " ...";
    let firstM3u8Href = ctx.firstM3u8 == noneMsg ? "about:blank" : ctx.firstM3u8;
    html.firstM3u8Link.href = firstM3u8Href;
    html.firstM3u8Div.innerText = firstM3u8Text;
    //html.tabIndexSpan.innerHTML = "@" + (ctx.activeTabObj?.index ?? ""); //Debugging
    html.firstM3u8Div.title = ctx.firstM3u8;

    let lastM3u8Text = ctx.lastM3u8;
    if (lastM3u8Text.length > 350) lastM3u8Text = lastM3u8Text.substring(0, 347) + " ...";
    let lastM3u8Href = ctx.lastM3u8 == noneMsg ? "about:blank" : ctx.lastM3u8;
    html.lastM3u8Link.href = lastM3u8Href;
    html.lastM3u8Div.innerText = lastM3u8Text;
    let countStr = ctx.m3u8Count ? "[" + ctx.m3u8Count + "]" : "";
    html.m3u8CountSpan.innerHTML = countStr;
    html.lastM3u8Div.title = ctx.lastM3u8;
}
async function doLinkClick(element, event, useAltKey = true) { 
    //dev.verbose("popup.js doLinkClick element.id =", event.target.id);
    //dev.verbose("popup.js doLinkClick event =", event);
    //dev.alert("popup.js doLinkClick element.id =", element.id);
    await sendKeepAliveMessage();
    if (ctx.options.directM3u8Enabled) { //???
        event.preventDefault();
        //console.log("overlay.js doLinkClick event =", event);
        keyClickLink(element, event, useAltKey);
    }
}
function keyClickLink(element, event, useAltKey = false, options = {}) {
    //dev.debug("popup.js keyClickLink element = ", element);
    let altKey = event.altlKey || ctx.isAltKey || ctx.isAltRight;
    let ctrlKey = event.ctrlKey || ctx.isCtrlKey;
    let shiftKey = event.shiftlKey || ctx.isShiftKey;
    //dev.verbose("popup.js keyClickLink isAltKey, isCtrlKey, isShiftKey =", 
    //        ctx.isAltKey, ctx.isCtrlKey, ctx.isShiftKey);
    let eventOptions = {ctrlKey, shiftKey};
    if (useAltKey) eventOptions.altKey = altKey;
    Object.assign(eventOptions, options);
    ctx.isAltKey = ctx.isCtrlKey = ctx.isShiftKey = false; //???
    var clickEvent = new MouseEvent("click", eventOptions);
    element.dispatchEvent(clickEvent);
}
//#endregion

//#region Button Actions
fun.helpButton = function(event) {
    chrome.runtime.openOptionsPage();
};
fun.refreshButton = async function(event) {
    await sendRefreshMessage();
};
fun.m3u8SniffingEnabled = async function(event) {
    ctx.options.m3u8SniffingEnabled = html.m3u8SniffingEnabled.checked;
    var iconPath = (event.target.checked) ?
        "icons/m3uSniffer-on-64px.png" : "icons/m3uSniffer-off-64px.png";
    chrome.action.setIcon({"path":iconPath});
    await updateSnifferSettings();
    updateAllOverlays();
};
fun.m3u8InjectionEnabled = async function(event) {
    ctx.options.m3u8InjectionEnabled = html.m3u8InjectionEnabled.checked;
    await updateSnifferSettings();
    updateAllOverlays();
};
fun.directM3u8Enabled = async function(event) {
    ctx.options.directM3u8Enabled = html.directM3u8Enabled.checked;
    await snifferUtils.clearM3u8NetRules();
    await snifferUtils.setM3u8NetRules(ctx.options.directM3u8Enabled);
    await updateSnifferSettings();
    updateAllOverlays();
};
fun.useKeyboardShortcuts = async function(event) {
    ctx.options.useKeyboardShortcuts = html.useKeyboardShortcuts.checked;
    await updateSnifferSettings();
    updateAllOverlays();
};
fun.autoPlayEnabled = async function(event) {
    ctx.options.autoPlayEnabled = html.autoPlayEnabled.value;
    await updateSnifferSettings();
};
fun.copyFirstButton = function(event) {
    copyToClipboard(ctx.firstM3u8);
};
fun.copyLastButton = function(event) {
    copyToClipboard(ctx.lastM3u8);
};

fun.playFirstLink = async function(event) {
    //dev.alert("popup.js playFirstLink ctx.firstUrl =", ctx.firstUrl);
    event.preventDefault();
    await fun.playFirstButton(event);
}
fun.playFirstButton = async function(event) {
    //dev.alert("popup.js playFirstButton ctx.firstUrl =", ctx.firstUrl);
    await sendKeepAliveMessage();
    let htmlUrl = ctx.firstM3u8;
    if (htmlUrl && htmlUrl != noneMsg) {
        event.preventDefault();
        //ctx.isAltKey = ctx.isCtrlKey = ctx.isShiftKey = false; //???
        await snifferUtils.playM3u8(htmlUrl, ctx.firstUrl, ctx.activeTabId, event);
        if (!event.sourceCapabilities?.firesTouchEvents) self.close();
    }
};
fun.playLastLink = async function(event) {
    event.preventDefault();
    await fun.playLastButton(event);
}
fun.playLastButton = async function(event) {
    await sendKeepAliveMessage();
    let htmlUrl = ctx.lastM3u8;
    if (htmlUrl && htmlUrl != noneMsg) {
        ctx.isAltKey = ctx.isCtrlKey = ctx.isShiftKey = false; //???
        await snifferUtils.playM3u8(htmlUrl, ctx.lastUrl, ctx.activeTabId, event);
        if (!event.sourceCapabilities?.firesTouchEvents) self.close();
    }
};
fun.showConfigOptionsButton = function () {
    html.showConfigOptionsButton.style.display = "none";
    html.hideConfigOptionsButton.style.display = "inline";
    html.snifferResultsDiv.style.display = "none";
    html.configOptionsDiv.style.display = "inline";
}    
fun.hideConfigOptionsButton = function() {
    html.hideConfigOptionsButton.style.display = "none";
    html.showConfigOptionsButton.style.display = "inline";
    html.configOptionsDiv.style.display = "none";
    html.snifferResultsDiv.style.display = "inline";
}    
//#endregion

//#region Utility Functions
async function updateSnifferSettings() {
    //dev.debug("popup.js updateSnifferSettings options =", ctx.options);
    await snifferUtils.saveSnifferSettings(ctx.options);
    sendOptionsMessage();
}
function copyToClipboard(copyText) {
    var inputElement = document.createElement("input");
    if (inputElement) {
        inputElement.value = copyText; 
        document.body.appendChild(inputElement);
        inputElement.focus(); 
        inputElement.select();
        document.execCommand('copy');
        inputElement.parentNode.removeChild(inputElement);
        //dev.debug("popup.js copyToClipboard done =", inputElement.value);
    }
}
function updateAllOverlays() {
    var enabled = ctx.options.m3u8SniffingEnabled && ctx.options.m3u8InjectionEnabled;
    let message = { command: "updateOverlayStatus", m3u8InjectionEnabled: enabled, 
        useKeyboardShortcuts: ctx.options.useKeyboardShortcuts,
        directM3u8Enabled: ctx.options.directM3u8Enabled
     };
    //dev.debug("popup.js updateAllOverlays message = ", message);
    snifferUtils.sendToAllTabs(message); //??? await?
}
function closePopup(event = {}) {
    if (!event.sourceCapabilities?.firesTouchEvents) self.close();
}
//#endregion

function addEventListeners() {
//#region Event Handlers
    html.firstUrlLink.onclick = async function(event) {
        doLinkClick(event);
        if (!event.ctrlKey && !event.shiftKey) {
            event.preventDefault();
            try { await chrome.tabs.update(ctx.activeTabId, {url: html.firstUrlLink.href});
            } catch (err) { dev.warn("snifferUtils.mjs playM3u8 update url exception = ", err); }
            closePopup(event);
        } else {
            if (event.shiftKey) closePopup(event);
        }
    };
    //html.firstUrlLink.addEventListener("contextmenu", async (e) => await doLinkClick(e));
    html.firstM3u8Link.onclick = async (event) => {
        if (ctx.options.directM3u8Enabled) { //???
            if (!event.altKey) {
                event.preventDefault();
                doLinkClick(html.playFirstButton, event, true);
            }
        } else {
            event.stopPropagation();
            event.stopImmediatePropagation();
            if (event.shiftKey) closePopup(event);
            else if (!event.altKey || event.ctrlKey) html.firstM3u8Link.target = "_blank";
            else {
                event.preventDefault();
                await chrome.tabs.create({active:true, url:html.firstM3u8Link.href});
            }
        }
    }
    //html.firstM3u8Link.addEventListener("contextmenu", async (e) => await doLinkClick(e)); //???
    html.lastM3u8Link.onclick = async (event) => {
        if (ctx.options.directM3u8Enabled) { //???
            if (!event.altKey) {
                event.preventDefault();
                doLinkClick(html.playLastButton, event, true);
            }
        } else {
            event.stopPropagation();
            event.stopImmediatePropagation();
            if (event.shiftKey) closePopup(event);
            else if (!event.altKey || event.ctrlKey) html.lastM3u8Link.target = "_blank";
            else {
                event.preventDefault();
                await chrome.tabs.create({active:true, url:html.lastM3u8Link.href});
            }
        }
    }
    //html.lastM3u8Link.addEventListener("contextmenu", async (e) => await doLinkClick(e));

    window.addEventListener("focus", async function(event) {
        //dev.verbose("popup.js window focus event =", event);
        ctx.isAltKey = ctx.isCtrlKey = ctx.isShiftKey = false;
        await sendRefreshMessage(); //??? 
    });
    
    window.addEventListener("keyup", function(event) {
        if (event.code == "AltRight") ctx.isAltRight = false;
        if (event.key == "Alt") ctx.isAltKey = false;
        if (event.key == "Control") ctx.isCtrlKey = false;
        if (event.key == "Shift") ctx.isShiftKey = false;
    });
    window.addEventListener("keydown", function(event) {
        //dev.verbose("popup.js window keydown event =", event);
        if (event.code == "AltRight") ctx.isAltRight = true;
        if (event.key == "Alt") {ctx.isAltKey = true; event.preventDefault();}
        if (event.key == "Control") ctx.isCtrlKey = true;
        if (event.key == "Shift") ctx.isShiftKey = true;
        let code = event.code, key = event.key;
        let altKey = event.altKey || ctx.isAltKey || ctx.isAltRight;
        let ctrlKey = event.ctrlKey || ctx.isCtrlKey;
        let shiftKey = event.shiftKey || ctx.isShiftKey;
        //dev.verbose("popup.js window keydown key, code =", key, code);
        //dev.verbose("popup.js keydown isAltKey, isCtrlKey, isShiftKey =", 
        //        ctx.isAltKey, ctx.isCtrlKey, ctx.isShiftKey);
        if (!ctx.options.useKeyboardShortcuts) {
            if (altKey && code != "KeyK") return;
        }
        if (key == "F1") {
            event.preventDefault();
            html.openDocsLink.click();
        }
        if (!altKey && !ctrlKey) return;
        //if (ctrlKey) { }
        if (altKey) {
            //if (ctrlKey) { }
            if (shiftKey) {
                if (code == "KeyA" || code == "KeyN" || code == "KeyM") {
                    let option = code == "KeyA" ? "All" : code == "KeyN" ? "None" : "Match";
                    html.autoPlayEnabled.value = option;
                    ctx.options.autoPlayEnabled = option;
                    fun.autoPlayEnabled();
                    html.autoPlayEnabled.click();
                    event.preventDefault();
                    return;
                }
            } 
            if (html.snifferResultsDiv.style.display != "none") {
                if (code == "KeyE") {
                    event.preventDefault();
                    html.showConfigOptionsButton.click();   
                }
                else if (code == "KeyU") keyClickLink(document.getElementById("firstUrlLink"), event);
                else if (code == "KeyF" || code == "Enter") {
                    event.preventDefault();
                    if (ctx.options.directM3u8Enabled) keyClickLink(html.playFirstButton, event);
                    else {
                        //keyClickLink(html.firstM3u8Link, event, true);
                        //if (code != "Enter") keyClickLink(html.firstM3u8Link, event, true);
                        //else { html.firstM3u8Link.click(); closePopup(); }
                        html.firstM3u8Link.click(); 
                        closePopup();
                    }
                }
                else if (code == "KeyL") {
                    event.preventDefault();
                    if (ctx.options.directM3u8Enabled) keyClickLink(html.playLastButton, event);
                    else {
                        //keyClickLink(html.lastM3u8Link, event, true);
                        html.lastM3u8Link.click(); 
                        closePopup();
                    }
                }
            } else { //Edit Config
                if (code == "KeyH" || code == "KeyE") {
                    event.preventDefault();
                    fun.hideConfigOptionsButton();
                }
                if (code == "KeyK") html.useKeyboardShortcuts.click();
                else if (code == "KeyD") {
                    event.preventDefault();
                    html.directM3u8Enabled.click();
                    return;
                }
            }
            if (code == "KeyR") html.refreshButton.click();
            else if (code == "KeyS") html.m3u8SniffingEnabled.click();
            else if (code == "KeyO") html.m3u8InjectionEnabled.click();
            else if (code == "KeyP") keyClickLink(html.playFirstButton, event, true);
            else if (code == "KeyQ") keyClickLink(html.playLastButton, event, true);
            else if (code == "KeyA") html.helpButton.click();
            else if (code == "KeyC") html.copyFirstButton.click();
            else if (code == "KeyD") {
                event.preventDefault(); //???
                html.copyLastButton.click();
            }
        }
    });
    html.configOptionsDiv.addEventListener("keydown", function(event) {
        //dev.debug("popup.js configOptionsDiv keydown key = ", event.key);
        if (event.code == "KeyS" && event.ctrlKey) {
            event.preventDefault();
            fun.hideConfigOptionsButton();
        }
    });
    html.autoPlayText.addEventListener("blur", function(event) {
        ctx.options.autoPlayText = html.autoPlayText.value;
        updateSnifferSettings();
    });
//#endregion
}

//#region Message Handlers
async function sendKeepAliveMessage() {
    var response = await sendMessage({"command":"keepAlive"});
    //console.log("overlay.js sendKeepAliveMessage result =", response?.result);
}
async function sendMessage(message) {
    //dev.verbose("popup.js sendMessage message = ", message);
    try { await chrome.runtime.sendMessage(message);
    } catch (err) { dev.verbose("popup.js sendMessage exception = ", err); }
}
async function sendOptionsMessage() {
    var message = {"command":"SetSnifferOptions", "snifferOptions":ctx.options}
    try { await chrome.runtime.sendMessage(message);
    } catch (err) { dev.verbose("popup.js sendOptionsMessage exception = ", err); }
}
async function sendRefreshMessage() {
    //dev.trace("popup.js sendRefreshMessage");
    var activeTabObj = null;
    if (ctx.activeTabId) {
        activeTabObj = await snifferUtils.getTabObj(ctx.activeTabId);
    } else {
        activeTabObj = await snifferUtils.getActiveTab();
        ctx.activeTabId = activeTabObj?.id;
        //ctx.activeTabObj = activeTabObj; //???
    }
    ctx.activeTabObj = activeTabObj; //???

    var message = { "command": "PopUpRefreshData" }
    if (activeTabObj) {
        var response = await snifferUtils.sendMessageToTab(message, activeTabObj);
    } else {
        dev.alert("popup.js sendRefreshMessage NO ACTIVE TAB OBJECT !!!"); //???
    }
    if (!response) response = {};
    //dev.verbose("popup.js sendRefreshMessage response = ", response);
    ctx.firstM3u8 = response.firstM3u8 || noneMsg;
    ctx.lastM3u8 = response.lastM3u8 || noneMsg;
    ctx.m3u8Count = response.m3u8Count || 0;
    ctx.firstUrl = response.siteUrl || activeTabObj?.url || location.href;
    ctx.lastUrl = ctx.firstUrl;

    let playerUrl = await snifferUtils.getPlayerUrl(null, null, ctx.firstUrl);
    //dev.verbose("popup.js sendRefreshMessage playerUrl = ", playerUrl);
    html.playFirstLink.href = playerUrl + "#" + ctx.firstM3u8;
    html.playLastLink.href = playerUrl + "#" + ctx.lastM3u8;
    updatePopupHtml();
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    //dev.verbose("popup.js onMessage message =", message);
    //dev.verbose("popup.js onMessage sender =", sender);
    var response = null;
    switch (message.command) {
/*        
        case "getPopupCtx":
            response = {firstUrl:ctx.firstUrl, firstM3u8:ctx.firstM3u8, 
                lastUrl:ctx.lastUrl, lastM3u8:ctx.lastM3u8, m3u8Count:ctx.m3u8Count,
                //lastActiveTabObj:ctx.activeTabObj
            };
            break;
        case "closeAllPopups":
            self.close();
            break;
*/            
        default:
            //dev.warn("popup.js onMessage unkown command =", message);
    }
    if (response) sendResponse(response);
    //return true; // Needed if sendResponse is called asynclly
});
//#endregion 
// Obtener el iframe del reproductor
const videoPlayer = document.getElementById('video-player');

// Detectar la URL actual del sitio web
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const currentUrl = tabs[0].url;

  // Verificar si la URL pertenece al sitio web JogoBonito
  if (currentUrl.includes('jogobonito')) {
    // Cargar la URL en el reproductor SIN mostrarla
    videoPlayer.src = currentUrl;
  } else {
    // Mostrar un mensaje si la URL no es válida
    videoPlayer.src = 'about:blank';
    alert('Esta extensión solo funciona en el sitio web JogoBonito.');
  }
});
