// Don't run this script! Run the start.js file.
// Only edit the following settings

// Set one setting at a time to true to test it:
const set = {
    stop: false, // Code 0
    crash: false, // Code 1
    restart: true, // Code 2
    other: false // Code 3
};





console.log("\x1b[36m\x1b[1m[processToBeWrapped]\x1b[0m: I am the child process and I was just started!");


if(set.crash) {
    setTimeout(()=>{
        console.log("\x1b[36m\x1b[1m[processToBeWrapped]\x1b[0m: Crashing...");
        process.exit(1);
    }, 3000);
}
else if(set.restart) {
    setTimeout(()=>{
        console.log("\x1b[36m\x1b[1m[processToBeWrapped]\x1b[0m: Restarting...");
        process.exit(2);
    }, 3100);
}
else if(set.stop) {
    setTimeout(()=>{
        console.log("\x1b[36m\x1b[1m[processToBeWrapped]\x1b[0m: Stopping...");
        process.exit(0);
    }, 3200);
}
else if(set.other) {
    setTimeout(()=>{
        console.log("\x1b[36m\x1b[1m[processToBeWrapped]\x1b[0m: Code 3...");
        process.exit(3);
    }, 3300);
}
else {
    setTimeout(()=>{
        process.exit(0); // <- it's a good practice to stop the script if it's done (don't let it "run out" by itself) (of course don't do this while awaiting an async function or in a while-like loop)
    }, 3500);
}