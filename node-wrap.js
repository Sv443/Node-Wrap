`
    © 2019 Sv443 - https://sv443.net/ - GitHub: https://github.com/Sv443

    Node-Wrap is licensed under the MIT license (https://github.com/Sv443/Node-Wrap/blob/master/LICENSE)
`;



    // init Node-Wrap    =======================================================================================================================================================================================================================================================================================================================================================

const fs = require("fs");
const http = require("http");
const fork = require("child_process").fork;
const jsl = { //the only function of the package "svjsl" I need (to save dependencies and space):
    isEmpty: input => (input === undefined || input === null || input == "" || input == [] || input == "{}" || input == "{[]}") ? true : false
}

var crashCountThreshold = 5;
var crashTimeoutMultiplier = 2.7;
var child, logToConsole = false, crashCounter, bootLoopTimeout = 0, initHR;
var isSoftSD = false;
var prev = {};
var startingUpAfterSoftSD = false; // probably not needed though unsure. Will probably deprecate at a later stage
var initialized = false;




    // typedefs    =======================================================================================================================================================================================================================================================================================================================================================

        

/**
 * @typedef wrapperOptions Additional options
 * @property {Boolean} [restartOnCrash=true] Whether the child process should be restarted after it crashed
 * @property {Number} [crashTimeout=2000] The timeout after a crash after which the child process should be restarted
 * @property {Number} [restartTimeout=0] The timeout after a restart command after which the child process should be restarted
 * @property {Boolean} [console=true] Whether node-wrap should log some important info to the main console (stuff like "Starting process" and "Restarting process")
 * @property {String} [logFile="none"] Logs all status codes to that file, leave null or undefined for no file logging
 * @property {String} [logConsoleOutput="none"] Logs all console outputs of the child process to that file, leave null or undefined for no file logging
 * @property {Boolean} [logTimestamp=true] Whether a timestamp should be added to the above logs
 * @property {Array<Number>} [restartCodes="[]"] What additional exit codes should invoke a restart
 * @property {Number} [bootLoopDetection=0] Boot loop prevention mechanism: enter the estimated time in milliseconds it usually takes to INITIALIZE (until an infinite loop of some sort gets started) the child process (0 or leave empty to disable) (higher number = higher stability but also longer delay until the boot loop detection kicks in - if you're unsure or it's unstable, take the biggest number of your measurements and/or add a few seconds)
 * @property {Boolean} [alwaysKeepAlive=false] Set to true to force node-wrap to insistently keep alive / restart the child process as fast and reliably as possible (unaffected by boot loop detection though)
 */

/**
 * @typedef {Object} eventActionOptions
 * @property {Boolean} [eventActions.enabled=false] Whether this action should be activated (true) or not (false)
 * @property {("POST"|"PATCH"|"DELETE"|"PUT")} [eventActions.method] The HTTP request method
 * @property {String} [eventActions.body] What the HTTP request body has to look like
 * @memberof eventActions
 */

/**
 * @typedef {Object} eventActions How the different commands should be triggered
 * @property {eventActionOptions} [stopCP] How the stop command should be triggered
 * @property {eventActionOptions} [startCP] How the stop command should be triggered
 * @property {eventActionOptions} [restartCP] How the stop command should be triggered
 * @property {eventActionOptions} [viewLog] How the stop command should be triggered
 */















    // initialize CP    =======================================================================================================================================================================================================================================================================================================================================================



/**
 * Initialize node-wrap and start the child process
 * @param {String} wrapFile File that should be wrapped
 * @param {wrapperOptions} [options]
 * @param {Function} [onStartChild] Function that should be executed when the child starts
 * @param {Function} [onCrashChild] Function that should be executed when the child crashes
 * @param {Function} [onStopChild] Function that should be executed when the child gets stopped by status code 3
 * @returns {Boolean} True, if child process could be created, false, if not (mostly occurs if a CP has already been created)
 */
