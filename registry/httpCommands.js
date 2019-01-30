/**
 * HTTP command registry for Node-Wrap
 */
module.exports = {
    stopCP: {
        disp: "Stop",
        exec: `
            child.kill("SIGKILL");
            `,
        success: {
            status: 200,
            message: "Stopped the child process successfully"
        },
        fail: {
            status: 500,
            message: "Couldn't stop child process due to error: "
        }
    },
    restartCP: {
        disp: "Restart",
        exec: `
            child.kill("SIGKILL"); // <- comment this to hear your PC struggle as its life essence gets drained and it slowly dies a cruel death
            if(prev.options.alwaysKeepAlive === true) prev.restartTimeout = 0;
            setTimeout(()=>{
                if(logToConsole) console.log("\x1b[33m\x1b[1m[node-wrap]\x1b[0m: Restarted child process");
                startProcess(prev.file, prev.options, prev.onStartChild, prev.onCrashChild, prev.onStopChild);
            }, prev.restartTimeout);
            `,
        success: {
            status: 200,
            message: "Restarted the child process successfully"
        },
        fail: {
            status: 500,
            message: "Couldn't restart child process due to error: "
        }
    },
    startCP: {
        disp: "Start",
        exec: `
            start();
            `,
        success: {
            status: 200,
            message: "Started the child process successfully"
        },
        fail: {
            status: 500,
            message: "Couldn't start the child process due to error: "
        }
    },
    viewLog: {
        disp: "View Log",
        exec: `
            if(prev.options.logFile != null && typeof prev.options.logFile == "string") fs.readFileSync(prev.options.logFile).toString();
            `,
        success: {
            status: 200
        },
        fail: {
            status: 500,
            message: "Couldn't retrieve log file due to error: "
        }
    }
};