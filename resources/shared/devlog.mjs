// devlog.mjs - JS to control console logging and error handling
// (C) 2021-2024 Richard Stam, SigmaFxDx Software
var stealthRelease = true;
var devAlertLog = true;
var devTraceLog = true;
var devDebugging = true;
var devVerboseLog = true;
var logRuntimeErrors = true;
var alertRuntimeErrors = false;
var squelchRuntimeErrors = false;
var logRuntimeExceptions = true;
var alertRuntimeExceptions = false;
var squelchRuntimeExceptions = false;

function log(...args) {
    if (!stealthRelease) console.log(...args);
}
function info(...args) {
    if (!stealthRelease) console.info(...args);
}
function trace(...args) {
    if (devTraceLog && !stealthRelease) logGroup("T:", ...args);
}
function debug(...args) {
    if (devDebugging && !stealthRelease) logGroup("D:", ...args);
}
function verbose(...args) {
    if (devVerboseLog && !stealthRelease) logGroup("V:", ...args);
}

function logGroup(label, ...args) {
    //console.groupCollapsed(label + args[0] || "", args[1] || "");
    console.groupCollapsed(label, ...args);
    //??? console.log(...args); 
    console.trace(); console.groupEnd();
}
function warn(...args) {
    if (!stealthRelease) {
        console.groupCollapsed("WARN:", ...args);
        console.warn(...args); console.trace(); console.groupEnd();
    }
}
function error(...args) {
    if (!stealthRelease) {
        console.groupCollapsed("ERROR:", ...args);
        console.error(...args); console.trace(); console.groupEnd();
    }
}

function devAlert(...args) {
    if (devAlertLog && !stealthRelease) {
        if (typeof alert != "undefined") alert(args.join(" "));
        else {
            console.groupCollapsed("ALERT:" + args[0] || "", args[1] || "");
            console.warn(...args); console.trace();
            console.groupEnd();
        }
    }
}

function logRuntimeError(...args) {
    if (!stealthRelease) {
        if (logRuntimeErrors) logGroup("ERROR:", ...args);
        if (alertRuntimeErrors) alertRuntimeError(...args);
    }
}
function alertRuntimeError(...args) {
    if (alertRuntimeErrors && !stealthRelease) {
        devAlert("ERROR: " + args.join(' '));
    }
}

function logRuntimeException(...args) {
    if (!stealthRelease) {
        if (logRuntimeExceptions) logGroup("ERROR (Exception):", ...args);
        if (alertRuntimeExceptions) alertRuntimeException(...args);
    }
}
function alertRuntimeException(...args) {
    if (alertRuntimeExceptions && !stealthRelease) {
        devAlert("ERROR (Exception): " + args.join(' '));
    }
}

// Check for chrome.runtime.lastError
function checkLastError(caller) {
    var lastError = chrome.runtime.lastError;
    if (lastError) logRuntimeError("checkLastError = " + lastError.message);
    return lastError;
};

// medium.com/@jacobwarduk/
//how-to-correctly-use-preventdefault-stoppropagation
//-or-return-false-on-events-6c4e3f31aedb
if (typeof window != "undefined") {
    // Handles normal (sync) runtime errors
    window.addEventListener('error', function(event) {
        logRuntimeError("window error event =", event);
        if (squelchRuntimeErrors || stealthRelease) event.preventDefault();
    });

    // Handles async (Promise) runtime errors (Exceptions)
    window.addEventListener('unhandledrejection', function (event) {
        logRuntimeException("window unhandledrejection event =", event);
        if (squelchRuntimeExceptions || stealthRelease) event.preventDefault();
    });
}

export { 
    stealthRelease, devTraceLog, devDebugging, devVerboseLog,
    logRuntimeErrors, alertRuntimeErrors, squelchRuntimeErrors,
    logRuntimeExceptions, alertRuntimeExceptions, squelchRuntimeExceptions,
    logRuntimeError, alertRuntimeError, logRuntimeException, alertRuntimeException,
    log, info, trace, debug, verbose, warn, error, devAlert as alert, checkLastError,
    //stealthRelease, devAlertLog, devTraceLog, devDebugging, devVerboseLog,
};
