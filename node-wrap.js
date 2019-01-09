const fs = require("fs");
const fork = require('child_process').fork;
const jsl = { //the only function of "svjsl" I really need
    isEmpty: input => (input === undefined || input === null || input == "" || input == [] || input == "{}" || input == "{[]}") ? true : false
}

var child, logToConsole = false;

/**
 * @typedef wrapOptions additional options
 * @prop {Boolean} [restartOnCrash=true] whether the child process should be restarted after it crashed
 * @prop {Number} [crashTimeout=2000] the timeout after a crash after which the child process should be restarted
 * @prop {Number} [restartTimeout=0] the timeout after a restart command after which the child process should be restarted
 * @prop {Boolean} [console=true] whether node-wrap should log some important info to the main console (stuff like "Starting process" and "Restarting process")
 * @prop {String} [logFile="none"] logs all status codes to that file, leave null or undefined for no file logging
 * @prop {String} [logConsoleOutput="none"] logs all console outputs of the child process to that file, leave null or undefined for no file logging
 * @prop {Boolean} [logTimestamp=true] whether a timestamp should be added to the above logs
 * @prop {Array<Number>} [restartCodes="no additional codes"] what additional exit codes should invoke a restart
 */

/**
 * 
 * @param {String} wrapFile file that should be wrapped
 * @param {wrapOptions} [options]
 * @param {Function} [onStartChild] function that should be executed when the child starts
 * @param {Function} [onCrashChild] function that should be executed when the child crashes
 */
module.exports = (wrapFile, options, onStartChild, onCrashChild) => {
    if(options.console != null || typeof logToConsole != "boolean") logToConsole = true;
    else logToConsole = options.console;
    if(logToConsole) console.log("\x1b[33m\x1b[1m[node-wrap]\x1b[0m: Starting process");
    startProcess(wrapFile, options, onStartChild, onCrashChild);
}

function exitHandler(code, restartOnCrash, crashTimeout, restartTimeout, file, options, onCrashChild) {
    if(logToConsole) console.log("\x1b[33m\x1b[1m[node-wrap]\x1b[0m: Detected exit with code " + code);
    logToFile(options, code);
    if(code == 1 && restartOnCrash) setTimeout(()=>{
        if(logToConsole) console.log("\x1b[33m\x1b[1m[node-wrap]\x1b[0m: Restarting crashed process");
        onCrashChild();
        startProcess(file, options);
    }, crashTimeout);
    else if(code == 2) setTimeout(()=>{
        if(logToConsole) console.log("\x1b[33m\x1b[1m[node-wrap]\x1b[0m: Restarting process");
        startProcess(file, options);
    }, restartTimeout);
    else {
        if(!jsl.isEmpty(options.restartCodes)) {
            var restart = false;
            options.restartCodes.forEach(c => {
                if(code == c) restart = true;
            });
            if(restart) {
                if(logToConsole) console.log("\x1b[33m\x1b[1m[node-wrap]\x1b[0m: Restarting process");
                return startProcess(file, options);
            }
        }
        else {
            if(logToConsole) console.log("\x1b[33m\x1b[1m[node-wrap]\x1b[0m: Got code " + code + " - not restarting");
            process.exit(code);
        }
    }
}

function startProcess(file, options, onStartChild, onCrashChild) {
    if(!jsl.isEmpty(onStartChild)) onStartChild();
    var restartOnCrash, restartTimeout, crashTimeout, logConsoleOutput, logTimestamp;
    if(typeof options == "object" && !jsl.isEmpty(JSON.stringify(options))) {
        restartOnCrash = (options.restartOnCrash != null ? options.restartOnCrash : true);
        restartTimeout = (options.restartTimeout != null ? options.restartTimeout : 0);
        crashTimeout = (options.crashTimeout != null ? options.crashTimeout : 2000);
        logConsoleOutput = (options.logConsoleOutput != null ? options.logConsoleOutput : "");
        logTimestamp = (options.logTimestamp != null ? options.logTimestamp : true);
    }


    if(!jsl.isEmpty(logConsoleOutput) && typeof logConsoleOutput == "string") {
        child = fork(file, [], {
            stdio: "pipe"
        });
        child.stdout.on("data", data => fs.appendFileSync(logConsoleOutput, (logTimestamp == true ? "[" + new Date().toString() + "]:  " : "") + data + "\n"));
    }
    else child = fork(file);


    child.addListener("exit", code => exitHandler(code, restartOnCrash, crashTimeout, restartTimeout, file, options, onCrashChild));
}

function logToFile(options, code) {
    if(options.logFile != null && typeof options.logFile == "string") fs.appendFileSync(options.logFile, ((options.logTimestamp != null ? options.logTimestamp : true) === true ? "[" + new Date().toString() + "]:  " : "") + "Process got status code " + code + " - Options were: " + JSON.stringify(options) + "\n");
}