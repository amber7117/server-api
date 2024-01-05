"use strict";

const fs = require("fs");
let rawdata = fs.readFileSync("package.json");
let config = JSON.parse(rawdata);
config.scripts = {};
config.scripts.start = "node index.js";
delete config.devDependencies;
fs.writeFileSync("dist/package.json", JSON.stringify(config));
rawdata = fs.readFileSync("ecosystem.config.js",{
    encoding : "utf-8"
});
rawdata = rawdata.replace("./dist/index.js","index.js");
fs.writeFileSync("dist/ecosystem.config.js", rawdata);