module.exports = (wrapFile, options, onStartChild, onCrashChild, onStopChild) => {
    if(!initialized) {
        initialized = true;
        initHR = process.hrtime();
        crashCounter = 0;
        if(options.console == null || typeof logToConsole != "boolean") logToConsole = true;
        else logToConsole = options.console;
        if(logToConsole) console.log("\x1b[32m\x1b[1m[node-wrap]\x1b[0m: Started child process");

        bootLoopTimeout = ((options.bootLoopDetection > 10000 ? options.bootLoopDetection + 7000 + (options.crashTimeout != null ? options.crashTimeout : 4000) : options.bootLoopDetection + (options.crashTimeout != null ? options.crashTimeout : 5000)) * (crashCountThreshold + crashTimeoutMultiplier));
        if(options.alwaysKeepAlive === true) options.bootLoopDetection = 0;

        startProcess(wrapFile, options, onStartChild, onCrashChild, onStopChild);

        setInterval(()=>{}, 20000);

        return true;
    }
    else {
        console.log("\x1b[31m\x1b[1m[node-wrap]\x1b[0m: A child process is already running!");
        return false;
    }
}





    // start CP    =======================================================================================================================================================================================================================================================================================================================================================



/**
 * Starts the child process that was previously stopped with exit code 3
 * @returns {Boolean} True if startup could be commenced, false if not (this probably occurs if the child process hasn't been initialized and / or stopped manually yet)
 */
module.exports.start = () => {
    if(isSoftSD) {
        try {
            initHR = process.hrtime();
            startingUpAfterSoftSD = true;
            if(logToConsole) console.log("\x1b[33m\x1b[1m[node-wrap]\x1b[0m: Manually started child process");
            startProcess(prev.file, prev.options, prev.onStartChild, prev.onCrashChild, prev.onStopChild);
            isSoftSD = false;
            return true;
        }
        catch(err) {
            return false;
        }
    }
    else return false;
}





    // stop CP    =======================================================================================================================================================================================================================================================================================================================================================



/**
 * Stops the child process using the signal "SIGKILL", if none is specified
 * @param {String} [signal="SIGKILL"] The signal that should be sent to kill the child process. List of signals: http://bit.ly/2RTj9rp
 * @returns {Boolean} True, if child process could be shut down, false, if not (mostly occurs if you haven't initialized the CP yet)
 */
module.exports.stop = signal => {
    try {
        if(jsl.isEmpty(signal)) signal = "SIGKILL";
        if(logToConsole) console.log("\x1b[33m\x1b[1m[node-wrap]\x1b[0m: Manually stopped child process");
        child.kill(signal);
        isSoftSD = true;
        return true;
    }
    catch(err) {
        console.log("\x1b[31m\x1b[1m[node-wrap]\x1b[0m: Couldn't stop the child process due to an error: " + err + "\n\x1b[31m\x1b[1m[node-wrap]\x1b[0m: This might be because there is no child process or it was already stopped.");
        return false;
    }
}




    // HttpListener class    =======================================================================================================================================================================================================================================================================================================================================================



/**
 * Manage the HTTP listener - it can trigger actions on an HTTP request
 * @class
 * @namespace HttpListener
 */
const HttpListener = class {
    /**
     * Initialize the HTTP listener
     * @memberof HttpListener
     * @param {Number} [port=80] The port the HTTP listener should listen on
     * @param {String} [allowedIP=("localhost"|"127.0.0.1"|"0.0.0.0")] The only IP that can trigger actions - for localhost leave empty / null - has to be IPv4
     * @param {eventActions} [eventActions] The conditions that should trigger an event
     */
    constructor(port, allowedIP, eventActions) {
        this.options = {
            port: (parseInt(port) > 0 ? parseInt(port) : 80),
            allowedIP: (!jsl.isEmpty(allowedIP) && (typeof allowedIP == "string") ? allowedIP.toString() : "local"),
            events: {
                stopCP: {
                    enabled: (!jsl.isEmpty(eventActions.stopCP.enabled) ? eventActions.stopCP.enabled : false),
                    method: "POST",
                    body: "STOP"
                },
                startCP: {
                    enabled: false,
                    method: "POST",
                    body: "START"
                },
                restartCP: {
                    enabled: false,
                    method: "POST",
                    body: "RESTART"
                },
                viewLog: {
                    enabled: false,
                    method: "POST",
                    body: "LOG"
                }
            }
        }
        this.start();
    }

    start() {

    }

    stop() {

    }
}
module.exports.HttpListener = HttpListener;





    // private - exit CP    =======================================================================================================================================================================================================================================================================================================================================================



