// settings.js - Minimalist HLS m3u8 video player
// (C) 2021-2024 Richard Stam, SigmaFxDx Software
console.log("Hello settings.js!");

//#region Global Variables
var urlObj, siteParam;
var firstM3u8, lastM3u8, m3u8Count = 0;
var clickOption, dblClickOption;
var monitorStallEnabled = true;
var monitorStallTimeout = 20000;
var autoReloadEnabled = false;
var autoReloadTimeout = 5000;
var reloadTimeoutObj = null;
var autoReloadCount = 0;
var errorText = "";
var html = {};
var fun = {}, dd = {};
//#endregion

//#region Html Handlers
fun.reloadVideoPlayer = function(event) {
    reloadVideoPlayer(true);
}
fun.copyM3u8 = function(event) {
    copyToClipboard(firstM3u8);
}
fun.reloadSite = function(event) {
    reloadSite();
}
fun.cancelAutoReload = function(event) {
    if (reloadTimeoutObj) clearTimeout(reloadTimeoutObj);
    html.autoReloadSpan.style.display = "none";
}
dd.clickOptions = function(event) {
    clickOption = html.clickOptions.value;
    localStorage.setItem("clickOption", clickOption);
}
dd.dblClickOptions = function(event) {
    dblClickOption = html.dblClickOptions.value;
    localStorage.setItem("dblClickOption", dblClickOption);
}
dd.stallTimeout = async function(event) {
    let monitorStall = html.stallTimeout.value;
    if (monitorStall == "Off") monitorStallEnabled = false;
    else {
        monitorStallEnabled = true;
        monitorStallTimeout = html.stallTimeout.value * 1000;
    }
    localStorage.setItem("monitorStallEnabled", monitorStallEnabled);
    localStorage.setItem("monitorStallTimeout", monitorStallTimeout);
    await sendToAllTabs({
        command:"updatePlayerSettings", monitorStallEnabled, monitorStallTimeout
    });
}
dd.autoReloadTimeout = function(event) {
    let autoReload = html.autoReloadTimeout.value;
    if (autoReload == "Off") autoReloadEnabled = false;
    else {
        autoReloadEnabled = true;
        autoReloadTimeout = html.autoReloadTimeout.value * 1000;
    }
    localStorage.setItem("autoReloadEnabled", autoReloadEnabled);
    localStorage.setItem("autoReloadTimeout", autoReloadTimeout);
}
//#endregion

//#region Utility Functions
function addHtmlElements() {
    addElement(html, document.getElementById("body"));
}
function addElement(html, htmlObj) {
    if (htmlObj.id) html[htmlObj.id] = document.getElementById(htmlObj.id);
    if (typeof fun[htmlObj.id] == "function") {
        htmlObj.onclick = fun[htmlObj.id];
    } else if (typeof dd[htmlObj.id] == "function") {
        htmlObj.onchange = dd[htmlObj.id];
    }
    for (const childObj of htmlObj.children) {
        addElement(html, childObj);
    }
    return html;
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
        //console.log("copyToClipboard done =", inputElement.value);
    }
}
function reloadVideoPlayer(replace = false) {
    var urlHashParts = window.location.href.split("#");
    var urlHashParts = window.location.href.split("#");
    var playerUrlStr = urlHashParts.shift().replace(/(&error=.*)$/, "");
    var playerUrlStr = playerUrlStr.replace("settings.html", "player.html");
    if (urlHashParts.length > 0) playerUrlStr += "#" + urlHashParts.join("#");
    //alert("reloadVideoPlayer playerUrlStr = " + playerUrlStr);
    if (replace) location.replace(playerUrlStr); else location.assign(playerUrlStr);
}
function reloadSite() {
    //console.log("reloadSite siteParam =", siteParam);
    if (siteParam) window.location.replace(checkEncodedURL(siteParam));
    else reloadVideoPlayer(true);
}
function checkEncodedURL(str) {
    var isEncoded = (str && str.indexOf("%3A%2F%2F") >= 0);
    return isEncoded ? decodeURIComponent(str) : str;
}
//#endregion

//#region Message Handlers
async function sendToAllTabs(message = {}) {
    if (chrome && chrome.runtime) {
        let allTabs = await chrome.tabs.query({});
        allTabs.forEach(tab => { sendMessageToTab(message, tab); }); //??? await
    }
}
async function sendMessageToTab(message, tabObj) {
    //console.log("sendMessageToTab tabObj =", tabObj);
    if (!tabObj) return;
    var response = {};
    if (chrome && chrome.runtime) {
        try { response = await chrome.tabs.sendMessage(tabObj.id, message);
        } catch (err) { /*console.log("sendMessageToTab exception = ", err);*/ }
        //console.log("sendMessageToTab response = ", response);
    }
    return response ?? {};
}
if (chrome && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        //console.log("player.js message listener message =", message);
        var response = null;
        switch (message.command) {
            case "PopUpRefreshData":
                response = { firstM3u8, lastM3u8, m3u8Count, siteUrl:siteParam };
                break;
        }
        if (response) {
            //console.log("onMessage sendResponse response =", response);
            sendResponse(response);
        }
        //return true; // Needed if sendResponse is called asynclly
    });
}
//#endregion

//#region Error Handlers
function doAutoReload() {
    if (--autoReloadCount > 0) {
        html.reloadTime.innerText = autoReloadCount;
        return;
    }
    if (reloadTimeoutObj) clearInterval(reloadTimeoutObj);
    reloadSite();
}

