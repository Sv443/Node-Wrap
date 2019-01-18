// Try to edit settings and run this script to test out node-wrap

require("../node-wrap.js")("./example/processToBeWrapped.js", {
    restartOnCrash: true,                   // whether the child process should be restarted after it crashed
    crashTimeout: 2000,                     // the timeout after a crash after which the child process should be restarted
    restartTimeout: 0,                      // the timeout after a restart command after which the child process should be restarted
    console: true,                          // whether node-wrap should log some important info to the main console (stuff like "Starting process" and "Restarting process")
    logFile: "./example/logs/complete.log", // logs all status codes to that file, leave null or undefined for no file logging
    logConsoleOutput: null,                 // logs all console outputs of the child process to that file, leave null or undefined for no file logging
    logTimestamp: false,                    // whether a timestamp should be added to the above logs
    restartCodes: [2, 3, 4],                // what additional exit codes should invoke a restart
    bootLoopDetection: 3000,                // boot loop prevention mechanism: enter the estimated time in milliseconds it usually takes to INITIALIZE (until an infinite loop of some sort gets started) the child process (0 or leave empty to disable) (higher number = higher stability but also longer delay until the boot loop detection kicks in - if you're unsure or it's unstable, take the biggest number of your measurements)
    alwaysKeepAlive: false                  // set to true to force node-wrap to insistently keep alive / restart the child process as fast and reliably as possible (unaffected by boot loop detection though)
});