(function(countlyFunnel, $, undefined) {

    //Private Properties
    var _activeFunnels = [],
        _activeFunnel = "",
        _activeFunnelData = {},
        _filter = {},
        _activeAppId = 0,
        _activeAppKey = 0,
        _initialized = false,
        _funnelMaps = {},
        _funnelViewType = 1,
        _funnel_id = null;

    //Public Methods
    countlyFunnel.initialize = function(task_id, funnel_id) {
		if(!_initialized){
			_activeAppKey = countlyCommon.ACTIVE_APP_KEY;
            _initialized = true;
		}
		else if(_activeAppKey != countlyCommon.ACTIVE_APP_KEY){
			countlyFunnel.reset();
		}
        return $.when(countlyFunnel.initFunnels(funnel_id)).then(
            function () {
                if (countlyFunnel.getFunnels().length) {
                    return countlyFunnel.initCurrentFunnel(task_id);
                } else {
                    return true;
                }
            }
        );
    };

    countlyFunnel.initCurrentFunnel = function(task_id) {
        _activeAppId = countlyCommon.ACTIVE_APP_ID;

        if (!countlyCommon.DEBUG) {
            _activeAppKey = countlyCommon.ACTIVE_APP_KEY;
            _initialized = true;

            var period = countlyCommon.getPeriod();
            if (Object.prototype.toString.call(period) === '[object Array]'){
                period = JSON.stringify(period);
            }
            
            if(task_id){
                return $.when(countlyTaskManager.fetchResult(task_id, function(json){
                    countlyFunnel.setActiveFunnel(JSON.parse(json.meta)._id);
                    _activeFunnelData = json.data;
                    _filter = json.request.json.filter
                })).then(function() {
                    var funnelData = countlyFunnel.getFunnelData(); 
                    if (funnelData && typeof countlySegmentation != "undefined" && funnelData.steps && funnelData.steps[0] && funnelData.steps[0].key) {
                        countlySegmentation.reset();
                        return countlySegmentation.initialize('[CLY]_session');
                    } else {
                        return true;
                    }
                }, function(){return $.when(false);});
            }
            else{

                return $.when($.ajax({
                    type: "GET",
                    url: countlyCommon.API_PARTS.data.r,
                    data: {
                        "app_id" : countlyCommon.ACTIVE_APP_ID,
                        "method" : "funnel",
                        "funnel": _activeFunnel,
                        "filter": JSON.stringify(_filter),
                        "period": period
                    },
                    dataType: "json",
                    success: function(json) {
                        if(json.task_id){
                            app.recordEvent({
                                "key": "move-to-report-manager",
                                "count": 1,
                                "segmentation": {type: "funnels"}
                            });
                            countlyTaskManager.monitor(json.task_id);
                            _activeFunnelData = {steps:[], total_users:0, success_users:0, success_rate:0};
                        }
                        else{
                            _activeFunnelData = json;
                        }
                    }
                })).then(function() {
                    var funnelData = countlyFunnel.getFunnelData();
    
                    if (funnelData && typeof countlySegmentation != "undefined" && funnelData.steps && funnelData.steps[0] && funnelData.steps[0].key) {
                        countlySegmentation.reset();
                        return countlySegmentation.initialize('[CLY]_session');
                    } else {
                        return true;
                    }
                }, function(){return $.when(false);});
            }

        } else {
            _activeFunnels = {};
            return true;
        }
    };

    countlyFunnel.initFunnels = function (funnel_id) {
        if (!countlyCommon.DEBUG) {
            return $.ajax({
                type:"GET",
                url:countlyCommon.API_PARTS.data.r,
                data:{
                    "app_id": countlyCommon.ACTIVE_APP_ID,
                    "method": "get_funnels"
                },
                dataType:"json",
                success:function (json) {
                    _activeFunnels = json;
                    
                    if (funnel_id) {
                        var funnel = _activeFunnels.filter(function (item) { return item._id === funnel_id })[0];
                        if(funnel)
                            countlyFunnel.setActiveFunnel(funnel_id);
                    }

                    if (!_activeFunnel && countlyFunnel.getFunnels()[0]) {
                        _activeFunnel = countlyFunnel.getFunnels()[0]._id;
                    }
                }
            });
        } else {
            _activeFunnels = {};
            return true;
        }
    };

    countlyFunnel.reset = function () {
        _activeFunnels = [];
        _activeFunnel = "";
        _activeFunnelData = {};
        _filter = {};
        _activeAppId = 0;
        _activeAppKey = 0;
        _initialized = false;
    };

    countlyFunnel.getActiveFunnel = function () {
        return _activeFunnel;
    };

    countlyFunnel.getActiveFunnelName = function () {
        var funnelIds = _.pluck(_activeFunnels, "_id");

        if (funnelIds.indexOf(_activeFunnel) !== -1) {
            return _activeFunnels[funnelIds.indexOf(_activeFunnel)].name;
        } else {
            return "";
        }
    };

    countlyFunnel.getActiveFunnelDesc = function () {
        var funnelIds = _.pluck(_activeFunnels, "_id");
        if (funnelIds.indexOf(_activeFunnel) !== -1) {
            return _activeFunnels[funnelIds.indexOf(_activeFunnel)].description || "";
        } else {
            return "";
        }
    };

    countlyFunnel.setActiveFunnel = function (activeFunnel, callback) {
        var persistData = {};
        persistData["activeFunnel_" + countlyCommon.ACTIVE_APP_ID] = activeFunnel
        countlyCommon.setPersistentSettings(persistData);
        for (var i = 0; i < _activeFunnels.length; i++) {
            if (_activeFunnels[i]._id == activeFunnel) {
                _activeFunnels[i].is_active = true;
            } else {
                delete _activeFunnels[i].is_active;
            }
        } 

        _activeFunnel = activeFunnel;

        if (callback) {
            $.when(countlyFunnel.initialize()).then(callback);
        }
    };

    countlyFunnel.setFilter = function (filterObj, callback) {
        _filter = filterObj;

        if (callback) {
            $.when(countlyFunnel.initialize()).then(callback);
        }
    };

    countlyFunnel.getFilter = function () {
        return _filter;
    }

    countlyFunnel.getFunnels = function() {
        var funnelIds = _.pluck(_activeFunnels, "_id");

        if (funnelIds.indexOf(_activeFunnel) !== -1) {
            _activeFunnels[funnelIds.indexOf(_activeFunnel)].is_active = true;
        }

        return _.sortBy(_activeFunnels, 'order');
    };

    countlyFunnel.getFunnelData = function() {
        if (_activeFunnelData && _activeFunnelData.steps && _activeFunnelData.steps.length) {
            for (var i = 0; i < _activeFunnelData.steps.length; i++) {
                _activeFunnelData.steps[i].key = _activeFunnelData.steps[i].step;
                _activeFunnelData.steps[i].step = countlyEvent.getEventLongName(_activeFunnelData.steps[i].step);
            }
        }

        return _activeFunnelData;
    };
    
    countlyFunnel.getRequestData = function() {
        var period = countlyCommon.getPeriod();
        if (Object.prototype.toString.call(period) === '[object Array]'){
            period = JSON.stringify(period);
        }
        return {
                    "app_id" : countlyCommon.ACTIVE_APP_ID,
                    "method" : "funnel",
                    "funnel": _activeFunnel,
                    "filter": JSON.stringify(_filter),
                    "period": period
                };
    };

    countlyFunnel.deleteFunnel = function(funnelId) {
        var funnelIds = _.pluck(_activeFunnels, "_id");

        if (funnelIds.indexOf(funnelId) !== -1) {
            delete _activeFunnels[funnelIds.indexOf(funnelId)];
        }

        _activeFunnels = _.compact(_activeFunnels);
    };

    countlyFunnel.setFunnels = function(funnelMap) {
        for (var funnelId in funnelMap) {
            for (var i = 0; i < _activeFunnels.length; i++) {
                if (_activeFunnels[i]._id == funnelId) {
                    if (funnelMap[funnelId].name) {
                        _activeFunnels[i].name = funnelMap[funnelId].name;
                    }

                    _activeFunnels[i].description = funnelMap[funnelId].description;
                    _activeFunnels[i].order = funnelMap[funnelId].order;
                    try{
                        _activeFunnels[i].steps = JSON.parse(funnelMap[funnelId].steps);
                    }
                    catch(ex){}
                    try{
                        _activeFunnels[i].queries = JSON.parse(funnelMap[funnelId].queries);
                    }
                    catch(ex){}
                    try{
                        _activeFunnels[i].queryTexts = JSON.parse(funnelMap[funnelId].queryTexts);
                    }
                    catch(ex){}
                    break;
                }
            }
        }
    };
    countlyFunnel.createFunnel = function (funnel, callback) {
        $.ajax({
            type: "GET",
            url: countlyGlobal["path"] + "/i/funnels/add",
            dataType: "json",
            data: {
                app_id: countlyCommon.ACTIVE_APP_ID,
                funnel_name: funnel.name,
                funnel_desc: funnel.description,
                steps: JSON.stringify(funnel.steps),
                queries: JSON.stringify(funnel.queries),
                queryTexts : JSON.stringify(funnel.queryTexts)
            },
            success: function (result) {
                callback(null, result, false);
                var segmentation = {};
                segmentation.step_count = funnel.steps.length;
                for(var i=0;i<funnel.steps.length;i++){
                    var step = funnel.steps[i];
                    if (!step){
                        return;
                    }
                    if (step === "[CLY]_view") {
                        segmentation.contains_view = true;   
                        break;
                    } 
                };
                for(var i=0;i<funnel.queries.length;i++){
                    var query = funnel.queries[i];
                    if(query && Object.keys(query).length>0){
                        segmentation.contains_segments = true;
                        break;
                    }
                };
                app.recordEvent({
                    "key": "funnel-create",
                    "count": 1,
                    "segmentation": segmentation
                });
            },
            error: function (result) {
                callback(result, null, false);
            }
        });
    };

    countlyFunnel.saveFunnel = function (funnel, callback) {
        var funnelMap = {};

        funnelMap[funnel.id] = {
            app_id: countlyCommon.ACTIVE_APP_ID,
            api_key: countlyGlobal.member.api_key,
            funnel_name: funnel.name,
            funnel_desc: funnel.description,
            steps: JSON.stringify(funnel.steps),
            queries: JSON.stringify(funnel.queries),
            queryTexts : JSON.stringify(funnel.queryTexts)
        }
        
        $.ajax({
            type: "GET",
            url: countlyGlobal["path"] + "/i/funnels/edit",
            data: {
                "app_id": countlyCommon.ACTIVE_APP_ID,
                "funnel_map": JSON.stringify(funnelMap)
            },
            dataType: "json",
            success: function (result) {
                callback(null, result, true, funnelMap, funnel.id);
            },
            error: function (result) {
                callback(result, null, true, funnelMap, funnel.id);
            }
        });
    };

    countlyFunnel.getFunnelsForApps = function(appIds, callback) {
        if (!appIds || appIds.length == 0) {
            callback([]);
            return;
        }

        var requests = [],
            results = [];

        for (var i = 0; i < appIds.length; i++) {
            requests.push(getFunnelsDfd(appIds[i], results));
        }

        $.when.apply(null, requests).done(function() {
            var ret = [];

            results = [].concat.apply([], results);

            for (var i = 0; i < results.length; i++) {
                extractFunnels(results[i], ret);
            }

            callback(ret);
        });

        function extractFunnels(data, returnArray) {
            var funnelData = (_.isArray(data))? data[0] : data;

            if (funnelData && funnelData.data) {
                for (var i = 0; i < funnelData.data.length; i++) {
                    var eventNamePostfix = (appIds.length > 1)? " (" + countlyDashboards.getAppName(funnelData.app_id) + ")" : "";

                    returnArray.push({
                        value: funnelData.app_id + "***" + funnelData.data[i]._id,
                        name: funnelData.data[i].name + eventNamePostfix
                    });
                }
            }
        }
    };
 
    countlyFunnel.getFunnelNameDfd = function(funnelId, results) {
        var dfd = jQuery.Deferred();

        countlyFunnel.getFunnelName(funnelId, function(funnelName) {
            results[funnelId] = funnelName;
            dfd.resolve();
        });

        return dfd.promise();
    };

    countlyFunnel.getFunnelName = function(funnelId, callback) {
        var funnelKey = funnelId.split("***")[1],
            appId = funnelId.split("***")[0],
            results = [];

        $.when(getFunnelsDfd(appId, results)).then(function() {
            var ret = [];
            
            results = [].concat.apply([], results);

            var funnel = results[0].data.filter(function(funnel){
                return funnel._id == funnelKey
            })

            callback(funnel[0] ? funnel[0].name : "");
        });
    };

    Object.defineProperty(countlyFunnel, 'funnelViewType', {
        get: function(){
            return _funnelViewType;
        },
        set: function(value){
            _funnelViewType = value;
        }
    })

    function getFunnelsDfd(appId, results) {
        var dfd = jQuery.Deferred();

        if (_funnelMaps[appId]) {
            var result = {
                app_id: appId,
                data: _funnelMaps[appId]
            }
            results.push(result);
            dfd.resolve();
        } else {
            $.ajax({
                type:"GET",
                url:countlyCommon.API_PARTS.data.r,
                data:{
                    "app_id": appId,
                    "method": "get_funnels",
                    "throtleRequest": (Math.random()).toFixed(2) //Random parameter so that the request is not throtelled
                },
                dataType:"json",
                success:function (data) {
                    data = data || [];

                    if(data && data.length){
                        _funnelMaps[appId] = data;                        
                    }
                    
                    var result = {
                        app_id : appId,
                        data : data
                    }

                    results.push(result);
                    dfd.resolve();
                }
            });
        }

        return dfd.promise();
    }

    countlyFunnel.clearFunnelsCache = function(){
        _funnelMaps = {};
    }

}(window.countlyFunnel = window.countlyFunnel || {}, jQuery));