function exitHandler(code, restartOnCrash, crashTimeout, restartTimeout, file, options, onStartChild, onCrashChild, onStopChild) {
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
            if(!jsl.isEmpty(onCrashChild) && typeof onCrashChild == "function") onCrashChild(process.hrtime(initHR)[0]);

            startProcess(file, options, onStartChild, onCrashChild, onStopChild);

        }, crashTimeout);

        else if(code == 2) {
            if(options.alwaysKeepAlive === true) restartTimeout = 0;
            setTimeout(()=>{
                if(logToConsole) console.log("\x1b[33m\x1b[1m[node-wrap]\x1b[0m: Restarted child process");
                startProcess(file, options, onStartChild, onCrashChild, onStopChild);
            }, restartTimeout);
        }
        else if(code == 3) {
            if(options.alwaysKeepAlive === true) startProcess(file, options, onStartChild, onCrashChild, onStopChild);
            else {
                if(logToConsole) console.log("\x1b[33m\x1b[1m[node-wrap]\x1b[0m: Stopped child process (status 3)");
                if(!jsl.isEmpty(onStopChild) && typeof onStopChild == "function") onStopChild(process.hrtime(initHR)[0]);
                isSoftSD = true;
                prev.file = file;
                prev.options = options;
                prev.onStartChild = onStartChild;
                prev.onCrashChild = onCrashChild;
                prev.onStopChild = onStopChild;
                return;
            }
        }
        else {
            if(!jsl.isEmpty(options.restartCodes)) {
                var restart = false;
                options.restartCodes.forEach(c => {
                    if(code == c) restart = true;
                });
                if(restart) {
                    if(logToConsole) console.log("\x1b[33m\x1b[1m[node-wrap]\x1b[0m: Restarted child process");
                    return startProcess(file, options, onStartChild, onCrashChild, onStopChild);
                }
            }
            else {
                if(logToConsole) console.log("\x1b[33m\x1b[1m[node-wrap]\x1b[0m: Got code " + code + " - not restarting child process");
                process.exit(code);
            }
        }
    }
    catch(err) {
        if(options.alwaysKeepAlive === true) setTimeout(()=>startProcess(file, options, onStartChild, onCrashChild, onStopChild), 50);
        else {
            console.log("\x1b[31m\x1b[1m[node-wrap]\x1b[0m: internal error: " + err + "\n\x1b[31m\x1b[1m[node-wrap]\x1b[0m: If you don't want this to shut down the child process, set the option \"alwaysKeepAlive\" to true.");
            process.exit(1);
        }
    }
}





    // private - start CP    =======================================================================================================================================================================================================================================================================================================================================================



function startProcess(file, options, onStartChild, onCrashChild, onStopChild) {
    try {
        startingUpAfterSoftSD = false;
        if(!jsl.isEmpty(onStartChild) && typeof onStartChild == "function") onStartChild(process.hrtime(initHR)[0]);
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

        child.addListener("exit", code => exitHandler(code, restartOnCrash, crashTimeout, restartTimeout, file, options, onStartChild, onCrashChild, onStopChild));
    }
    catch(err) {
        if(options.alwaysKeepAlive === true) setTimeout(()=>startProcess(file, options, onStartChild, onCrashChild, onStopChild), 50);
        else {
            console.log("\x1b[31m\x1b[1m[node-wrap]\x1b[0m: internal error: " + err + "\nIf you don't want this to shut down the child process, set the option \"alwaysKeepAlive\" to true.");
            process.exit(1);
        }
    }
}





    // private - log to file    =======================================================================================================================================================================================================================================================================================================================================================



function logToFile(options, code) {
    if(options.logFile != null && typeof options.logFile == "string") fs.appendFileSync(options.logFile, ((options.logTimestamp != null ? options.logTimestamp : true) === true ? "[" + new Date().toString() + "]:  " : "") + "Process got status code " + code + " - Options were: " + JSON.stringify(options) + "\n");
}