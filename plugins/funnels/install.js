var pluginManager = require("../pluginManager.js");
var countlyDb = pluginManager.dbConnection();

console.log("Installing funnels plugin");

function done() {
    console.log("Funnels plugin installation finished");
    countlyDb.close();
}

console.log("Adding funnels index");
var cnt = 0;
function cb() {
    cnt++;
    if (cnt == 2) {
        done;
    }
}

countlyDb.collection('funnels').ensureIndex({"app_id": 1}, cb);
countlyDb.collection('funnels').ensureIndex({"name": 1}, cb);
