`
    © 2019 Sv443 - https://sv443.net/ - GitHub: https://github.com/Sv443

    Node-Wrap is licensed under the MIT license (https://github.com/Sv443/Node-Wrap/blob/master/LICENSE)
`;



"use strict";






    // init Node-Wrap    =======================================================================================================================================================================================================================================================================================================================================================

const xxrlog = true; // verbose dev logging

const fs = require("fs");
const http = require("http");
const fork = require("child_process").fork;
const jsl = { //the only function of the package "svjsl" I need (to save dependencies and space):
    isEmpty: input => {
        try {
            return (input === undefined || input === null || input == "" || input == [] || input == "{}" || input == "{[]}") ? true : false;
        }
        catch(err) {
            return false;
        }
    }
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
    if(xxrlog) console.log("\x1b[37m\x1b[34m\x1b[1m[XXR]: \x1b[0m NINI");
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

        setInterval(()=>{
            if(xxrlog) console.log("\x1b[37m\x1b[34m\x1b[1m[XXR]: \x1b[0m IV");
        }, 600000);

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
const start = () => {
    if(xxrlog) console.log("\x1b[37m\x1b[34m\x1b[1m[XXR]: \x1b[0m NSTR");
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
module.exports.start = start;





    // stop CP    =======================================================================================================================================================================================================================================================================================================================================================



/**
 * Stops the child process using the signal "SIGKILL", if none is specified
 * @param {String} [signal="SIGKILL"] The signal that should be sent to kill the child process. List of signals: http://bit.ly/2RTj9rp
 * @returns {Boolean} True, if child process could be shut down, false, if not (mostly occurs if you haven't initialized the CP yet)
 */
module.exports.stop = signal => {
    if(xxrlog) console.log("\x1b[37m\x1b[34m\x1b[1m[XXR]: \x1b[0m NSTP");
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



const allowedMethods = ["POST", "PATCH", "DELETE", "PUT"];
const httpLocalIPs = ["127.0.0.1", "localhost", "::1", "0.0.0.0"];
const cmdReg = require("./registry/httpCommands.js");
var usedHttpPorts = [];
/**
 * Manage the HTTP listener - it can trigger actions on an HTTP request
 * @class
 * @namespace HttpListener
 */
class HttpListener {
    /**
     * Initialize the HTTP listener
     * @memberof HttpListener
     * @param {Number} [port=80] The port the HTTP listener should listen on
     * @param {String} [allowedIP=("localhost"|"127.0.0.1"|"::1")] The only IP that can trigger actions - for localhost leave empty / null
     * @param {eventActions} [eventActions] The conditions that should trigger an event
     * @returns {Boolean} True, if the HTTP listener could be initialized, false, if not - mostly occurs if the port was already in use
     */
    constructor(port, allowedIP, eventActions) {
        if(xxrlog) console.log("\x1b[37m\x1b[34m\x1b[1m[XXR]: \x1b[0m HTC");
        try {
            if(!usedHttpPorts.includes(port)) {
                usedHttpPorts.push(port);
                /**
                 * HTTP Listener options
                 */
                this._options = {
                    port: (parseInt(port) > 0 ? parseInt(port) : 80),
                    allowedIP: (!jsl.isEmpty(allowedIP) && (typeof allowedIP == "string") ? allowedIP.toString() : "local"),
                    events: {
                        stopCP: {
                            enabled: (eventActions.stopCP != undefined && !jsl.isEmpty(eventActions.stopCP.enabled) ? eventActions.stopCP.enabled : false),
                            method: (eventActions.stopCP != undefined && !jsl.isEmpty(eventActions.stopCP.method) && this._validMethod(eventActions.stopCP.method) ? eventActions.stopCP.method.toUpperCase() : "POST"),
                            body: (eventActions.stopCP != undefined && !jsl.isEmpty(eventActions.stopCP.body) ? eventActions.stopCP.body : "STOP")
                        },
                        startCP: {
                            enabled: (eventActions.startCP != undefined && !jsl.isEmpty(eventActions.startCP.enabled) ? eventActions.startCP.enabled : false),
                            method: (eventActions.startCP != undefined && !jsl.isEmpty(eventActions.startCP.method) && this._validMethod(eventActions.startCP.method) ? eventActions.startCP.method.toUpperCase() : "POST"),
                            body: (eventActions.startCP != undefined && !jsl.isEmpty(eventActions.startCP.body) ? eventActions.startCP.body : "START")
                        },
                        restartCP: {
                            enabled: (eventActions.restartCP != undefined && !jsl.isEmpty(eventActions.restartCP.enabled) ? eventActions.restartCP.enabled : false),
                            method: (eventActions.restartCP != undefined && !jsl.isEmpty(eventActions.restartCP.method) && this._validMethod(eventActions.restartCP.method) ? eventActions.restartCP.method.toUpperCase() : "POST"),
                            body: (eventActions.restartCP != undefined && !jsl.isEmpty(eventActions.restartCP.body) ? eventActions.restartCP.body : "RESTART")
                        },
                        viewLog: {
                            enabled: (eventActions.viewLog != undefined && !jsl.isEmpty(eventActions.viewLog.enabled) ? eventActions.viewLog.enabled : false),
                            method: (eventActions.viewLog != undefined && !jsl.isEmpty(eventActions.viewLog.method) && this._validMethod(eventActions.viewLog.method) ? eventActions.viewLog.method.toUpperCase() : "POST"),
                            body: (eventActions.viewLog != undefined && !jsl.isEmpty(eventActions.viewLog.body) ? eventActions.viewLog.body : "VIEWLOG")
                        }
                    }
                }
                return this.start();
            }
            else return false;
        }
        catch(err) {
            return false;
        }
    }

    /**
     * Starts the HTTP listener if it is stopped
     * @method
     * @returns {Boolean} True, if the HTTP listener could be started, false, if not - this happens if it was not stopped
     */
    start() {
        if(xxrlog) console.log("\x1b[37m\x1b[34m\x1b[1m[XXR]: \x1b[0m HTSTR");
        try {
            if(this._httpServer == undefined) {
                this._httpServer = http.createServer((req, res) => {
                    if((this._options.allowedIP == "local" && httpLocalIPs.includes(req.connection.remoteAddress)) || this._options.allowedIP != "local" && this._options.allowedIP == req.connection.remoteAddress) {
                        
                        let hdata = [];
                        let hkeys = Object.keys(this._options.events);
                        let hprops = [];

                        for(let key in this._options.events) {
                            hprops.push(this._options.events[key]);
                        }

                        for(let i = 0; i < hkeys.length; i++) {
                            if(hprops[i].enabled == true) {
                                hdata.push({
                                    command: hkeys[i],
                                    props: hprops[i]
                                });
                            }
                        }
                        
                        var correct = false;
                        hdata.forEach(hd => {
                            if(hd.props.method == req.method) {
                                // correct method
                                var body = "";
                                req.on("data", data => {
                                    correct = true;
                                    body += data;
                                    if(hd.props.body.toString() == body.toString()) {
                                        // correct body
                                        let cmd = cmdReg[hd.command];
                                        if(xxrlog) console.log("\x1b[37m\x1b[34m\x1b[1m[XXR]: \x1b[0m HCRB");

                                        if(logToConsole) console.log(`\x1b[35m\x1b[1m[node-wrap]\x1b[0m: Got command \x1b[33m\x1b[1m${cmd.disp}\x1b[0m from \x1b[33m\x1b[1m${req.connection.remoteAddress}\x1b[0m`);

                                            try {
                                                let exec = cmd.exec;
                                                let execres = eval(exec); //FIXME: log can't be viewed + stopCP doesn't seem to work
                                                if(xxrlog) console.log("\x1b[37m\x1b[34m\x1b[1m[XXR]: \x1b[0m HEXEC");

                                                res.writeHead(cmd.success.status, null, {"Content-Type":"text/plain;utf-8"});
                                                return res.end(cmd.success.message);
                                            }
                                            catch(err) {
                                                console.log("ERR " + err);
                                                res.writeHead(cmd.fail.status, null, {"Content-Type":"text/plain;utf-8"});
                                                return res.end(cmd.fail.message + err);
                                            }

                                        res.writeHead(200, "Ok", {"Content-Type": "text/plain;utf-8"});
                                        return res.end(`Ok`);
                                    }/*
                                    else {
                                        // wrong body
                                        res.writeHead(400, "Bad Request", {"Content-Type": "text/plain;utf-8"});
                                        return res.end(`Bad Request - command "${body}" not recognized or disabled`);
                                    }*/
                                });
                            }
                            else {
                                // wrong method
                                res.writeHead(405, "Method Not Allowed", {"Content-Type": "text/plain;utf-8"});
                                return res.end(`Method Not Allowed - method "${req.method}" not recognized`);
                            }
                        });
                        setTimeout(()=>{
                            if(!correct) {
                                res.writeHead(400, "Bad Request", {"Content-Type": "text/plain;utf-8"});
                                return res.end(`Bad Request - command not recognized`);
                            }
                        }, 3000);
                    }
                    else {
                        res.writeHead(403, "Forbidden", {"Content-Type": "text/plain;utf-8"});
                        return res.end("Forbidden");
                    }
                })
                .listen(this._options.port, null, null, err => {
                    if(err == undefined) {
                        if(logToConsole) console.log(`\x1b[35m\x1b[1m[node-wrap]\x1b[0m: Initialized HTTP Listener on \x1b[33m\x1b[1m0.0.0.0:${this._options.port}\x1b[0m - Allowed ${(this._options.allowedIP != "local" ? "IP: \x1b[33m\x1b[1m" + this._options.allowedIP : "IPs: \x1b[33m\x1b[1m" + httpLocalIPs.join(" \x1b[0m/\x1b[33m\x1b[1m "))}\x1b[0m`);
                        return true;
                    }
                    else { //error
                        console.log(`\x1b[31m\x1b[1m[node-wrap]\x1b[0m: Couldn't initialize HTTP Listener.\n\x1b[31m\x1b[1m[node-wrap]\x1b[0m: Error: ${err}`);
                        return false;
                    }
                });
            }
            else return false;
        }
        catch(err) {
            return false;
        }
    }

    /**
     * Stops the HTTP listener if it is running
     * @method
     * @returns {Boolean} True, if the HTTP listener could be stopped, false, if not - this happens if it was not running
     */
    stop() {
        if(xxrlog) console.log("\x1b[37m\x1b[34m\x1b[1m[XXR]: \x1b[0m HTSTP");
        try {
            if(this._httpServer != undefined) {
                this._httpServer.close(result => {
                    if(result == undefined) return true;
                    else return false;
                });
            }
            else return false;
        }
        catch(err) {
            return false;
        }
    }

    /** @access private */
    _validMethod(method) {
        return allowedMethods.includes(method.toUpperCase()) ? true : false;
    }
}
module.exports.HttpListener = HttpListener;





    // private - exit CP    =======================================================================================================================================================================================================================================================================================================================================================



function exitHandler(code, restartOnCrash, crashTimeout, restartTimeout, file, options, onStartChild, onCrashChild, onStopChild) {
    if(xxrlog) console.log("\x1b[37m\x1b[34m\x1b[1m[XXR]: \x1b[0m EH");
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
    if(xxrlog) console.log("\x1b[37m\x1b[34m\x1b[1m[XXR]: \x1b[0m SP");
    try {
        prev.file = file;
        prev.options = options;
        prev.onStartChild = onStartChild;
        prev.onCrashChild = onCrashChild;
        prev.onStopChild = onStopChild;

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
            console.log("\x1b[31m\x1b[1m[node-wrap]\x1b[0m: internal error: " + err + "\n\x1b[31m\x1b[1m[node-wrap]\x1b[0m: If you don't want this to shut down the child process, set the option \"alwaysKeepAlive\" to true.");
            process.exit(1);
        }
    }
}





    // private - log to file    =======================================================================================================================================================================================================================================================================================================================================================



function logToFile(options, code) {
    if(xxrlog) console.log("\x1b[37m\x1b[34m\x1b[1m[XXR]: \x1b[0m LTF");
    if(options.logFile != null && typeof options.logFile == "string") fs.appendFileSync(options.logFile, ((options.logTimestamp != null ? options.logTimestamp : true) === true ? "[" + new Date().toString() + "]:  " : "") + "Process got status code " + code + " - Options were: " + JSON.stringify(options) + "\n");
}