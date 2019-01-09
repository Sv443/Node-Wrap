# <img src="https://raw.githubusercontent.com/Sv443/Node-Wrap/master/icons/icon_tiny.png" style="width: 2.5vw;height: 2.5vw;"> <u>Node-Wrap v0.1.1</u> <br> [![](https://img.shields.io/github/license/Sv443/node-wrap.svg?style=flat-square)](https://github.com/Sv443/node-wrap/blob/master/LICENSE) [![](https://img.shields.io/badge/JSDoc-supported-green.svg?style=flat-square)](http://usejsdoc.org/) [![](https://img.shields.io/github/issues/Sv443/node-wrap.svg?style=flat-square)](https://github.com/Sv443/node-wrap/issues) [![](https://img.shields.io/github/stars/Sv443/node-wrap.svg?style=flat-square)](https://github.com/Sv443/node-wrap/stargazers)
## A lightweight library that wraps your script to restart it once it crashes and to provide other useful stuff

<br>

### Install it:
```
>  npm i --save node-wrap
```

<br><br>
---
## **Menu:** &nbsp; &nbsp;[Minimal Example](#and-that-is-where-this-package-comes-into-play) - [Full Example](#full-example-with-all-options-some-of-them-changed-from-default) - [Disclaimer / Issues / Licensing](#disclaimer--issues--licensing) - [Status Code Table](#status-codes) - [TLDR](#just-to-recap--tldr)
---  
<br><br><br><br>


<br><br><br>
## Let's say you develop a server side application...
...whether it is an API of some sort or something like a Discord bot, you will run into these problems:<br>
- **Node always exits the script if an error can't be caught**<br>
- **Even if you don't have that problem, you might still want the ability to restart the entire script**<br><br><br>

<br><br><br><br>

## And that is where this package comes into play:
```js
require("node-wrap")("./path/to/the/script/that/should/be/wrapped.js");
```
The above is the smallest possible way to call the wrapper.<br><br>
## Let's see what that example does:
First of all, it sets these default settings if none are provided:
```js
restartOnCrash: true,    // whether the child process should be restarted after it crashed
crashTimeout: 2000,      // the timeout after a crash after which the child process should be restarted
restartTimeout: 0,       // the timeout after a restart command after which the child process should be restarted
console: true,           // whether node-wrap should log some important info to the main console (stuff like "Starting process" and "Restarting process")
logFile: null,           // logs all status codes to that file, leave null or undefined for no file logging                
logConsoleOutput: null,  // logs all console outputs of the child process to that file, leave null or undefined for no file logging
logTimestamp: true,      // whether a timestamp should be added to the above logs
restartCodes: []         // what additional exit codes should invoke a restart
```
Afterwards the script begins by starting the provided script as a child process.<br>
Because the "logConsoleOutput" property defaulted to null, all stdout (console) output of the child script will be sent to the console of the wrapper.<br>
Now the child process already runs!<br>
To activate the wrapper's magic powers, you need to exit the child process with a certain code from the following list.<br><br>
## Status Codes
| Code | Action | Description |  
| --- | --- | --- |  
| `0` | Stop | This completely stops the child and wrapping process |  
| `1` | Crash | This triggers a restart if the "restartOnCrash" property of the settings was not set to false (it defaults to true) |  
| `2` | Restart | This triggers an intentional restart |<br>

<br><br><br>

So let's say your Discord bot has a developer-only "/restart" command.<br>
To trigger an intentional restart you need to exit the script with the status code `2` (see the table above), just like this:
```js
process.exit(2);
```
...uhh yes, that's it already! You don't need to add anything more to your script(s)!<br><br><br><br><br><br>

## Just to recap / TLDR:
1. Create another script file that only contains the minimal example above or the full example at the bottom of this readme if you want to configure it yourself
2. Change the "main" property in your "package.json" to start the new file you just made instead (also change other things if you have any to make sure the new file is being run)
3. Add the needed `process.exit(code)` function(s) to your script(s) to trigger the wanted action(s)


<br><br><br><br><br><br><br><br>
## Full example with all options (some of them changed from default):
```js
require("node-wrap")("./index.js", {
    restartOnCrash: true,                   // whether the child process should be restarted after it crashed
    crashTimeout: 20000,                    // the timeout after a crash after which the child process should be restarted
    restartTimeout: 1000,                   // the timeout after a restart command after which the child process should be restarted
    console: true,                          // whether node-wrap should log some important info to the main console (stuff like "Starting process" and "Restarting process")
    logFile: "./logs/wrapper.log",          // logs all status codes to that file, leave null or undefined for no file logging
    logConsoleOutput: "./logs/console.log", // logs all console outputs of the child process to that file, leave null or undefined for no file logging
    logTimestamp: false,                    // whether a timestamp should be added to the above logs
    restartCodes: [2, 3, 4]                 // what additional exit codes should invoke a restart
});
```

<br><br><br><br>
## Disclaimer / Issues / Licensing:
Even though this package should do the job just fine, I can't guarantee anything.<br>
I try my best to make it as reliable as possible but if you have any complaints or want to suggest a feature, please [create a new issue here](https://github.com/Sv443/node-wrap/issues) and I will get to you ASAP.<br><br>
Additionally, I hereby (and by the provided MIT license) free myself of any liability and legal consequences.<br>
This package was not made with the intention of being malicious so if it is used in criminal activities, I can't be held responsible.<br><br>
If you modify or share this package you are free to do that under one single condition: It has to still include the "LICENSE" file (also I'd be happy if you [contact me](https://sv443.net/), maybe I'll even advertise your version)
