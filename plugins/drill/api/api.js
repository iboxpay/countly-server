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
                let ands = [];
                // let tmp = {};
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
                        let tmp = {};
                        tmp[k] = filter[k];
                        ands.push(tmp);
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
                
                let timeObj = {};
                timeObj[condition] = { $in: dateIds }
                ands.push(timeObj);
                let pipeline = [];
                // let phoneTmp = {'sg.phone_num': {$in: ['18927430742']}}
                // pipeline.push({$match: {$and: [timeObj, phoneTmp]}});
                pipeline.push({$match: {$and: ands}});
                
                let uidGroup = {};
                let UDCondition = {};
                UDCondition[condition] = "$" + condition;
                UDCondition['uid'] = "$uid";
                uidGroup['_id'] = UDCondition;
                uidGroup[common.dbEventMap.count] = { $sum: "$c" };
                uidGroup[common.dbEventMap.sum] = { $sum: "$s" };
                uidGroup[common.dbMap.dur] = { $sum: "$dur" };

                dateGroup = {};
                let dateCondition = {};
                dateCondition[condition] = "$_id." + condition;
                dateGroup['_id'] = dateCondition;
                dateGroup[common.dbEventMap.count] = { $sum: "$c" };
                dateGroup[common.dbEventMap.sum] = { $sum: "$s" };
                dateGroup[common.dbMap.dur] = { $sum: "$dur" };
                dateGroup[common.dbMap.unique] = { $sum: 1 };
                pipeline.push({$group: uidGroup});
                pipeline.push({$group: dateGroup});
                // pipeline.push({$sort: {_id: 1}})

                common.drillDb.collection(collectionName).aggregate(pipeline, {allowDiskUse: true}, function(err, res) {
                    if (!err && res && res.length > 0) {
                        let result = {};
                        let data = {};
                        res.forEach(function(doc) {
                            let item = {};
                            item[common.dbMap.unique] = doc.u;
                            item[common.dbMap.total] = doc.c;
                            item[common.dbMap.sum] = doc.s;
                            item[common.dbMap.dur] = doc.dur;
                            data[doc._id[condition]] = item;
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

                common.drillDb.collection(collection).findOne({'_id': 'meta_up'}, {_id:0}, function(err, meta) {
                    if (!err && meta) {
                        common.drillDb.collection(collection).findOne({'_id': metaId}, {sg: 1, e: 1}, 
                            function(error, eMeta) {
                                if (!error && eMeta) {
                                    meta.e = eMeta.e;
                                    meta.sg = eMeta.sg;
                                }
                                common.returnOutput(params, meta || {});
                                
                        });
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

    plugins.register("/i/apps/create", function(ob) {
        var appId = ob.appId;
        common.drillDb.collection('drill_event' + appId).ensureIndex({device_id: 1}, function() {});
        common.drillDb.collection('drill_event' + appId).ensureIndex({uid: 1}, function() {});
        common.drillDb.collection('drill_event' + appId).ensureIndex({ts: 1}, function() {});
        common.drillDb.collection('drill_event' + appId).ensureIndex({d: 1}, function() {});
        common.drillDb.collection('drill_event' + appId).ensureIndex({m: 1}, function() {});
        common.drillDb.collection('drill_event' + appId).ensureIndex({w: 1}, function() {});
        common.drillDb.collection('drill_event' + appId).ensureIndex({h: 1}, function() {});
    });

    plugins.register("/i/apps/delete", function(ob) {
        var appId = ob.appId;
        common.drillDb.collection('drill_meta' + appId).remove({'_id': 'meta_up'}, function() {});
        deleteDrill(appId);
    });

    plugins.register("/i/apps/reset", function(ob) {
        var appId = ob.appId;
        common.drillDb.collection('drill_meta' + appId).remove({'_id': 'meta_up'}, function() {});
        deleteDrill(appId);
    });

    plugins.register("/i/apps/clear_all", function(ob) {
        var appId = ob.appId;
        common.drillDb.collection('drill_meta' + appId).remove({'_id': 'meta_up'}, function() {});
        deleteDrill(appId);
    });

    plugins.register("/i/apps/clear", function(ob) {
        var appId = ob.appId;
        common.drillDb.collection('drill_meta' + appId).remove({'_id': 'meta_up'}, function() {});
        deleteDrill(appId);
    });

    plugins.register("/plugins/drill", function(ob) {
        // let params = ob.params;
        // log.d("plugins/drill: " + params.app_id);
    });

    plugins.register("/session/duration", function(ob) {
        return new Promise(function(resolve) {
            var params = ob.params;
            var appUser = params.app_user;
            let sessionDur = params.qstring.session_duration;

            if (sessionDur) {
                let events = [];
                let event = {};
                event.key = "[CLY]_session";
                event.count = 1;
                event.sum = 0;
                event.dur = parseInt(sessionDur);
                events.push(event);
                processMeta(params, events, appUser, resolve);
                proSessionEvent(params, event, appUser, resolve);
            } else {
                resolve();
            }
        });
    })

    plugins.register("/session/end", function(ob){
        return new Promise(function(resolve) {
            var params = ob.params;
            var appUser = ob.dbAppUser;
            let sessionDur = params.qstring.session_duration;
            if (sessionDur) {
                sessionDur = parseInt(sessionDur);
            } else {
                resolve();
            }
            let collectionName = "drill_events" + crypto.createHash('sha1').update("[CLY]_session" + params.app_id).digest('hex');
            let update = {'$set': {}};
            
            common.drillDb.collection(collectionName).findOne({'did': params.qstring.device_id, 'uid': appUser.uid}, {_id: 1, dur: 1}, function(err, result) {
                if (!err && result) {
                    update.$set['dur'] = result.dur + sessionDur;
                    common.drillDb.collection(collectionName).update({'_id': result._id}, update, {'upsert': true}, function() {});
                }
                resolve();
            });
            
        });
    });

    /**
    * Process segments from params
    * @param {params} params - params object
    * @param {array} omitted_segments - array of segments to omit
    * @param {function} done - callback function to call when done processing
    **/
    function processMeta(params, appEvents, appUser, done) {
        // var forbiddenSegValues = [];
        // for (let i = 0; i < 32; i++) {
        //     forbiddenSegValues.push(i + "");
        // }
        let metaToFetch = {};
        let incomingEvents = [];
        for (let i = 0; i < appEvents.length; i++) {
            var currEvent = appEvents[i];
                shortEventName = "";
                metaCollectionName = "";

            if (!currEvent.key || !currEvent.count || !common.isNumber(currEvent.count) ||
                (currEvent.key.indexOf('[CLY]_') === 0 && plugins.internalDrillEvents.indexOf(currEvent.key) === -1)) {
                log.d("ignore meta: " + currEvent.key);
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

                    let tmpSegval = currEvent.segmentation[segKey] + "";

                    if (tmpSegval === "") {
                        continue;
                    }

                    // Mongodb field names can't start with $ or contain .
                    tmpSegVal = tmpSegval.replace(/^\$/, "").replace(/\./g, ":");
                    // tmpSegval = common.convertToType(tmpSegval);

                    // if (forbiddenSegValues.indexOf(tmpSegval) !== -1) {
                    //     tmpSegval = "[CLY]" + tmpSegVal;
                    // }
                    let type = 's';
                    if ('[CLY]_view' === shortEventName) {
                        if (segKey === 'bounce' || segKey === 'exit' || segKey === 'name' || segKey === 'segment'
                            || segKey === 'start') {
                            type = 'l';
                        } else if (segKey === 'visit') {
                            type = 'n';
                        }
                    } else if ('[CLY]_action' === shortEventName) {
                        if (segKey === 'domain' || segKey === 'type' || segKey === 'view') {
                            type = 'l';
                        } else if (segKey === 'height' || segKey === 'width' || segKey === 'x' || segKey === 'y') {
                            type = 'n';
                        }
                    } else if ('[CLY]_start_rating' === shortEventName){
                        if (segKey === 'platform') {
                            type = 'l';
                        } else if (segKey === 'app_version' || segKey === 'rating') {
                            type = 'n';
                        }
                    } else if ('[CLY]_crashes' === shortEventName) {
                        if (segKey === 'app_version' || segKey === 'background' || segKey === 'cpu' || segKey === 'muted' 
                            || segKey === 'nonfatal' || segKey === 'online' || segKey === 'opengl' || segKey === 'orientation' 
                            || segKey === 'os' || segKey === 'root' || segKey === 'signal') {
                            type = 'l';
                        } else if (segKey === 'bat_current' || segKey === 'bat_total' || segKey === 'chartboost' 
                            || segKey === 'disk_current' || segKey === 'disk_total' || segKey === 'ram_current' 
                            || segKey === 'ram_total' || segKey === 'run' || segKey === 'gideros') {
                            type = 'n';
                        }
                    } 
                    // else {
                        // if (common.isNumber(tmpSegval)) {
                        //     type = 'n';
                        // } else if (typeof tmpSegval === 'boolean') {
                        //     type = 'l'
                        // }
                    // }

                    metaToFetch[j] = {
                        eventName: shortEventName,
                        key: segKey,
                        value: tmpSegval,
                        type: type
                    };
                    j++;
                }
            }
            common.arrayAddUniq(incomingEvents, shortEventName);

            let id = "meta_" + crypto.createHash('sha1').update(shortEventName + params.app_id).digest('hex');
            let drill_meta = {'$set': {}};
            // drill_meta.$set['up'] = appUser;
            drill_meta.$set['type'] = 'e';
            drill_meta.$set['app_id'] = params.app_id;
            drill_meta.$set['e'] = shortEventName;
            common.drillDb.collection("drill_meta" + params.app_id).update({'_id': id}, drill_meta, {'upsert': true}, function() {});
        }
        
        if (Object.keys(metaToFetch).length == 0) {
            done();
            return;
        }

        async.map(Object.keys(metaToFetch), fetchEventMeta, function(err, eventMetaDocs) {
            for(let i = 0; i < eventMetaDocs.length; i++) {
                let meta = eventMetaDocs[i];
                if (meta) {
                    if ('s' === meta.type) { // string's meta is null
                        meta = {};
                        // meta.values = [metaToFetch[i].value];
                    } else {
                        if (!meta.values) {
                            meta.values = [];
                        }
                        common.arrayAddUniq(meta.values, metaToFetch[i].value);
                    }
                } else {
                    meta = {};
                    // meta.values = [metaToFetch[i].value];
                }
                meta.type = metaToFetch[i].type;
                let id = "meta_" + crypto.createHash('sha1').update(metaToFetch[i].eventName + params.app_id).digest('hex');
                let update = {'$set': {}};
                update.$set['sg.' + metaToFetch[i].key] = meta;
                common.drillDb.collection("drill_meta" + params.app_id).update({'_id': id}, update, {'upsert': true}, function() {});
            }
            processMetaUp(appUser, params.app_id);
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
                callback(null, result);
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
            // forbiddenSegValues = [],
            eventCollectionName = {};

        // for (let i = 0; i < 32; i++) {
        //     forbiddenSegValues.push(i + "");
        // }

        for (let i = 0; i < appEvents.length; i++) {
            var currEvent = appEvents[i];
            tmpEventObj = {};

            // Key and count fields are required
            if (!currEvent.key || !currEvent.count || !common.isNumber(currEvent.count) || 
                    (currEvent.key.indexOf('[CLY]_') === 0 && plugins.internalDrillEvents.indexOf(currEvent.key) === -1)) {
                log.d("ignore events: " + currEvent.key);
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

            // if (appUser.uid) {
                // tmpEventObj[common.dbUserMap.user_id] = appUser.uid;
                // delete appUser.uid;
                // delete appUser._id;
            // }

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
            if (currEvent.segmentation) {
                for (var segKey in currEvent.segmentation) {
                    //check if segment should be ommited
                    if (plugins.internalOmitSegments[currEvent.key] && Array.isArray(plugins.internalOmitSegments[currEvent.key]) && 
                            plugins.internalOmitSegments[currEvent.key].indexOf(segKey) !== -1) {
                        continue;
                    }

                    let tmpSegval = currEvent.segmentation[segKey] + "";

                    if (tmpSegval === "") {
                        continue;
                    }

                    // Mongodb field names can't start with $ or contain .
                    tmpSegVal = tmpSegval.replace(/^\$/, "").replace(/\./g, ":");
                    // tmpSegval = common.convertToType(tmpSegval);

                    // if (forbiddenSegValues.indexOf(tmpSegval) !== -1) {
                    //     tmpSegval = "[CLY]" + tmpSegVal;
                    // }

                    currEvent.segmentation[segKey] = tmpSegval;
                }

                tmpEventObj[common.dbEventMap.segmentations] = currEvent.segmentation;
            }
            if (appUser._id) {
                delete appUser._id;
            }
            tmpEventObj.up = appUser;
            tmpEventObj[common.dbUserMap.user_id] = appUser.uid;

            tmpEventObj.coll = eventCollectionName;
            tmpEventObj.cd = new Date();
            tmpEventColl.push(tmpEventObj) ;
        }

        for(let i = 0; i < tmpEventColl.length; i++) {
            var collectionName = tmpEventColl[i].coll;
            delete tmpEventColl[i].coll;
            // common.drillDb.collection(collectionName).update({'_id': params.app_id}, {$set: tmpEventColl[i]}, {'upsert': true}, function() {});
            common.drillDb.collection(collectionName).insert(tmpEventColl[i], function(){});
        }
        done();
    }

    function processMetaUp(appUser, appId) {
        let id = "meta_up";
        let update = {'$set': {}};
        update.$set['app_id'] = appId;
        update.$set['type'] = 'up';

        async.map(Object.keys(appUser), fetchUpItem, function(err, userMetaDocs) {
            for(let i = 0; i < userMetaDocs.length; i++) {
                let meta = userMetaDocs[i];
                let key = meta.key;
                if (common.dbUserMap.first_seen === key || common.dbUserMap.last_seen === key) {
                    meta.type = 'd'
                } else if (common.dbUserMap.app_version === key || common.dbUserMap.carrier === key 
                    || common.dbUserMap.country_code === key || common.dbUserMap.device === key || 'dnst' === key 
                    || 'dow' === key || 'gender' === key || 'hour' === key || 'la' === key || common.dbUserMap.platform === key 
                    || common.dbUserMap.platform_version === key || common.dbUserMap.resolution === key || 'src' === key
                    || 'lv' === key) {
                    meta.type = 'l'
                    if (meta.values) {
                        if (!meta.values) {
                            meta.values = [];
                        }
                        common.arrayAddUniq(meta.values, appUser[key]);
                    } else {
                        meta.values = [appUser[key]];
                    }
                } else if ('phone' === key || 'email' === key || 'name' === key || 'organization' === key || 'username' === key) {
                    meta.type = 's'
                } else if (common.dbUserMap.city === key || common.dbUserMap.region === key) {
                    meta.type = 'bl'
                } else {
                    meta.type = 'n'
                }
                //TODO: CMP, CUSTOM property handle
                update.$set['up.' + key] = meta;
                common.drillDb.collection("drill_meta" + appId).update({'_id': id}, update, {'upsert': true}, function() {});
                delete meta.key;
            }
        });
        
        /**
        * Fetch user properties item
        * @param {string} key - key to of up
        * @param {function} callback - for result
        **/
        function fetchUpItem(key, callback) {
            let coll = "drill_meta" + appId;
            let metaId = "meta_up";
            let projection = {_id: 0, ['up.' + key] : 1};
            common.drillDb.collection(coll).findOne({'_id': metaId}, projection, function(err, meta) {
                let result = {};
                if (meta && meta.up && meta.up[key]) {
                    result = meta.up[key];
                }
                result.key = key;
                callback(null, result);
            });
        }
    }

    /**
    * Process [CLY]_session event from params
    * @param {params} params - params object
    * @param {event} event- existing event keys
    * @param {function} done - callback function to call when done processing
    **/
    function proSessionEvent(params, event, appUser, done) {
        var tmpEventObj = {};

        // Create new collection name for the event
        let eventCollectionName = "drill_events" + crypto.createHash('sha1').update(event.key + params.app_id).digest('hex');

        if (params.qstring.device_id) {
            tmpEventObj[common.dbUserMap.device_id] = params.qstring.device_id;
        }

        if (appUser.uid) {
            tmpEventObj[common.dbUserMap.user_id] = appUser.uid;
            delete appUser._id;
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

        if (event.sum && common.isNumber(event.sum)) {
            event.sum = parseFloat(parseFloat(event.sum).toFixed(5));
            tmpEventObj[common.dbEventMap.sum] = event.sum;
        }

        if (event.dur && common.isNumber(event.dur)) {
            event.dur = parseFloat(event.dur);
            tmpEventObj[common.dbMap.dur] = event.dur;
        }
        
        tmpEventObj[common.dbEventMap.count] = event.count;

        tmpEventObj.up = appUser;
        tmpEventObj.cd = new Date();
        common.drillDb.collection(eventCollectionName).findOne({'did': params.qstring.device_id, 'uid': appUser.uid}, {_id: 1, dur: 1, s: 1, c: 1}, function(err, result) {
            if (!err) {
                if (result) {
                    tmpEventObj.dur = result.dur + tmpEventObj.dur;
                    common.drillDb.collection(eventCollectionName).update({'_id': result._id}, {$set: tmpEventObj}, {'upsert': true}, function(){});
                } else {
                    common.drillDb.collection(eventCollectionName).insert(tmpEventObj, function(){});
                }
            }
        });        
        done();
    }


    function processCMP(key, callback) {

    }

    function processCustom(key, callback) {
        
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

    /**
    * Deletes all app's drill events & meta
    **/
    function deleteDrill(appId) {
        common.db.collection('events').findOne({'_id': common.db.ObjectID(appId)}, function(err, events) {
            if (!err && events && events.list) {

                common.arrayAddUniq(events.list, plugins.internalDrillEvents);
                for (var i = 0; i < events.list.length; i++) {
                    var collectionNameWoPrefix = crypto.createHash('sha1').update(events.list[i] + appId).digest('hex');
                    common.drillDb.collection("drill_events" + collectionNameWoPrefix).drop(function() {});
                    common.drillDb.collection('drill_meta' + appId).remove({'_id': "meta_" + collectionNameWoPrefix}, function() {});
                }
            }
        });
    }

}(plugin));

module.exports = plugin;