async function tryM3u8Fetch() {
    //console.log("tryM3u8Fetch firstM3u8 =", firstM3u8);
    //console.log("tryM3u8Fetch errorText =", errorText);
    try {
        var response = await fetch(firstM3u8);
        let statusCode = response.status;
        if (statusCode != 200) {
            errorText = statusCode + "  ";
            if (response.statusText) errorText += response.statusText;
            else if (statusCode) {
                if (statusCode == 404) errorText += "Not Found"
                else if (statusCode == 403) errorText += "Forbidden"
                else if (statusCode == 400) errorText += "Bad Request"
                errorMsg = statusCode + ", " + errorText;
            }
        }
    } catch (error) {
        //console.log("tryM3u8Fetch fetch error =", error);
    }
    return {response, errorText};
}
//#endregion

//#region Event Handlers
window.addEventListener("contextmenu", function(event) {
    //console.log("player.js contextmenu event =", event);
    if (event.buttons > 0) {
        event.preventDefault();
        html.reloadVideoPlayer.click();
    }
});
let touchstartX = 0, touchStartTime = null;
window.addEventListener('touchstart', event => {
    //console.log("player.js touchstart event =", event);
    //let touchCount = event.targetTouches.length;
    //console.log("player.js touchend touchCount =", touchCount);
    touchStartTime = event.timeStamp;
    touchstartX = event.changedTouches[0].screenX;
}, {passive: false});

window.addEventListener('touchend', event => {
    //console.log("player.js touchend event =", event);
    let touchendX = event.changedTouches[0].screenX;
    let swipeDelta = touchendX - touchstartX;
    //alert("player.js touchend swipeDelta = " + swipeDelta);
    if (Math.abs(swipeDelta) > 120) { //swipeDelta > 120
        //console.log("player.js touchend swipeDelta =", swipeDelta);
        html.reloadVideoPlayer.click();
    }
}, {passive: false});

window.addEventListener("keydown", function(event) {
    //console.log("player.js keydown event = ", event);
    let key = event.key, code = event.code;
    //console.log("settins.js keydown key, code =", key, code);
    if (key == "Cancel" || key == "Escape"
            || code == "KeyC" && event.ctrlKey) {
        event.preventDefault();
        fun.cancelAutoReload();
    }
    if (code == "F1") {
        event.preventDefault();
        html.helpLink.click();
    }
    if (code == "KeyC" /*&& event.ctrlKey*/) {
        event.preventDefault();
        let copyText = event.shiftKey ? siteParam : firstM3u8;
        if (copyText) copyToClipboard(copyText)
    }
    if (code == "Enter" || code == "Backspace") {
        event.preventDefault();
        if (event.shiftKey) html.reloadSite.click();
        else html.reloadVideoPlayer.click();
    }
});

window.addEventListener('load', async (event) => {
    urlObj = new URL(window.location.href);
    //console.log("settings.js window load urlObj =", urlObj);
    siteParam = checkEncodedURL(urlObj.searchParams.get("site"));
    errorText = urlObj.searchParams.get("error");
    if (siteParam) document.title = siteParam.split("://")[1];
    firstM3u8 = urlObj.hash.substring(1);
    lastM3u8 = firstM3u8; m3u8Count++;
    //console.log("settings.js window load firstM3u8 =", firstM3u8);
    //console.log("settings.js window load siteParam =", siteParam);

    addHtmlElements();
    monitorStallEnabled = (localStorage.getItem("monitorStallEnabled") ?? "true") == "true";
    monitorStallTimeout = localStorage.getItem("monitorStallTimeout") ?? 20000;
    html.stallTimeout.value = monitorStallEnabled ? monitorStallTimeout / 1000 : "Off";
    autoReloadEnabled = (localStorage.getItem("autoReloadEnabled") ?? "false") == "true";
    autoReloadTimeout = localStorage.getItem("autoReloadTimeout") ?? "5000";
    html.autoReloadTimeout.value = autoReloadEnabled ? autoReloadTimeout / 1000 : "Off";
    clickOption = localStorage.getItem("clickOption") ?? "Nothing";
    html.clickOptions.value = clickOption;
    dblClickOption = localStorage.getItem("dblClickOption") ?? "MuteUnmute";
    html.dblClickOptions.value = dblClickOption;

    let firstM3u8Text = firstM3u8;
    if (firstM3u8Text.length > 223) firstM3u8Text = firstM3u8Text.substring(0, 220) + " ...";
    html.firstM3u8.innerText = firstM3u8Text;
    html.firstM3u8.href = firstM3u8;
    if (siteParam) {
        let siteHomeProtocol = siteParam.split("://")[0];
        let siteHome = siteHomeProtocol + "://" + siteParam.split("/") [2];
        html.siteHome.innerText = siteHome;
        html.siteHome.href = siteHome;
        html.siteParam.innerText = siteParam;
        html.siteParam.href = siteParam;
        html.siteParamDiv.style.display = "inline";
        html.reloadSite.style.display = "inline";
    }
    if (errorText) {
        html.errorText.innerText = errorText;
        html.errorDiv.style.display = "inline";
        if (errorText == "User Break") {
            html.errorCause.style.display = "none";
        } else {
            if (!autoReloadEnabled) {
                html.autoReloadOffSpan.style.display = "inline-block";
            } else {
                autoReloadCount = Math.round(autoReloadTimeout / 1000);
                html.reloadTime.innerText = autoReloadCount;
                reloadTimeoutObj = setInterval(doAutoReload, 1000);
                html.autoReloadSpan.style.display = "inline";
            }
            let fetchResult = await tryM3u8Fetch(errorText);
            errorText = fetchResult.errorText;
        }
        html.errorText.innerText = errorText;
    }
});
//#endregion
