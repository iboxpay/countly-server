var plugin = {},
    crypto = require('crypto'),
    plugins = require('../../pluginManager.js'),
    common = require('../../../api/utils/common.js'),
    countlyCommon = require('../../../api/lib/countly.common.js'),
    async = require('async'),
    Promise = require("bluebird");

const drillConfig = require('../config.js', 'dont-enclose');
const log = require('../../../api/utils/log.js')('drill:api');

(function() {
    common.drillDb = plugins.dbConnection(drillConfig);

    // read api call
    plugins.register("/o", function(ob) {
        var obParams = ob.params;
        var validateUserForDataReadAPI = ob.validateUserForDataReadAPI;
        if (obParams.qstring.method === 'segmentation') {
            validateUserForDataReadAPI(obParams, function(params){
                let query = {};
                let result;
                let bucket = params.qstring.bucket;
                if (params.qstring.period) {
                    //check if period comes from datapicker
                    if (params.qstring.period.indexOf(",") !== -1) {
                        try {
                            params.qstring.period = JSON.parse(params.qstring.period);
                        }
                        catch (SyntaxError) {
                            common.returnMessage(params, 400, 'Bad request parameter: period');
                            return true;
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
                                return true;
                            }
                            break;
                        }
                    }
                }
                else {
                    common.returnMessage(params, 400, 'Missing request parameter: period');
                    return true;
                }

                if (params.qstring.queryObject) {
                    try {
                        params.qstring.queryObject = JSON.parse(params.qstring.queryObject);
                    }
                    catch (SyntaxError) {
                        common.returnMessage(params, 400, 'Bad request parameter: queryObject');
                        return true;
                    }
                    let filter = params.qstring.queryObject;
                    for (let k in filter) {
                        query[k] = filter[k];
                    }
                }
                countlyCommon.setPeriod(params.qstring.period, true);
                let period = countlyCommon.periodObj;
                let dateIds = getDateIds(bucket, period);
                let collectionName = 'drill_events' + crypto.createHash('sha1').update(params.qstring.event + params.qstring.app_id).digest('hex');
                let condition;
                switch(bucket) {
                    case "monthly":
                        condition = common.dbEventMap.month;
                        break;
                    case "weekly":
                        condition = common.dbEventMap.week;
                        break;
                    case "daily":
                        condition = common.dbEventMap.day;
                        break;
                    case "hourly":
                        condition = common.dbEventMap.hour;
                        break;
                    default:
                        common.returnMessage(params, 400, 'Bad request parameter: bucket');
                        return true;
                }
                
                query[condition] = { $in: dateIds };
                let pipeline = [];
                pipeline.push({$match: query});
                let group = {};
                group['_id'] = "$" + condition;
                group[common.dbEventMap.count] = { $sum: "$c" };
                group[common.dbEventMap.sum] = { $sum: "$s" };
                group[common.dbMap.dur] = { $sum: "$dur" };
                group[common.dbMap.unique] = { $addToSet: "$uid" };
                pipeline.push({$group: group});
                pipeline.push({$sort: {_id: 1}})

                common.drillDb.collection(collectionName).aggregate(pipeline, {allowDiskUse: true}, function(err, res) {
                    if (!err && res && res.length > 0) {
                        let result = {};
                        let data = {};
                        res.forEach(function(doc) {
                            let item = {};
                            item[common.dbMap.unique] = doc.u.length;
                            item[common.dbMap.total] = doc.c;
                            item[common.dbMap.sum] = doc.s;
                            item[common.dbMap.dur] = doc.dur;
                            data[doc._id] = item;
                        });
                        result["data"] = data;
                        result['app_id'] = params.qstring.app_id;
                        result['lu'] = new Date();
                        common.returnOutput(params, result);
                    } else {
                        common.returnOutput(params, result || []);
                    }
                });
            });
            return true;
        } else if (obParams.qstring.method === 'segmentation_users') {
            validateUserForDataReadAPI(obParams, function(params){
                common.returnOutput(params, []);
            });
            return true;            
        } else if (obParams.qstring.method === 'segmentation_meta') {
            validateUserForDataReadAPI(obParams, function(params){
                let event = params.qstring.event;
                let appId = params.app_id;
                event = common.fixEventKey(event);
                let collection = "drill_meta" + appId;
                let metaId = "meta_" + crypto.createHash('sha1').update(event + appId).digest('hex');

                common.drillDb.collection(collection).findOne({'_id': metaId}, {_id:0}, function(err, meta) {
                    if (!err && meta) {
                        common.returnOutput(params, meta || {});
                    } else {
                        common.returnOutput(params, []);
                    }
                });

                return true;
            });
            return true;            
        } else if (obParams.qstring.method === 'segmentation_big_meta') {
            validateUserForDataReadAPI(obParams, function(params){
                common.returnOutput(params, []);
            });
            return true;            
        } else if (obParams.qstring.method === 'drill_bookmarks') {
            validateUserForDataReadAPI(obParams, function(params){
                let event = params.qstring.event_key;
                common.drillDb.collection('drill_bookmarks').find({event_key: event}).toArray(function(err, res){
                    if (!err && res && res.length >= 1) {
                        common.returnOutput(params, res || []);
                    } else {
                        log.d(err);
                        common.returnOutput(params, []);
                    }
                });
            });
            return true;            
        }
    });

    plugins.register("/i", function(ob) {
        let params = ob.params;
        return new Promise(function(resolve) {
            let incomingEvents = params.qstring.events;
            let appUser = params.app_user;
            if (incomingEvents && appUser) {
                processMeta(params, incomingEvents, appUser, resolve);
                processEvents(params, incomingEvents, appUser, resolve);
            } else {
                resolve();
            }
        });
    });

     //write api call
     plugins.register("/i/drill/add_bookmark", function(ob) {
         var obParams = ob.params;
         var validateUserForWriteAPI = ob.validateUserForWriteAPI;
 
         validateUserForWriteAPI(function(params) {
             let bookmark = {};

             bookmark.app_id = params.qstring.app_id;
             try {
                 bookmark.global = JSON.parse(params.qstring.global);
             }
             catch (err) {
                 log.e('Parse global failed', params.qstring.global);
                 common.returnMessage(params, 500, "Failed to parse global");
                 return true;
             }
             if (params.qstring.name) {
                 bookmark.name = params.qstring.name;
             } 
             else {
                 common.returnMessage(params, 200, 'Not null name argument');
                 return true;
             }

             if (params.qstring.desc) {
                 bookmark.desc = params.qstring.desc;
             }
             else {
                 common.returnMessage(params, 200, 'Not null description argument ');
                 return true;
             }

             if (params.qstring.event_key) {
                 bookmark.event_key = params.qstring.event_key;
             }
             else {
                 common.returnMessage(params, 200, 'Not null event argument ');
                 return true;
             }

             if (params.qstring.query_obj) {
                 bookmark.query_obj = params.qstring.query_obj;
             }
             else {
                 common.returnMessage(params, 200, 'Not null query_obj argument ');
                 return true;
             }

             if (params.qstring.query_text) {
                 bookmark.query_text = params.qstring.query_text;
             }
             else {
                 common.returnMessage(params, 200, 'Not null query_text argument ');
                 return true;
             }

             if (params.qstring.creator) {
                 bookmark.creator = params.qstring.creator;
             }
             else {
                 common.returnMessage(params, 200, 'Not null creator argument ');
                 return true;
             }
            //  bookmark.event_app_id = common.db.ObjectID;

             common.drillDb.collection('drill_bookmarks').insert(bookmark, function(err, result){
                if (!err && result && result.insertedIds && result.insertedIds[0]) {
                    let response = {};
                    plugins.dispatch("/updateAlert", { method: "alertTrigger", alert: result.ops[0] });
                    response.result = 'Success';
                    common.returnOutput(params, response);
                }
                else {
                    common.returnMessage(params, 500, "Failed to create an alert");
                }
             });
         }, obParams)

        return true
     });

     plugins.register("/i/drill/delete_bookmark", function(ob) {
        var obParams = ob.params;
        var validateUserForWriteAPI = ob.validateUserForWriteAPI;
        validateUserForWriteAPI(function(params) { 
            let id = params.qstring.bookmark_id;
            try {
                common.drillDb.collection('drill_bookmarks').remove({"_id": common.db.ObjectID(id) }, function(err, result) {
                    log.d(err, result, "delete an bookmark item");
                    if (!err) {
                        let response = {};
                        response.result = 'Success';
                        common.returnOutput(params, response);
                    }
                });
            } catch (err) {
                log.e('delete bookmark item failed', id);
                common.returnMessage(params, 500, "Failed to delete an funnel");
            }
            return true;
        }, obParams);
        return true;
    });

    plugins.register("/i/drill/edit_bookmark", function(ob) {
        var obParams = ob.params;
        var validateUserForWriteAPI = ob.validateUserForWriteAPI;
        validateUserForWriteAPI(function(params) {
            let bookmark = {} 
            let id = params.qstring.bookmark_id;
            try {
                bookmark.global = JSON.parse(params.qstring.global);
            }
            catch (err) {
                log.e('Parse global failed', params.qstring.global);
                common.returnMessage(params, 500, "Failed to parse global");
                return true;
            }
            if (params.qstring.name) {
                bookmark.name = params.qstring.name;
            } 
            else {
                common.returnMessage(params, 200, 'Not null name argument');
                return true;
            }

            if (params.qstring.desc) {
                bookmark.desc = params.qstring.desc;
            }
            else {
                common.returnMessage(params, 200, 'Not null description argument ');
                return true;
            }
            return common.drillDb.collection("drill_bookmarks").findAndModify(
                { _id: common.db.ObjectID(id) },
                {},
                {$set: bookmark},
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
        }, obParams);
        return true;
    });

    plugins.register("/plugins/drill", function(ob) {
        let params = ob.params;
        log.d("plugins/drill: " + params.app_id);
    });

    /**
    * Process segments from params
    * @param {params} params - params object
    * @param {array} omitted_segments - array of segments to omit
    * @param {function} done - callback function to call when done processing
    **/
    function processMeta(params, appEvents, appUser, done) {
        var forbiddenSegValues = [];
        for (let i = 1; i < 32; i++) {
            forbiddenSegValues.push(i + "");
        }
        let metaToFetch = {};
        let incomingEvents = [];
        for (let i = 0; i < appEvents.length; i++) {
            var currEvent = appEvents[i];
                shortEventName = "";
                metaCollectionName = "";

            if (!currEvent.key || !currEvent.count || !common.isNumber(currEvent.count) ||
                (currEvent.key.indexOf('[CLY]_') === 0)) {
                log.d("process meta: " + currEvent.key);
                continue;
            }

            shortEventName = common.fixEventKey(currEvent.key);

            if (!shortEventName) {
                continue;
            }

            if (currEvent.segmentation) {
                let j = 0;
                for (var segKey in currEvent.segmentation) {
                    //check if segment should be ommited
                    if (plugins.internalOmitSegments[currEvent.key] && Array.isArray(plugins.internalOmitSegments[currEvent.key]) && 
                            plugins.internalOmitSegments[currEvent.key].indexOf(segKey) !== -1) {
                        continue;
                    }

                    var tmpSegval = currEvent.segmentation[segKey] + "";

                    if (tmpSegval === "") {
                        continue;
                    }

                    // Mongodb field names can't start with $ or contain .
                    tmpSegVal = tmpSegval.replace(/^\$/, "").replace(/\./g, ":");

                    if (forbiddenSegValues.indexOf(tmpSegval) !== -1) {
                        tmpSegval = "[CLY]" + tmpSegVal;
                    }

                    metaToFetch[j] = {
                        eventName: shortEventName,
                        key: segKey,
                        value: tmpSegval,
                        type: 'l'
                    };
                    j++;
                }
            }
            common.arrayAddUniq(incomingEvents, shortEventName);
        }
        
        if (Object.keys(metaToFetch).length == 0) {
            done();
            return;
        }

        async.map(Object.keys(metaToFetch), fetchEventMeta, function(err, eventMetaDocs) {
            for(let i = 0; i < eventMetaDocs.length; i++) {
                let meta = eventMetaDocs[i];
                if (meta) {
                    common.arrayAddUniq(meta.values, metaToFetch[i].value);
                } else { //TODO: value common if key exist, continue. reduce db operate.
                    meta = {};
                    meta.values = [metaToFetch[i].value];
                }
                meta.type = metaToFetch[i].type;
                let id = "meta_" + crypto.createHash('sha1').update(metaToFetch[i].eventName + params.app_id).digest('hex');
                let update = {'$set': {}};
                update.$set['sg.' + metaToFetch[i].key] = meta;
                update.$set['app_id'] = params.app_id;
                update.$set['e'] = metaToFetch[i].eventName;
                common.drillDb.collection("drill_meta" + params.app_id).update({'_id': id}, update, {'upsert': true}, function() {});
            }

            for(let i = 0; i < incomingEvents.length; i++) {
                processUser(appUser, params.app_id, incomingEvents[i]);
            }
        });

        /**
        * Fetch event meta
        * @param {string} id - id to of event to fetchEventMeta
        * @param {function} callback - for result
        **/
       function fetchEventMeta(id, callback) {
            let coll = "drill_meta" + params.app_id;
            let metaId = "meta_" + crypto.createHash('sha1').update(metaToFetch[id].eventName + params.app_id).digest('hex');
            let projection = {_id: 0, ['sg.' + metaToFetch[id].key] : 1};
            common.drillDb.collection(coll).findOne({'_id': metaId}, projection, function(err, meta) {
                let result;
                if (meta && meta.sg && meta.sg[metaToFetch[id].key]) {
                    result = meta.sg[metaToFetch[id].key];
                }
                callback(false, result);
            });
        }
    }

    /**
    * Process events from params
    * @param {params} params - params object
    * @param {array} appEvents - aray with existing event keys
    * @param {function} done - callback function to call when done processing
    **/
    function processEvents(params, appEvents, appUser, done) {
        var tmpEventObj = {},
            tmpEventColl = [],
            shortEventName = {},
            eventCollectionName = {};

        for (let i = 0; i < appEvents.length; i++) {
            var currEvent = appEvents[i];
            tmpEventObj = {};

            // Key and count fields are required
            if (!currEvent.key || !currEvent.count || !common.isNumber(currEvent.count) || 
                    (currEvent.key.indexOf('[CLY]_') === 0 && plugins.internalDrillEvents.indexOf(currEvent.key) === -1)) {
                log.d("process events: " + currEvent.key);
                continue;
            }

            shortEventName = common.fixEventKey(currEvent.key);

            if (!shortEventName) {
                continue;
            }

            // Create new collection name for the event
            eventCollectionName = "drill_events" + crypto.createHash('sha1').update(shortEventName + params.app_id).digest('hex');

            if (params.qstring.device_id) {
                tmpEventObj[common.dbUserMap.device_id] = params.qstring.device_id;
            }

            if (params.app_user_id) {
                tmpEventObj[common.dbUserMap.user_id] = params.app_user_id;
            }

            let time = params.time;
            tmpEventObj[common.dbEventMap.timestamp] = time.mstimestamp;
            // 2019.10.20
            tmpEventObj[common.dbEventMap.day] = time.daily;
            // 2019.w43
            tmpEventObj[common.dbEventMap.week] = time.yearly + ".w" + time.weekly;
            // 2019.m10
            tmpEventObj[common.dbEventMap.month] = time.yearly + ".m" + time.month;
            // 2014.10.20.h14
            tmpEventObj[common.dbEventMap.hour] = time.daily + ".h" + time.hour;

            if (currEvent.sum && common.isNumber(currEvent.sum)) {
                currEvent.sum = parseFloat(parseFloat(currEvent.sum).toFixed(5));
                tmpEventObj[common.dbEventMap.sum] = currEvent.sum;
            }

            if (currEvent.dur && common.isNumber(currEvent.dur)) {
                currEvent.dur = parseFloat(currEvent.dur);
                tmpEventObj[common.dbMap.dur] = currEvent.dur;
            }
            
            tmpEventObj[common.dbEventMap.count] = currEvent.count;

            if (currEvent.segmentation) {
                tmpEventObj[common.dbEventMap.segmentations] = currEvent.segmentation;
            }

            let up = {};
            up[common.dbUserMap.first_seen] = appUser[common.dbUserMap.first_seen];
            up[common.dbUserMap.last_seen] = appUser[common.dbUserMap.last_seen];
            up[common.dbUserMap.total_session_duration] = appUser[common.dbUserMap.total_session_duration];
            up[common.dbUserMap.session_count] = appUser[common.dbUserMap.session_count];
            up[common.dbUserMap.device] = appUser[common.dbUserMap.device];
            up[common.dbUserMap.city] = appUser[common.dbUserMap.city];
            up[common.dbUserMap.country_code] = appUser[common.dbUserMap.country_code];
            up[common.dbUserMap.platform] = appUser[common.dbUserMap.platform];
            up[common.dbUserMap.platform_version] = appUser[common.dbUserMap.platform_version];
            up[common.dbUserMap.app_version] = appUser[common.dbUserMap.app_version];
            up[common.dbUserMap.carrier] = appUser[common.dbUserMap.carrier];
            up[common.dbUserMap.resolution] = appUser[common.dbUserMap.resolution];
            tmpEventObj.up = up;

            tmpEventObj.coll = eventCollectionName;
            tmpEventObj.cd = new Date();
            tmpEventColl.push(tmpEventObj) ;
        }

        for(let i = 0; i < tmpEventColl.length; i++) {
            var collectionName = tmpEventColl[i].coll;
            delete tmpEventColl[i].coll;
            common.drillDb.collection(collectionName).update({'ts': tmpEventColl[i].ts}, {$set: tmpEventColl[i]}, {'upsert': true}, function() {});
        }
        done();
    }

    function processUser(appUser, appId, eventName) {
        delete appUser._id;
        async.map(Object.keys(appUser), fetchEventUser, function(err, userMetaDocs) {
            for(let i = 0; i < userMetaDocs.length; i++) {
                let meta = userMetaDocs[i];
                let key = meta.key;
                if (meta.values) {
                    common.arrayAddUniq(meta.values, appUser[key]);
                } else {
                    meta.values = [appUser[key]];
                }
                delete meta.key;

                meta.type = 'l';
                let id = "meta_" + crypto.createHash('sha1').update(eventName + appId).digest('hex');
                let sessionId = "meta_" + crypto.createHash('sha1').update("[CLY]_session" + appId).digest('hex');
                let update = {'$set': {}};
                update.$set['up.' + key] = meta;
                common.drillDb.collection("drill_meta" + appId).update({'_id': id}, update, {'upsert': true}, function() {});
                
                update.$set['type'] = common.dbEventMap.user_properties;
                update.$set['e'] = '[CLY]_session';
                update.$set['app_id'] = appId;
                common.drillDb.collection("drill_meta" + appId).update({'_id': sessionId}, update, {'upsert': true}, function() {});
            }
        });
        
        /**
        * Fetch event user
        * @param {string} key - key to of user to fetchEventUser
        * @param {function} callback - for result
        **/
        function fetchEventUser(key, callback) {
            let coll = "drill_meta" + appId;
            let metaId = "meta_" + crypto.createHash('sha1').update(eventName + appId).digest('hex');
            let projection = {_id: 0, ['up.' + key] : 1};
            common.drillDb.collection(coll).findOne({'_id': metaId}, projection, function(err, meta) {
                let result = {};
                if (meta && meta.up && meta.up[key]) {
                    result = meta.up[key];
                }
                result.key = key;
                callback(false, result);
            });
        }
    }

    function getDateIds(bucket, period) {
        let _periodObj = period,
            dateIds = [];
        let i = 0;
        let now = new common.time.Date();   
        let tmpDateIds = [];
        switch (bucket) {
        case "daily":
            dateIds = _periodObj.currentPeriodArr;
            // tmpDateIds.forEach(element => {
            //     let day = element.replace(/\./g, ':');
            //     dateIds.push(day);
            // });
            break;
        case "hourly":
            tmpDateIds = _periodObj.currentPeriodArr
            for (i = 0; i < 25; i++) {
                for(let j = 0; j < tmpDateIds.length; j++) {
                    // let hour = tmpDateIds[j].replace(/\./g, ':');
                    let hour = tmpDateIds[j];
                    dateIds.push(hour + ".h" + i);
                }
            }
            break;
        case "monthly":
            tmpDateIds = _periodObj.uniquePeriodCheckArr;
            tmpDateIds.forEach(element => {
                let month = element.split('.');
                // month = month[0] + ":m" + month[1];
                month = month[0] + ".m" + month[1];
                dateIds.push(month);
            });
            break;
        case "weekly":
            if (now.getFullYear() === _periodObj.activePeriod) {
                let week;
                tmpDateIds = _periodObj.uniquePeriodArr;
                tmpDateIds = tmpDateIds.reverse();
                week = tmpDateIds.find(id => id.includes('.w'));
                week = week.substring(week.indexOf('w') + 1);
                week = parseInt(week, 10);
                for (i = 1; i <= week + 1; i++) {
                    let year = _periodObj.activePeriod;
                    // dateIds.push(year + ":w" + i);
                    dateIds.push(year + ".w" + i);
                }
            } else {
                tmpDateIds = _periodObj.uniquePeriodArr;
                dateIds = tmpDateIds.filter(id => id.includes('.w'));
                // tmpDateIds = tmpDateIds.filter(id => id.includes('.w'));
                // tmpDateIds.forEach(element => {
                //     dateIds.push(element.replace(/\./g, ':'));
                // });
            }
            break;
        }
        return dateIds;
    }

}(plugin));

module.exports = plugin;