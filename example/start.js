// Try to edit settings and run this script to test out node-wrap

require("../node-wrap.js")("./example/processToBeWrapped.js", {
    restartOnCrash: true,                   // whether the child process should be restarted after it crashed
    crashTimeout: 5000,                     // the timeout after a crash after which the child process should be restarted
    restartTimeout: 0,                      // the timeout after a restart command after which the child process should be restarted
    console: true,                          // whether node-wrap should log some important info to the main console (stuff like "Starting process" and "Restarting process")
    logFile: "./example/logs/complete.log", // logs all status codes to that file, leave null or undefined for no file logging
    logConsoleOutput: null,                 // logs all console outputs of the child process to that file, leave null or undefined for no file logging
    logTimestamp: false,                    // whether a timestamp should be added to the above logs
    restartCodes: [2, 3, 4]                 // what additional exit codes should invoke a restart
});