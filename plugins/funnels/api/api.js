'use strict';

var plugin = {},
    plugins = require('../../pluginManager.js'),
    async = require('async'),
    crypto = require('crypto'),
    Promise = require("bluebird"),
    common = require('../../../api/utils/common.js'),
    countlyCommon = require('../../../api/lib/countly.common.js');

const log = require('../../../api/utils/log.js')('funnels:api');

(function() {
    // read api call
    plugins.register("/o", function(ob) {
        var obParams = ob.params;
        var validateUserForDataReadAPI = ob.validateUserForDataReadAPI;
        if (obParams.qstring.method === 'get_funnels') {
            validateUserForDataReadAPI(obParams, function(params) {
                common.db.collection('app_users' + params.qstring.app_id).estimatedDocumentCount(function(errCount, total){
                    if (!errCount && total && total < 10000) {
                        common.db.collection('funnels').find({app_id: params.qstring.app_id}).toArray(function(err, res){
                            if (!err && res && res.length >= 1) {
                                for (let i = 0; i < res.length; i++) {
                                    try {
                                        res[i].steps = JSON.parse(res[i].steps);
                                        res[i].queries = JSON.parse(res[i].queries);
                                        res[i].queryTexts = JSON.parse(res[i].queryTexts);
                                    } catch (error) {
                                        log.d(error);
                                        common.returnOutput(params, []);
                                        break;
                                    }
                                }
                                common.returnOutput(params, res || []);
                            } else {
                                log.d(err);
                                common.returnOutput(params, []);
                            }
                        });
                    } else {
                        log.d(errCount);
                        common.returnOutput(params, []);
                    }
                });
            });
            return true;
        } else if (obParams.qstring.method === 'funnel') {
            validateUserForDataReadAPI(obParams, function(params) {
                let appId = params.qstring.app_id;
                let id = params.qstring.funnel;
                let filter = params.qstring.filter;
                let result = {};
                let steps = []
                if (!id) {
                    common.returnOutput(params, []);
                    return true;
                }

                if (filter) {
                    try {
                        filter = JSON.parse(params.qstring.filter);
                    }
                    catch (ex) {
                        filter = {};
                    }
                }

                if (params.qstring.period) {
                    //check if period comes from datapicker
                    if (params.qstring.period.indexOf(",") !== -1) {
                        try {
                            params.qstring.period = JSON.parse(params.qstring.period);
                        }
                        catch (SyntaxError) {
                            log.d('Parsing custom period failed!');
                            common.returnMessage(params, 400, 'Bad request parameter: period');
                            return false;
                        }
                    }
                    else {
                        switch (params.qstring.period) {
                        case "month":
                        case "day":
                        case "yesterday":
                        case "hour":
                            break;
                        default:
                            if (!/([0-9]+)days/.test(params.qstring.period)) {
                                common.returnMessage(params, 400, 'Bad request parameter: period');
                                return false;
                            }
                            break;
                        }
                    }
                }
                else {
                    common.returnMessage(params, 400, 'Missing request parameter: period');
                    return false;
                }
                countlyCommon.setTimezone(params.appTimezone);
                countlyCommon.setPeriod(params.qstring.period);
                var periodObj = countlyCommon.periodObj, now = params.time.now.toDate();

                //create current period array if it does not exist
                if (!periodObj.currentPeriodArr) {
                    periodObj.currentPeriodArr = [];

                    //create a period array that starts from the beginning of the current year until today
                    if (params.qstring.period === "month") {
                        for (let i = 0; i < (now.getMonth() + 1); i++) {
                            var moment1 = moment();
                            var daysInMonth = moment1.month(i).daysInMonth();

                            for (var j = 0; j < daysInMonth; j++) {
                                periodObj.currentPeriodArr.push(periodObj.activePeriod + "." + (i + 1) + "." + (j + 1));

                                // If current day of current month, just break
                                if ((i === now.getMonth()) && (j === (now.getDate() - 1))) {
                                    break;
                                }
                            }
                        }
                    }
                    //create a period array that starts from the beginning of the current month until today
                    else if (params.qstring.period === "day") {
                        for (let i = 0; i < now.getDate(); i++) {
                            periodObj.currentPeriodArr.push(periodObj.activePeriod + "." + (i + 1));
                        }
                    }
                    //create one day period array
                    else {
                        periodObj.currentPeriodArr.push(periodObj.activePeriod);
                    }
                }

                //get timestamps of start of days (DD-MM-YYYY-00:00) with respect to apptimezone for both beginning and end of period arrays
                var tmpArr;
                filter.ts = {};

                tmpArr = periodObj.currentPeriodArr[0].split(".");
                filter.ts.$gte = new Date(Date.UTC(parseInt(tmpArr[0]), parseInt(tmpArr[1]) - 1, parseInt(tmpArr[2])));
                filter.ts.$gte.setTimezone(params.appTimezone);
                filter.ts.$gte = filter.ts.$gte.getTime() + filter.ts.$gte.getTimezoneOffset() * 60000;

                tmpArr = periodObj.currentPeriodArr[periodObj.currentPeriodArr.length - 1].split(".");
                filter.ts.$lt = new Date(Date.UTC(parseInt(tmpArr[0]), parseInt(tmpArr[1]) - 1, parseInt(tmpArr[2])));
                filter.ts.$lt.setDate(filter.ts.$lt.getDate() + 1);
                filter.ts.$lt.setTimezone(params.appTimezone);
                filter.ts.$lt = filter.ts.$lt.getTime() + filter.ts.$lt.getTimezoneOffset() * 60000;

                // let promises = [];
                // promises.push(new Promise((resolve, reject) => {
                //     common.db.collection('funnels').findOne({_id: id}, {steps: 1, queries: 1, queryTexts: 1, _id: 0}, function(err, res) {
                //         if (!err && res && res.steps && res.steps.length > 1) {
                //             try {
                //                 res.steps = JSON.parse(res.steps);
                //                 res.queries = JSON.parse(res.queries);
                //                 res.queryTexts = JSON.parse(res.queryTexts);
                //             } catch (error) {
                //                 reject(error);
                //             }
                //             resolve(res);
                //         } else {
                //             log.d(err);
                //             reject(err);
                //         }
                //     });
                // }));
                
                // promises.push(new Promise((resolve, reject) => {
                //     common.db.collection('app_users' + appId).estimatedDocumentCount(function(err, total){
                //         if (!err && total) {
                //             resolve(total);
                //         } else {
                //             log.d(err);
                //             reject(err);
                //         }
                //     });
                // }));

                // if (promises.length) {
                new Promise((resolve, reject) => {
                    common.db.collection('funnels').findOne({_id: id}, {steps: 1, queries: 1, queryTexts: 1, _id: 0}, function(err, res) {
                        if (!err && res && res.steps && res.steps.length > 1) {
                            try {
                                res.steps = JSON.parse(res.steps);
                                res.queries = JSON.parse(res.queries);
                                res.queryTexts = JSON.parse(res.queryTexts);
                            } catch (error) {
                                reject(error);
                            }
                            resolve(res);
                        } else {
                            log.d(err);
                            reject(err);
                        }
                    });
                // Promise.all(promises).then(param => {
                }).then(res => {
                    new Promise((resolve, reject) => {
                        let funnel = res;
                        // let totalUsers = param[1];
                        let totalUsers = 0;
                        let tmpSteps = funnel.steps;
                        let tmpQueries = funnel.queries;
                        let tmpQueryTexts = funnel.queryTexts;
                        let key = tmpSteps[0];
                        let collectionName = "drill_events" + crypto.createHash('sha1').update(key + appId).digest('hex');
                        let users = 0,
                            leftUsers = 0;
                        common.drillDb.collection(collectionName).find(filter, {uid: 1, c: 1, _id: 0}).toArray(function(err, res){
                            if (!err && res && res.length > 0) {
                                let uids = [], times = 0;
                                for (let i = 0; i < res.length; i++) { // clear repeat uid, times plus
                                    let item = res[i];
                                    times += common.isNumber(item.c) ? parseInt(item.c) : 0;
                                    if (i != 0) {
                                        let lastItem = res[i - 1];
                                        if (lastItem.uid === item.uid) {
                                            continue;
                                        } else {
                                            if (!uids.includes(res[i].uid)) {
                                                uids.push(res[i].uid);
                                            }
                                        }
                                    } else {
                                        uids.push(res[i].uid);
                                    }
                                }
                                totalUsers = uids.length;
                                users = uids.length;
                                leftUsers = totalUsers - users;
                                let percent = (users / totalUsers).toFixed(3) * 100;
                                let percentLeft = (leftUsers / totalUsers).toFixed(3) * 100;
                                let item = {
                                    step: tmpSteps[0], 
                                    totalUsers: totalUsers, 
                                    users: users, 
                                    leftUsers: leftUsers,
                                    percent: percent,
                                    percentUserEntered: percent,
                                    percentLeft: percentLeft,
                                    percentLeftUserEntered: percentLeft
                                };
                                if (tmpQueries[0]) {
                                    item.queries = tmpQueries[0];
                                }
                                if (tmpQueryTexts[0]) {
                                    item.queryText = tmpQueryTexts[0];
                                }

                                item.times = times;
                                item.averageTimeSpend = (times / users).toFixed(0);

                                steps.push(item);
                                result.total_users = totalUsers;
                                result.users_in_first_step = users;

                                funnel.steps.shift();
                                funnel.queries.shift();
                                funnel.queryTexts.shift();

                                let data = [];
                                data.push(funnel.steps);
                                data.push(users);
                                data.push(uids)
                                data.push(funnel.queries);
                                data.push(funnel.queryTexts);
                                resolve(data);
                            } else {
                                log.d(err);
                                reject(err);
                            }
                        });
                    }).then(data => {
                        function get(params) {
                            return new Promise((resolve, reject) => {
                                let tmpSteps = params[0];
                                let totalUsers = params[1];
                                let uid = params[2];
                                let tmpQueries = params[3];
                                let tmpQueryTexts = params[4];

                                let users = 0,
                                    leftUsers = 0;
                                let key = tmpSteps[0];
                                
                                let collectionName = "drill_events" + crypto.createHash('sha1').update(key + appId).digest('hex');

                                async.map(uid, fetchDrillEvent, (err, events) => {
                                    if (!err && events) {
                                        let uids = [], times = 0;
                                        events.forEach(element => {
                                            if (element) {
                                                uids.push(element.uid);
                                                times += common.isNumber(element.c) ? parseInt(element.c) : 0;
                                            }
                                        });
                                        if (uids.length) {
                                            users = uids.length;
                                            leftUsers = totalUsers - users;
                                            let percent = (users / totalUsers).toFixed(3) * 100;
                                            let percentLeft = (leftUsers / totalUsers).toFixed(3) * 100;
                                            let item = {
                                                step: tmpSteps[0], 
                                                totalUsers: totalUsers, 
                                                users: users, 
                                                leftUsers: leftUsers,
                                                percent: percent,
                                                percentUserEntered: percent,
                                                percentLeft: percentLeft,
                                                percentLeftUserEntered: percentLeft
                                            };
                                            if (tmpQueries[0]) {
                                                item.queries = tmpQueries[0];
                                            }
                                            if (tmpQueryTexts[0]) {
                                                item.queryText = tmpQueryTexts[0];
                                            }

                                            item.times = times;
                                            item.averageTimeSpend = (times / users).toFixed(0);

                                            steps.push(item);
            
                                            tmpSteps.shift();
                                            tmpQueries.shift();
                                            tmpQueryTexts.shift();
            
                                            let data = [];
                                            data.push(tmpSteps);
                                            data.push(users);
                                            data.push(uids)
                                            data.push(tmpQueries);
                                            data.push(tmpQueryTexts);
                                            resolve(data);
                                        } else {
                                            log.d('length equal 0');
                                            reject(err);
                                        }
                                    } else {
                                        log.d(err);
                                        reject(err);
                                    }
                                });

                                /**
                                 * fetch drill event
                                 * @param {string} key - key to of event to fetchDrillEvent 
                                 * @param {function} callback - for result
                                 */
                                function fetchDrillEvent(key, callback) {
                                    let uidVal = key;
                                    common.drillDb.collection(collectionName).find({uid: uidVal}, {uid: 1, c: 1, _id: 0}).toArray(function(err, res) {
                                        let result, c = 0;
                                        if (!err && res && res.length > 0) {
                                            for (let i = 0; i < res.length; i++) {
                                                c += common.isNumber(res[i].c) ? parseInt(res[i].c) : 0;
                                            }
                                            result = {};
                                            result.uid = res[0].uid;
                                            result.c = c;
                                        } else {
                                            log.d(err);
                                        }
                                        callback(null, result);
                                    })
                                }
                            })
                            .then(function(data) {
                                if(!data[0].length) { // recursive end
                                    return data;
                                }
                        
                                return get(data) // recursive call
                                    .then(data => {
                                        return data; // recursive call end
                                    });
                            }, err => {
                                common.returnOutput(params, []);
                            });
                        }

                        get(data).then(data => {
                            result.steps = steps;
                            let last = steps[steps.length - 1];
                            result.success_users = last.users;
                            result.success_rate = (result.success_users / result.users_in_first_step).toFixed(3) * 100;
                            common.returnOutput(params, result);
                        });
                    }, err => {
                        common.returnOutput(params, []);
                    });
                }, err => {
                    common.returnOutput(params, []);
                });
                // }
            });
            return true;
        }
        return false;
    });
    

    //write api call
    plugins.register("/i/funnels/add", function(ob) {
        var obParams = ob.params;
        var validateUserForWriteAPI = ob.validateUserForWriteAPI;

        validateUserForWriteAPI(function(params) {
            // let params = obParams;
            let response = {};
            let funnel = {};
            funnel.app_id = obParams.qstring.app_id;
            if (params.qstring.funnel_name) {
                funnel.name = obParams.qstring.funnel_name;
            } 
            else {
                common.returnMessage(params, 200, 'Not null name argument');
                return true;
            }

            if (params.qstring.funnel_desc) {
                funnel.description = params.qstring.funnel_desc;
            }
            else {
                common.returnMessage(params, 200, 'Not null description argument ');
                return true;
            }

            if (params.qstring.steps) {
                let steps = params.qstring.steps;
                if (steps.length <= 1) {
                    common.returnMessage(params, 200, 'Length not enough steps argument ');
                    return true;
                }
                funnel.steps = steps;
            } else {
                common.returnMessage(params, 200, 'Not null steps argument');
                return true;
            }
            funnel.queries = params.qstring.queries;
            funnel.queryTexts = params.qstring.queryTexts;
            
            funnel._id = common.md5Hash(funnel.app_id + funnel.name);
            common.db.collection('funnels').insert(funnel, function(err, result) {
                if (!err && result && result.insertedIds && result.insertedIds[0]) {
                    plugins.dispatch("/updateAlert", { method: "alertTrigger", alert: result.ops[0] });
                    response.result = result.insertedIds[0];
                    common.returnOutput(params, response);
                }
                else {
                    common.returnMessage(params, 500, "Failed to create an alert");
                }
            });
            return true;
        }, obParams);
        return true;
    });

    plugins.register("/i/funnels/delete", function(ob) {
        var obParams = ob.params;
        var validateUserForWriteAPI = ob.validateUserForWriteAPI;
        validateUserForWriteAPI(function(params) { 
            // let params = obParams;
            let funnelId = params.qstring.funnel_id;
            try {
                common.db.collection('funnels').remove({"_id": common.db.ObjectID(funnelId) }, function(err, result) {
                    log.d(err, result, "delete an funnel");
                    if (!err) {
                        common.returnMessage(params, 200, "Deleted an funnel");
                    }
                });
            } catch (err) {
                log.e('delete funnel failed', funnelId);
                common.returnMessage(params, 500, "Failed to delete an funnel");
            }
            return true;
        }, obParams);
        return true;
    });
    
    plugins.register("/i/funnels/edit", function(ob) {
        var obParams = ob.params;
        var validateUserForWriteAPI = ob.validateUserForWriteAPI;
        validateUserForWriteAPI(function(params) {
            // let params = obParams;
            let funnel = params.qstring.funnel_map;
            try {
                funnel = JSON.parse(params.qstring.funnel_map);
            }
            catch (err) {
                log.e('Parse funnel map failed', params.qstring.funnel_map);
                common.returnMessage(params, 500, "Failed to parse funnel map");
                return true;
            }

            // Get json object property key array
            let funnelId = Object.keys(funnel);
            // Get funnel id beacause json object only one property
            funnelId = funnelId[0];
            // override funnel object by funnel id
            funnel = funnel[funnelId];

            var checkProps = {
                'funnel_name': { 'required': true, 'type': 'String', 'min-length': 1 },
                'funnel_desc': { 'required': true, 'type': 'String', 'min-length': 1 },
                'steps': { 'required': true, 'type': 'String', 'min-length': 2 },
                'queries': { 'required': false, 'type': 'Array', 'min-length': 0 },
                'queryTexts': { 'required': false, 'type': 'Array', 'min-length': 0 }
            };

            if (!(common.validateArgs(funnel, checkProps))) {
                common.returnMessage(params, 200, 'Not enough args');
                return true;
            }

            if (funnelId) {
                const id = funnelId;
                delete funnel.app_id;
                delete funnel.api_key;
                return common.db.collection("funnels").findAndModify(
                    { _id: common.db.ObjectID(id) },
                    {},
                    {$set: funnel},
                    function(err, result) {
                        if (!err) {
                            plugins.dispatch("/updateAlert", { method: "alertTrigger", alert: result.value });
                            plugins.dispatch("/updateAlert", { method: "alertTrigger" });

                            common.returnOutput(params, result && result.value);
                            return true;
                        }
                        else {
                            common.returnMessage(params, 500, "Failed to edit an funnel");
                            return true;
                        }
                    });
            }
        }, obParams);
        return true;
    });

    plugins.register("/i/apps/create", function(ob) {
        var appId = ob.appId;
        common.db.collection('funnels').ensureIndex({'app_id': 1}, function() {});
    });

    plugins.register("/i/apps/delete", function(ob) {
        var appId = ob.appId;
        common.db.collection('funnels').remove({'app_id': appId}, function() {});
    });

    plugins.register("/i/apps/reset", function(ob) {
        var appId = ob.appId;
        common.db.collection('funnels').remove({'app_id': appId}, function() {});
    });

    plugins.register("/i/apps/clear_all", function(ob) {
        var appId = ob.appId;
        common.db.collection('funnels').remove({'app_id': appId}, function() {});
    });

    plugins.register("/i/apps/clear", function(ob) {
        var appId = ob.appId;
        common.db.collection('funnels').remove({'app_id': appId}, function() {});
    });
}(plugin));

module.exports = plugin;


