const fs = require("fs");
const fork = require('child_process').fork;
const jsl = { //the only function of "svjsl" I really need
    isEmpty: input => (input === undefined || input === null || input == "" || input == [] || input == "{}" || input == "{[]}") ? true : false
}

var crashCountThreshold = 5;
var crashTimeoutMultiplier = 2.5;
var child, logToConsole = false, crashCounter, bootLoopTimeout = 0, initHR;

/**
 * @typedef wrapperOptions Additional options
 * @prop {Boolean} [restartOnCrash=true] Whether the child process should be restarted after it crashed
 * @prop {Number} [crashTimeout=2000] The timeout after a crash after which the child process should be restarted
 * @prop {Number} [restartTimeout=0] The timeout after a restart command after which the child process should be restarted
 * @prop {Boolean} [console=true] Whether node-wrap should log some important info to the main console (stuff like "Starting process" and "Restarting process")
 * @prop {String} [logFile="none"] Logs all status codes to that file, leave null or undefined for no file logging
 * @prop {String} [logConsoleOutput="none"] Logs all console outputs of the child process to that file, leave null or undefined for no file logging
 * @prop {Boolean} [logTimestamp=true] Whether a timestamp should be added to the above logs
 * @prop {Array<Number>} [restartCodes="no additional codes"] What additional exit codes should invoke a restart
 * @prop {Number} [bootLoopDetection=0] Boot loop prevention mechanism: enter the estimated time in milliseconds it usually takes to INITIALIZE (until an infinite loop of some sort gets started) the child process (0 or leave empty to disable) (higher number = higher stability but also longer delay until the boot loop detection kicks in - if you're unsure or it's unstable, take the biggest number of your measurements and/or add a few seconds)
 * @prop {Boolean} [alwaysKeepAlive=false] Set to true to force node-wrap to insistently keep alive / restart the child process as fast and reliably as possible (unaffected by boot loop detection though)
 */

/**
 * 
 * @param {String} wrapFile File that should be wrapped
 * @param {wrapperOptions} [options]
 * @param {Function} [onStartChild] Function that should be executed when the child starts
 * @param {Function} [onCrashChild] Function that should be executed when the child crashes
 */
module.exports = (wrapFile, options, onStartChild, onCrashChild) => {
    initHR = process.hrtime();
    crashCounter = 0;
    if(options.console == null || typeof logToConsole != "boolean") logToConsole = true;
    else logToConsole = options.console;
    if(logToConsole) console.log("\x1b[32m\x1b[1m[node-wrap]\x1b[0m: Started child process");

    bootLoopTimeout = ((options.bootLoopDetection > 10000 ? options.bootLoopDetection + 7000 + (options.crashTimeout != null ? options.crashTimeout : 4000) : options.bootLoopDetection + (options.crashTimeout != null ? options.crashTimeout : 5000)) * (crashCountThreshold + crashTimeoutMultiplier));
    if(options.alwaysKeepAlive === true) options.bootLoopDetection = 0;

    startProcess(wrapFile, options, onStartChild, onCrashChild);
}

function exitHandler(code, restartOnCrash, crashTimeout, restartTimeout, file, options, onStartChild, onCrashChild) {
    try {
        if(logToConsole) console.log("\x1b[33m\x1b[1m[node-wrap]\x1b[0m: Detected exit with code " + code + (code == 1 ? " - restarting in " + (crashTimeout / 1000) + "s" : ""));
        logToFile(options, code);
        if(options.alwaysKeepAlive === true) crashTimeout = 0;
        if(code == 1 && restartOnCrash) setTimeout(()=>{

            crashCounter++;
            if(!jsl.isEmpty(options.bootLoopDetection) && options.bootLoopDetection > 0 && crashCounter == 1) setTimeout(()=>{
                crashCounter = 0;
                if(logToConsole) console.log("\x1b[33m\x1b[1m[node-wrap]\x1b[0m: No boot loop detected");
            }, bootLoopTimeout);

            if(!jsl.isEmpty(options.bootLoopDetection) && options.bootLoopDetection > 0 && crashCounter >= crashCountThreshold) {
                if(logToConsole) console.log("\x1b[31m\x1b[1m[node-wrap]\x1b[0m: NOT restarting crashed child process because a boot loop was encountered (after " + crashCounter + " crashes and " + process.hrtime(initHR)[0] + "s elapsed time. The boot loop threshold was: " + (bootLoopTimeout / 1000) + "s)");
                return process.exit(1);
            }

            if(logToConsole) console.log("\x1b[33m\x1b[1m[node-wrap]\x1b[0m: Restarted crashed child process" + (!jsl.isEmpty(options.bootLoopDetection) && options.bootLoopDetection > 0 ? " (crash #" + crashCounter + ")" : ""));
            if(!jsl.isEmpty(onCrashChild) && typeof onCrashChild == "function") onCrashChild();

            startProcess(file, options, onStartChild, onCrashChild);

        }, crashTimeout);

        else if(code == 2) {
            if(options.alwaysKeepAlive === true) restartTimeout = 0;
            setTimeout(()=>{
                if(logToConsole) console.log("\x1b[33m\x1b[1m[node-wrap]\x1b[0m: Restarted child process");
                startProcess(file, options, onStartChild, onCrashChild);
            }, restartTimeout);
        }
        else {
            if(!jsl.isEmpty(options.restartCodes)) {
                var restart = false;
                options.restartCodes.forEach(c => {
                    if(code == c) restart = true;
                });
                if(restart) {
                    if(logToConsole) console.log("\x1b[33m\x1b[1m[node-wrap]\x1b[0m: Restarted child process");
                    return startProcess(file, options, onStartChild, onCrashChild);
                }
            }
            else {
                if(logToConsole) console.log("\x1b[33m\x1b[1m[node-wrap]\x1b[0m: Got code " + code + " - not restarting child process");
                process.exit(code);
            }
        }
    }
    catch(err) {
        if(options.alwaysKeepAlive === true) setTimeout(()=>startProcess(file, options, onStartChild, onCrashChild), 50);
        else {
            console.log("\x1b[31m\x1b[1m[node-wrap]\x1b[0m: internal error: " + err + "\nIf you don't want this to shut down the child process, set the option \"alwaysKeepAlive\" to true.");
            process.exit(1);
        }
    }
}

function startProcess(file, options, onStartChild, onCrashChild) {
    try {
        if(!jsl.isEmpty(onStartChild) && typeof onStartChild == "function") onStartChild();
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

        child.addListener("exit", code => exitHandler(code, restartOnCrash, crashTimeout, restartTimeout, file, options, onStartChild, onCrashChild));
    }
    catch(err) {
        if(options.alwaysKeepAlive === true) setTimeout(()=>startProcess(file, options, onStartChild, onCrashChild), 50);
        else {
            console.log("\x1b[31m\x1b[1m[node-wrap]\x1b[0m: internal error: " + err + "\nIf you don't want this to shut down the child process, set the option \"alwaysKeepAlive\" to true.");
            process.exit(1);
        }
    }
}

function logToFile(options, code) {
    if(options.logFile != null && typeof options.logFile == "string") fs.appendFileSync(options.logFile, ((options.logTimestamp != null ? options.logTimestamp : true) === true ? "[" + new Date().toString() + "]:  " : "") + "Process got status code " + code + " - Options were: " + JSON.stringify(options) + "\n");
}