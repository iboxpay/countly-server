(function (countlySegmentation , $, undefined) {

    var _segmentationDb = [],
        _segmentationDbMeta = {},
        _segmentationMap = {},
        _activeAppKey = {},
        _queryObject = {},
        _periodObj = {},
        _commonInstance = undefined,
        _projectionKey = "",
        _bucket = "",
        _event = "",
        _hasTask = false,
        _filterValues = {},
        _filterNames = {},
        _weekDays = [],
        _drillMaps = {},
        //case insensitive sort
        _sortFilter = function(a,b) {
            if(typeof a == "string" && typeof b == "string"){
                a = a.toLowerCase();
                b = b.toLowerCase();
            }
            if( a == b) return 0;
            if( a > b) return 1;
            return -1;
        };

    var regexNotAllowed = {"d": true, "up.d": true, "pv": true, "up.pv": true,
      "dnst":true, "up.dnst": true, "brwv": true, "up.brwv": true, "up.cc":true, "cc":true,
      "la": true, "up.la": true,  "sg.crash": true, "chr": true, "up.dow":true, "dow":true,
      "up.hour":true, "hour":true, "sg.app_version":true
    }

    countlySegmentation.disableRegex = function(fieldName){
        regexNotAllowed[fieldName] = true;
    }

    countlySegmentation.isFieldRegexable = function(fieldName, fieldType){
        if(fieldType === "s" || fieldType === "l" || fieldType === "bl") {
          return regexNotAllowed[fieldName] !== true;
        }
        return false;
    }

    countlySegmentation.initialize = function (eventName, bucket) {
        _activeAppKey = countlyCommon.ACTIVE_APP_KEY;
        _event = eventName;
        _bucket = bucket || "daily";
        _weekDays = ["", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
        return $.ajax({
            type:"GET",
            url:countlyCommon.API_PARTS.data.r,
            data:{
                "app_id":countlyCommon.ACTIVE_APP_ID,
                "event": _event,
                "method":"segmentation_meta"
            },
            dataType:"json",
            success:function (json) {
                _segmentationDbMeta = json;
                setMeta();
            }
        });

    };

    countlySegmentation.fetchAppSegmentationMeta = function (appId, eventName, bucket) {
        _event = eventName;
        _bucket = bucket;
        _weekDays = ["", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
        if(_segmentationMap[appId]){
            _segmentationDbMeta = _segmentationMap[appId];
            setMeta();
            return;
        }else{
            return $.ajax({
                type:"GET",
                url:countlyCommon.API_PARTS.data.r,
                data:{
                    "app_id": appId,
                    "event": _event,
                    "method":"segmentation_meta",
                    "timestamp": +new Date()
                },
                dataType:"json",
                success:function (json) {
                    _segmentationDbMeta = json;
                    setMeta();
                    _segmentationMap[appId] = json;
                }
            });
        }
    };

    countlySegmentation.reset = function() {
        _segmentationDb = [];
        _segmentationDbMeta = {};
        _activeAppKey = {};
        _queryObject = {};
        _periodObj = {};
        _projectionKey = "";
        _bucket = "";
        _event = "";
        _filterValues = {};
    };

    countlySegmentation.db = function () {
        return {dataSet:_segmentationDb , meta:_segmentationDbMeta};
    };

    countlySegmentation.setQueryObject = function(query, projection) {
        _queryObject = query;
        _projectionKey = projection;
    };

    countlySegmentation.getProjectionSignature = function(key){
      if (key === undefined) {
        key = _projectionKey;
      }

      if (Array.isArray(key)){
        return "[" + key.map(function(v){
          return '"' + v + '"';
        }).join(',') + "]";
      }
      return key;
    }

    countlySegmentation.clearBucket = function(param) {
        _bucket = "";
    };

    countlySegmentation.setBucket = function(param) {
        if (param == "daily" || param == "weekly" || param == "monthly" || param == "hourly"){
            _bucket = param;
        }
    };

    countlySegmentation.getBucket = function(param) {
        return _bucket;
    };

    countlySegmentation.getFilters = function() {
        var segmentationDbMetaWithIds = [];

        if (_segmentationDbMeta && _segmentationDbMeta.sg) {
            if(_segmentationDbMeta.e == "[CLY]_crash")
                segmentationDbMetaWithIds.push({ name:jQuery.i18n.map["drill.crash-segments"]});
            else if(_segmentationDbMeta.e == "[CLY]_view")
                segmentationDbMetaWithIds.push({ name:jQuery.i18n.map["drill.view-segments"]});
            else
                segmentationDbMetaWithIds.push({ name:jQuery.i18n.map["drill.event-segments"]});
            for (var segKey in _segmentationDbMeta.sg) {
                if(_segmentationDbMeta.e.indexOf("[CLY]_") == 0){
                    var name = (segKey.charAt(0).toUpperCase() + segKey.slice(1)).replace(/_/g, " ");
                    if(_segmentationDbMeta.e == "[CLY]_crash" && segKey == "crash"){
                        segmentationDbMetaWithIds.unshift({ id:"sg." + segKey, name:name, type:_segmentationDbMeta.sg[segKey].type });
                        segmentationDbMetaWithIds.unshift({ name:jQuery.i18n.map["drill.crash"]});
                    }
                    else{
                        if(_segmentationDbMeta.e == "[CLY]_view" && segKey == "name")
                            name = jQuery.i18n.map["drill.lv"];
                        if(_segmentationDbMeta.e == "[CLY]_view" && (segKey == "visit" || segKey == "segment"))
                            continue;
                        if(_segmentationDbMeta.e == "[CLY]_view" && (segKey == "start" || segKey == "exit" || segKey == "bounce"))
                            segmentationDbMetaWithIds.push({ id:"sg." + segKey, name:jQuery.i18n.map["drill.view."+segKey], type:"l" });
                        else
                            segmentationDbMetaWithIds.push({ id:"sg." + segKey, name:name, type:_segmentationDbMeta.sg[segKey].type });
                    }
                }
                else
                    segmentationDbMetaWithIds.push({ id:"sg." + segKey, name:segKey, type:_segmentationDbMeta.sg[segKey].type });
            }
        }

        if (_segmentationDbMeta && _segmentationDbMeta.e && _segmentationDbMeta.e != "[CLY]_session" && _segmentationDbMeta.e != "[CLY]_crash" && _segmentationDbMeta.e != "[CLY]_view") {
            segmentationDbMetaWithIds.push({ name:jQuery.i18n.map["drill.event-props"]});
            segmentationDbMetaWithIds.push({ id:"s", name:jQuery.i18n.map["drill.sum"], type:"n" });
            segmentationDbMetaWithIds.push({ id:"dur", name:jQuery.i18n.map["drill.dur"], type:"n" });
        }

        if (_segmentationDbMeta && _segmentationDbMeta.up) {
            segmentationDbMetaWithIds.push({ name:jQuery.i18n.map["drill.user-props"]});
            segmentationDbMetaWithIds.push({ id:"did", name:"ID", type:"s" });
            for (var segKey in _segmentationDbMeta.up) {
                var name = "";

                switch (segKey) {
                    default:
                        if(jQuery.i18n.map["drill."+segKey]){
                            name = jQuery.i18n.map["drill."+segKey];
                            if(countlyGlobal["apps"][countlyCommon.ACTIVE_APP_ID].type == "iot" && segKey == "sc"){
                                name = "";
                            }
                        }
                    break;
                }
                if(name != "")
                    segmentationDbMetaWithIds.push({ id:"up." + segKey, name:name, type:_segmentationDbMeta.up[segKey].type });
            }

            if(_segmentationDbMeta.e == "[CLY]_session" && app.activeView == app.drillView){
                segmentationDbMetaWithIds.push({ id:"sd", name:jQuery.i18n.map["drill.sd"], type:"n" });
            }

            if(_segmentationDbMeta.chr && typeof countlyCohorts !== "undefined"){
                segmentationDbMetaWithIds.push({ id:"chr", name:jQuery.i18n.map["cohorts.cohorts"], type:_segmentationDbMeta.chr.type});
            }
        }

        if (_segmentationDbMeta && _segmentationDbMeta.custom) {
            segmentationDbMetaWithIds.push({ name:jQuery.i18n.map["drill.user-custom"]});
            var limit = countlyGlobal.custom_property_limit || 20;
            for (var segKey in _segmentationDbMeta.custom) {
                limit--;
                if(limit < 0)
                    break;
                segmentationDbMetaWithIds.push({ id:"custom." + segKey, name:segKey, type:_segmentationDbMeta.custom[segKey].type });
            }
        }

        if (_segmentationDbMeta && _segmentationDbMeta.cmp && countlyGlobal["apps"][countlyCommon.ACTIVE_APP_ID].type != "iot") {
            segmentationDbMetaWithIds.push({ name:jQuery.i18n.map["drill.cmp-props"]});
            var limit = countlyGlobal.custom_property_limit || 20;
            var langs = {
                pl:jQuery.i18n.map["attribution.platform"],
                b:jQuery.i18n.map["attribution.browser"],
                cnty:jQuery.i18n.map["attribution.country"],
                l:jQuery.i18n.map["attribution.locale"],
                m:jQuery.i18n.map["attribution.mobile"]
            };
            segmentationDbMetaWithIds.push({ id:"cmp.c", name:jQuery.i18n.map["drill.cmp_c"], type:_segmentationDbMeta.cmp["c"].type });
            for (var segKey in _segmentationDbMeta.cmp) {
                limit--;
                if(limit < 0)
                    break;
                if(segKey != "n" && segKey != "c" && segKey != "_id" && segKey != "bv" && segKey != "ip" && segKey != "os" && segKey != "r" && segKey != "cty"){
                    segmentationDbMetaWithIds.push({ id:"cmp." + segKey, name:langs[segKey] || segKey, type:_segmentationDbMeta.cmp[segKey].type });
                }
            }
        }

        return segmentationDbMetaWithIds;
    };

    countlySegmentation.getFilterValues = function(filter) {
        var newValues = [];
        if(_event === "[CLY]_view"){
            if(filter == "sg.start" || filter == "sg.exit" || filter == "sg.bounce"){
                return [1];
            }
        }
        switch (filter) {
            case "up.src":
                if(typeof countlySources !== 'undefined'){
                    var arr = _filterValues[filter + ""] || [],
                        values = {},
                        newKeys = [],
                        group;
                    for (var i = 0; i < arr.length; i++) {
                        group = countlySources.getSourceName(arr[i]);
                        newKeys.push(group);
                        if(!values[group])
                            values[group] = [];
                        values[group].push(countlyCommon.encode(countlySources.getSourceName(arr[i], null, true)));
                    }
                    for(var key in values){
                        values[key].sort(_sortFilter);
                    }
                    newKeys.sort(_sortFilter);
                    newValues = {};
                    for(var i = 0; i < newKeys.length; i++){
                        newValues[newKeys[i]] = values[newKeys[i]];
                    }
                }
                else{
                    newValues = _filterValues[filter + ""] || [];
                }
                break;
            default:
                newValues = _filterValues[filter + ""] || [];
                break;
        }

        return newValues;
    };

    countlySegmentation.getFilterNames = function(filter) {
        if(_event.indexOf("[CLY]_") == 0){
            var values = _filterNames[filter + ""] || [];
            var newValues = [];
            for(var i = 0; i < values.length; i++){
                if(_event == "[CLY]_crash" && filter == "sg.crash" && countlyCrashes)
                    newValues.push(countlyCrashes.getCrashName(values[i]));
                else if(_event == "[CLY]_view" && (filter == "sg.start" || filter == "sg.exit" || filter == "sg.bounce")){
                    newValues.push("true");
                }
                else
                    newValues.push(values[i]);
            }
            return newValues;
        }
        return _filterNames[filter + ""] || [];
    };
    countlySegmentation.saveReportTask =  function(data, callback){
        var projectionKey = "";
        if (_projectionKey && _projectionKey.length > 0){
            projectionKey = JSON.stringify(_projectionKey);
        }
        var data = {
            "app_id":countlyCommon.ACTIVE_APP_ID,
            "event":_event,
            "method":"segmentation",
            "queryObject":JSON.stringify(_queryObject),
            "bucket": _bucket,
            "projectionKey": projectionKey,
            "save_report": true,
            "period_desc": data.period_desc,
            "period": countlyCommon.getPeriod(),
            "report_name": data.report_name,
            "report_desc": data.report_desc,
            "global": data.global,
            "autoRefresh": data.autoRefresh,
            "manually_create": true,
            "no_map": true,
        };
        if(data.period_desc){
            data.period = data.period_desc === 'today' ? 'hour' : data.period_desc;
            data.bucket = data.period_desc === 'today' ? 'hourly' : 'daily';
        }
        return $.ajax({
            type:"GET",
            url:countlyCommon.API_PARTS.data.r,
            data: data,
            dataType: "json",
            success:function (json) {
                if(json.task_id){
                    _hasTask = true;
                    // countlyTaskManager.monitor(json.task_id);
                }
                else{
                    _segmentationDb = json;
                }
                callback && callback(null, json);
            },
            error: function(){
                callback && callback(false, []);
            }
        });
    }
    countlySegmentation.getSegmentationData = function(task_id, limit) {
        _hasTask = false;
        var period = countlyCommon.getPeriod();
        if (Object.prototype.toString.call(period) === '[object Array]'){
            period = JSON.stringify(period);
        }

        if(task_id){
            var taskInfo = countlyTaskManager.getResult(task_id);
            // countlyCommon.setPeriod(taskInfo.request.json.period)
            _segmentationDb = taskInfo.data;
            return true;
        }
        else
            var data = {
                "app_id":countlyCommon.ACTIVE_APP_ID,
                "event":_event,
                "method":"segmentation",
                "queryObject":JSON.stringify(_queryObject),
                "period": period,
                "bucket": _bucket,
                "projectionKey": countlySegmentation.getProjectionSignature()
            };
            if (limit) {
              data.limit = limit;
            }
            return $.ajax({
                type:"GET",
                url:countlyCommon.API_PARTS.data.r,
                data: data,
                success:function (json) {
                    if(json.task_id){
                        app.recordEvent({
                            "key": "move-to-report-manager",
                            "count": 1,
                            "segmentation": {type: "drill"}
                        });
                        _hasTask = true;
                        countlyTaskManager.monitor(json.task_id);
                    }
                    else{
                        _segmentationDb = json;
                    }
                }
            });
    };

    countlySegmentation.hasTask = function(){
        return _hasTask;
    };

    countlySegmentation.setSegmentationData = function(data) {
        _segmentationDb = data;
    };

    countlySegmentation.getBigListMetaData = function(prop, search, callback) {

        var period = countlyCommon.getPeriod();
        if (Object.prototype.toString.call(period) === '[object Array]'){
            period = JSON.stringify(period);
        }
        if(search)
            search = countlySegmentation.formatToDbVal(prop,search);
        search = search ? search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') : search;
        return $.ajax({
            type:"GET",
            url:countlyCommon.API_PARTS.data.r,
            data:{
                "app_id":countlyCommon.ACTIVE_APP_ID,
                "event":_event,
                "method":"segmentation_big_meta",
                "prop":prop,
                "search":search || "",
                "period": period
            },
            dataType:"json",
            success:function (json) {
                var newValues = [];
                var newNames = [];

                switch (prop) {
                    case "up.src":
                        if(typeof countlySources !== 'undefined' && json && json.length){
                            var arr = json || [],
                                values = {},
                                newKeys = [],
                                group;
                            newNames = arr;
                            for (var i = 0; i < arr.length; i++) {
                                group = countlySources.getSourceName(arr[i]);
                                newKeys.push(group);
                                if(!values[group])
                                    values[group] = [];
                                values[group].push(countlyCommon.encode(countlySources.getSourceName(arr[i], null, true)));
                            }
                            for(var key in values){
                                values[key].sort(_sortFilter);
                            }
                            newKeys.sort(_sortFilter);
                            newValues = {};
                            for(var i = 0; i < newKeys.length; i++){
                                newValues[newKeys[i]] = values[newKeys[i]];
                            }
                        }
                        else{
                            newValues = json || [];
                            newNames = json || [];
                        }
                        break;
                    default:
                        newValues = json || [];
                        if(json && json.length){
                            newNames = getUserPropertyLongNames(prop, json);
                            for(var i = 0; i < newNames.length; i++){
                                if(_event == "[CLY]_crash" && prop == "sg.crash" && countlyCrashes)
                                    newNames[i] = countlyCrashes.getCrashName(newNames[i]);
                                else
                                    newNames[i] = newNames[i];
                            }
                        }
                        break;
                }

                callback(newValues, newNames);
            },
            error: function(){
                callback([], []);
            }
        });
    };

    countlySegmentation.getRequestData =  function(){
        var period = countlyCommon.getPeriod();
        if (Object.prototype.toString.call(period) === '[object Array]'){
            period = JSON.stringify(period);
        }
        return {
                "app_id":countlyCommon.ACTIVE_APP_ID,
                "event":_event,
                "method":"segmentation_users",
                "queryObject":JSON.stringify(_queryObject),
                "period": period,
                "bucket": _bucket,
                "projectionKey": countlySegmentation.getProjectionSignature()
            }
    };

    countlySegmentation.getSegmentationDP = function() {
        var common = _commonInstance || countlyCommon;
        _periodObj = common.periodObj;

        if (!_periodObj.currentPeriodArr) {
            var tmpDate = new Date();
            _periodObj.currentPeriodArr = [];

            if (common.getPeriod() == "month") {
                for (var i = 0; i < (tmpDate.getMonth() + 1); i++) {
                    var daysInMonth = moment().month(i).daysInMonth();

                    for (var j = 0; j < daysInMonth; j++) {
                        _periodObj.currentPeriodArr.push(_periodObj.activePeriod + "." + (i + 1) + "." + (j + 1));

                        // If current day of current month, just break
                        if ((i == tmpDate.getMonth()) && (j == (tmpDate.getDate() - 1))) {
                            break;
                        }
                    }
                }
            } else if(common.getPeriod() == "day") {
                for (var i = 0; i < tmpDate.getDate(); i++) {
                    _periodObj.currentPeriodArr.push(_periodObj.activePeriod + "." + (i + 1));
                }
            } else{
                _periodObj.currentPeriodArr.push(_periodObj.activePeriod);
            }
        }

        var chartDP = [],
            chartData = [];

        chartDP.push({data:[], label:jQuery.i18n.map["drill.times"]});
        chartDP.push({data:[], label:jQuery.i18n.map["drill.users"]});
        chartDP.push({data:[], label:jQuery.i18n.map["drill.times-users"]});
        chartDP.push({data:[], label:jQuery.i18n.map["drill.sum"]});
        chartDP.push({data:[], label:jQuery.i18n.map["drill.sum-users"]});
        chartDP.push({data:[], label:jQuery.i18n.map["drill.dur"]});
        chartDP.push({data:[], label:jQuery.i18n.map["drill.dur-users"]});

        var ticks = common.getTickObj(_bucket);

        if (_bucket == "daily") {

            for (var i = 0; i < _periodObj.numberOfDays; i++) {
                for (var j = 0; j < 2; j++) {
                    chartDP[j].data.push([]);
                    chartDP[j].data[chartDP[j].data.length-1][0] = i;
                    chartDP[j].data[chartDP[j].data.length-1][1] = 0;
                }

                chartDP[3].data.push([]);
                chartDP[3].data[chartDP[3].data.length-1][0] = i;
                chartDP[3].data[chartDP[3].data.length-1][1] = 0;

                chartDP[5].data.push([]);
                chartDP[5].data[chartDP[5].data.length-1][0] = i;
                chartDP[5].data[chartDP[5].data.length-1][1] = 0;

                chartData.push({ date:moment(_periodObj.currentPeriodArr[i], "YYYY.M.D").format("D MMM YYYY"), t:0, u:0, a:0, s:0, as:0, dur:0, adur:0});
            }

            for (var day in _segmentationDb.data) {
                var dayIndex = _periodObj.currentPeriodArr.indexOf(day);

                if (dayIndex !== -1) {
                    chartDP[0].data[dayIndex][1] = _segmentationDb.data[day].t;
                    chartDP[1].data[dayIndex][1] = _segmentationDb.data[day].u;
                    chartDP[3].data[dayIndex][1] = _segmentationDb.data[day].s;
                    chartDP[5].data[dayIndex][1] = _segmentationDb.data[day].dur;

                    chartData[dayIndex].t = _segmentationDb.data[day].t || 0;
                    chartData[dayIndex].u = _segmentationDb.data[day].u || 0;
                    chartData[dayIndex].s = _segmentationDb.data[day].s || 0;
                    chartData[dayIndex].dur = _segmentationDb.data[day].dur || 0;
                }
            }

        } else if (_bucket == "weekly") {
            var beginDate = moment(_periodObj.currentPeriodArr[0], "YYYY.M.D"),
                endDate =  moment(_periodObj.currentPeriodArr[_periodObj.currentPeriodArr.length -1], "YYYY.M.D"),
                beginWeek = beginDate.isoWeek(),
                endWeek = endDate.isoWeek();

                if(beginWeek == 53)
                    beginWeek = 1;
            // Add year difference to number of weeks
            endWeek += 52 * (endDate.year() - beginDate.year());
            for (var i = 0; i < (endWeek - beginWeek + 1); i++) {
                for (var j = 0; j < 2; j++) {
                    chartDP[j].data.push([]);
                    chartDP[j].data[chartDP[j].data.length-1][0] = i;
                    chartDP[j].data[chartDP[j].data.length-1][1] = 0;
                }

                chartDP[3].data.push([]);
                chartDP[3].data[chartDP[3].data.length-1][0] = i;
                chartDP[3].data[chartDP[3].data.length-1][1] = 0;

                chartDP[5].data.push([]);
                chartDP[5].data[chartDP[5].data.length-1][0] = i;
                chartDP[5].data[chartDP[5].data.length-1][1] = 0;

                chartData.push({ date: ticks.tickTexts[i], t:0, u:0, s:0, as:0, dur:0, adur:0});
            }

            for (var week in _segmentationDb.data) {
                var i = (52 * (parseInt(week.split(".")[0], 10) - beginDate.year())) + (parseInt(week.split("w")[1], 10) - beginWeek);

                chartDP[0].data[i][1] = _segmentationDb.data[week].t;
                chartDP[1].data[i][1] = _segmentationDb.data[week].u;
                chartDP[3].data[i][1] = _segmentationDb.data[week].s;
                chartDP[5].data[i][1] = _segmentationDb.data[week].dur;

                chartData[i].t = _segmentationDb.data[week].t || 0;
                chartData[i].u = _segmentationDb.data[week].u || 0;
                chartData[i].s = _segmentationDb.data[week].s || 0;
                chartData[i].dur = _segmentationDb.data[week].dur || 0;
            }

        } else if (_bucket == "monthly"){

            var beginDate = moment(_periodObj.currentPeriodArr[0], "YYYY.M.D"),
                endDate =  moment(_periodObj.currentPeriodArr[_periodObj.currentPeriodArr.length -1], "YYYY.M.D"),
                beginMonth = beginDate.month() + 1,
                endMonth = endDate.month() + 1;

            endMonth += 12 * (endDate.year() - beginDate.year());

            for (var i = 0 ; i < (endMonth - beginMonth + 1); i++) {
                for (var j = 0; j < 2; j++) {
                    chartDP[j].data.push([]);
                    chartDP[j].data[chartDP[j].data.length-1][0] = i;
                    chartDP[j].data[chartDP[j].data.length-1][1] = 0;
                }

                chartDP[3].data.push([]);
                chartDP[3].data[chartDP[3].data.length-1][0] = i;
                chartDP[3].data[chartDP[3].data.length-1][1] = 0;

                chartDP[5].data.push([]);
                chartDP[5].data[chartDP[5].data.length-1][0] = i;
                chartDP[5].data[chartDP[5].data.length-1][1] = 0;

                chartData.push({date:ticks.tickTexts[i], t:0, u:0, s:0, as:0, dur:0, adur:0});
            }

            for (var month in _segmentationDb.data) {
                var i = (12 * (parseInt(month.split(".")[0], 10) - beginDate.year())) + (parseInt(month.split("m")[1], 10) - beginMonth);

                if(chartDP[0].data[i]){
                    chartDP[0].data[i][1] = _segmentationDb.data[month].t;
                    chartDP[1].data[i][1] = _segmentationDb.data[month].u;
                    chartDP[3].data[i][1] = _segmentationDb.data[month].s;
                    chartDP[5].data[i][1] = _segmentationDb.data[month].dur;
                }

                if(chartData[i]){
                    chartData[i].t = _segmentationDb.data[month].t || 0;
                    chartData[i].u = _segmentationDb.data[month].u || 0;
                    chartData[i].s = _segmentationDb.data[month].s || 0;
                    chartData[i].dur = _segmentationDb.data[month].dur || 0;
                }
            }

        } else if (_bucket == "hourly") {

            var date = new Date(_periodObj.activePeriod);

            for (var i = 0; i < (24 * _periodObj.numberOfDays); i++) {
                for (var j = 0; j < 2; j++) {
                    chartDP[j].data.push([]);
                    chartDP[j].data[chartDP[j].data.length-1][0] = i;
                    chartDP[j].data[chartDP[j].data.length-1][1] = 0;
                }

                chartDP[3].data.push([]);
                chartDP[3].data[chartDP[3].data.length-1][0] = i;
                chartDP[3].data[chartDP[3].data.length-1][1] = 0;

                chartDP[5].data.push([]);
                chartDP[5].data[chartDP[5].data.length-1][0] = i;
                chartDP[5].data[chartDP[5].data.length-1][1] = 0;


                chartData.push({date:ticks.tickTexts[i], t:0, u:0, s:0, as:0, dur:0, adur:0});
            }

            var processedDays = [],
                // Received buckets needs to be sorted
                hourBuckets = _.map(_segmentationDb.data || [], function(val, key) { return key; }).sort();

            var dayCounter = 0;

            for (var j = 0; j < hourBuckets.length; j++) {
                var i = parseInt(hourBuckets[j].split("h")[1], 10);

                if (processedDays.indexOf(hourBuckets[j].split("h")[0]) === -1) {
                    processedDays.push(hourBuckets[j].split("h")[0]);
                    dayCounter = moment(hourBuckets[j].split(".h")[0], "YYYY.M.D").unix() - moment(_periodObj.currentPeriodArr[0], "YYYY.M.D").unix();
                    dayCounter = dayCounter / (60 * 60);
                }

                var hourIndex = i + dayCounter;

                if(chartDP[0].data[hourIndex]){
                    chartDP[0].data[hourIndex][1] = _segmentationDb.data[hourBuckets[j]].t;
                    chartDP[1].data[hourIndex][1] = _segmentationDb.data[hourBuckets[j]].u;
                    chartDP[3].data[hourIndex][1] = _segmentationDb.data[hourBuckets[j]].s;
                    chartDP[3].data[hourIndex][1] = _segmentationDb.data[hourBuckets[j]].dur;

                    chartData[hourIndex].t = _segmentationDb.data[hourBuckets[j]].t || 0;
                    chartData[hourIndex].u = _segmentationDb.data[hourBuckets[j]].u || 0;
                    chartData[hourIndex].s = _segmentationDb.data[hourBuckets[j]].s || 0;
                    chartData[hourIndex].dur = _segmentationDb.data[hourBuckets[j]].dur || 0;
                }
            }
        }

        for (var i = 0; i < chartDP[0].data.length; i++) {
            chartDP[2].data.push([i, safeDivision(chartDP[0].data[i][1], chartDP[1].data[i][1]) ]);
            chartData[i].a = safeDivision(chartData[i].t, chartData[i].u);

            chartDP[4].data.push([i, safeDivision(chartDP[3].data[i][1], chartDP[1].data[i][1]) ]);
            chartData[i].as = safeDivision(chartData[i].s, chartData[i].u);

            chartDP[6].data.push([i, safeDivision(chartDP[5].data[i][1], chartDP[1].data[i][1]) ]);
            chartData[i].adur = safeDivision(chartData[i].dur, chartData[i].u);
        }

        return {
            chartDP: {
                times:[chartDP[0]],
                users:[chartDP[1]],
                average:[chartDP[2]],
                sum:[chartDP[3]],
                sum_average:[chartDP[4]],
                dur:[chartDP[5]],
                dur_average:[chartDP[6]]
            },
            chartData:chartData
        };
    };

    countlySegmentation.getSegmentationDPWithProjection = function() {

        if (countlySegmentation.isHistogram()) {
            return countlySegmentation.getSegmentationDPWithHistogram();
        }

        var common = _commonInstance || countlyCommon;
        _periodObj = common.periodObj;

        if (!_periodObj.currentPeriodArr) {
            var tmpDate = new Date();
            _periodObj.currentPeriodArr = [];

            if (common.getPeriod() == "month") {
                for (var i = 0; i < (tmpDate.getMonth() + 1); i++) {
                    var daysInMonth = moment().month(i).daysInMonth();

                    for (var j = 0; j < daysInMonth; j++) {
                        _periodObj.currentPeriodArr.push(_periodObj.activePeriod + "." + (i + 1) + "." + (j + 1));

                        // If current day of current month, just break
                        if ((i == tmpDate.getMonth()) && (j == (tmpDate.getDate() - 1))) {
                            break;
                        }
                    }
                }
            } else if(common.getPeriod() == "day") {
                for (var i = 0; i < tmpDate.getDate(); i++) {
                    _periodObj.currentPeriodArr.push(_periodObj.activePeriod + "." + (i + 1));
                }
            } else{
                _periodObj.currentPeriodArr.push(_periodObj.activePeriod);
            }
        }

        var notFound = true,
            pieChartDP = {
                userDP:{dp:[]},
                totalDP:{dp:[]},
                sumDP:{dp:[]},
                durDP:{dp:[]}
            },
            pieChartDPTotal,
            pieChartDPUser,
            pieChartDPAvg,
            pieChartDPSum,
            pieChartDPSumAvg,
            pieChartDPDur,
            pieChartDPDurAvg,
            barChartDP = {
                dp:[{color:common.GRAPH_COLORS[1], data:[]}, {color:common.GRAPH_COLORS[0], data:[]}, {color:common.GRAPH_COLORS[2], data:[]}, {color:common.GRAPH_COLORS[3], data:[]}],
                ticks:[]
            },
            barChartDPUser,
            barChartDPTotal,
            barChartDPAvg,
            barChartDPSum,
            barChartDPSumAvg,
            barChartDPDur,
            barChartDPDurAvg,
            aggregatedChartData = [],
            chartDPUser = [],
            chartDPTotal = [],
            chartDPAvg = [],
            chartDPSum = [],
            chartDPSumAvg = [],
            chartDPDur = [],
            chartDPDurAvg = [],
            chartData = {},
            segmentIndices = {};

        barChartDP.dp[0].data.push([-1,null]);
        barChartDP.dp[1].data.push([-1,null]);
        barChartDP.dp[2].data.push([-1,null]);
        barChartDP.dp[3].data.push([-1,null]);
        barChartDP.ticks.push([-1,""]);
        barChartDP.ticks.push([_segmentationDb.meta.length,""]);

        var ticks = common.getTickObj(_bucket);

        for (var i = 0; i < _segmentationDb.meta.length; i++) {
            var currSegment = _segmentationDb.meta[i];

            segmentIndices[currSegment] = i;

            var segmentReadable = currSegment
            if (_segmentationDb[currSegment].keys ) {
              segmentReadable = _segmentationDb[currSegment].keys;
            }

            pieChartDP.userDP.dp.push({data:[], label:countlySegmentation.getMultiUserPropertyLongName(_projectionKey, segmentReadable)});
            pieChartDP.userDP.dp[i].data.push([0, _segmentationDb[currSegment].us]);


            pieChartDP.totalDP.dp.push({data:[],label:countlySegmentation.getMultiUserPropertyLongName(_projectionKey, segmentReadable)});
            pieChartDP.totalDP.dp[i].data.push([0, _segmentationDb[currSegment].t]);

            pieChartDP.sumDP.dp.push({data:[],label:countlySegmentation.getMultiUserPropertyLongName(_projectionKey, segmentReadable)});
            pieChartDP.sumDP.dp[i].data.push([0, _segmentationDb[currSegment].s]);

            pieChartDP.durDP.dp.push({data:[],label:countlySegmentation.getMultiUserPropertyLongName(_projectionKey, segmentReadable)});
            pieChartDP.durDP.dp[i].data.push([0, _segmentationDb[currSegment].dur]);

            barChartDP.dp[0].data.push([i, _segmentationDb[currSegment].us]);
            barChartDP.dp[1].data.push([i, _segmentationDb[currSegment].t]);
            barChartDP.dp[2].data.push([i, _segmentationDb[currSegment].s]);
            barChartDP.dp[3].data.push([i, _segmentationDb[currSegment].dur]);
            barChartDP.ticks.push([i, countlySegmentation.getMultiUserPropertyLongName(_projectionKey, segmentReadable)]);

            aggregatedChartData.push({
                curr_segment:countlySegmentation.getMultiUserPropertyLongName(_projectionKey, segmentReadable),
                u:_segmentationDb[currSegment].u,
                t:_segmentationDb[currSegment].t,
                a:safeDivision(_segmentationDb[currSegment].t, _segmentationDb[currSegment].us),
                s:_segmentationDb[currSegment].s,
                as:safeDivision(_segmentationDb[currSegment].s, _segmentationDb[currSegment].us),
                dur:_segmentationDb[currSegment].dur,
                adur:safeDivision(_segmentationDb[currSegment].dur, _segmentationDb[currSegment].us)
            });

            chartDPUser.push({data:[], label:countlySegmentation.getMultiUserPropertyLongName(_projectionKey, segmentReadable)});
            chartDPTotal.push({data:[], label:countlySegmentation.getMultiUserPropertyLongName(_projectionKey, segmentReadable)});
            chartDPSum.push({data:[], label:countlySegmentation.getMultiUserPropertyLongName(_projectionKey, segmentReadable)});
            chartDPDur.push({data:[], label:countlySegmentation.getMultiUserPropertyLongName(_projectionKey, segmentReadable)});

            chartData[currSegment] = [];
        }

        barChartDP.dp[0].data.push([_segmentationDb.meta.length,null]);
        barChartDP.dp[1].data.push([_segmentationDb.meta.length,null]);
        barChartDP.dp[2].data.push([_segmentationDb.meta.length,null]);
        barChartDP.dp[3].data.push([_segmentationDb.meta.length,null]);

        if (_bucket == "daily") {
            for (var i = 0 ; i < _periodObj.currentPeriodArr.length; i++) {
                for (var j = 0; j < _segmentationDb.meta.length; j++) {
                    chartDPUser[j].data.push([]);
                    chartDPTotal[j].data.push([]);
                    chartDPSum[j].data.push([]);
                    chartDPDur[j].data.push([]);

                    chartDPUser[j].data[chartDPUser[j].data.length-1][0] = i;
                    chartDPUser[j].data[chartDPUser[j].data.length-1][1] = 0;

                    chartDPTotal[j].data[chartDPTotal[j].data.length-1][0] = i;
                    chartDPTotal[j].data[chartDPTotal[j].data.length-1][1] = 0;

                    chartDPSum[j].data[chartDPSum[j].data.length-1][0] = i;
                    chartDPSum[j].data[chartDPSum[j].data.length-1][1] = 0;

                    chartDPDur[j].data[chartDPDur[j].data.length-1][0] = i;
                    chartDPDur[j].data[chartDPDur[j].data.length-1][1] = 0;

                    chartData[_segmentationDb.meta[j]].push({date:moment(_periodObj.currentPeriodArr[i], "YYYY.M.D").format("D MMM YYYY"), t:0, u:0, s:0, dur:0});
                }
            }

            for (var day in _segmentationDb.data) {
                var dayIndex = _periodObj.currentPeriodArr.indexOf(day);

                if (dayIndex !== -1) {
                    for (var segment in _segmentationDb.data[day]) {
                        chartDPUser[segmentIndices[segment]].data[dayIndex][1] = _segmentationDb.data[day][segment].u;
                        chartDPTotal[segmentIndices[segment]].data[dayIndex][1] = _segmentationDb.data[day][segment].t;
                        chartDPSum[segmentIndices[segment]].data[dayIndex][1] = _segmentationDb.data[day][segment].s;
                        chartDPDur[segmentIndices[segment]].data[dayIndex][1] = _segmentationDb.data[day][segment].dur;

                        chartData[segment][dayIndex].t = _segmentationDb.data[day][segment].t;
                        chartData[segment][dayIndex].u = _segmentationDb.data[day][segment].u;
                        chartData[segment][dayIndex].s = _segmentationDb.data[day][segment].s;
                        chartData[segment][dayIndex].dur = _segmentationDb.data[day][segment].dur;
                    }
                }
            }
        } else if (_bucket == "weekly") {
            var beginDate = moment(_periodObj.currentPeriodArr[0], "YYYY.M.D"),
                endDate =  moment(_periodObj.currentPeriodArr[_periodObj.currentPeriodArr.length -1], "YYYY.M.D"),
                beginWeek = beginDate.isoWeek(),
                endWeek = endDate.isoWeek();

                if(beginWeek == 53)
                    beginWeek = 1;
            // Add year difference to number of weeks
            endWeek += 52 * (endDate.year() - beginDate.year());

            for (var i = 0; i < (endWeek - beginWeek + 1); i++) {
                for (var j = 0; j < _segmentationDb.meta.length; j++) {
                    chartDPUser[j].data.push([]);
                    chartDPTotal[j].data.push([]);
                    chartDPSum[j].data.push([]);
                    chartDPDur[j].data.push([]);

                    chartDPUser[j].data[chartDPUser[j].data.length-1][0] = i;
                    chartDPUser[j].data[chartDPUser[j].data.length-1][1] = 0;
                    chartDPTotal[j].data[chartDPTotal[j].data.length-1][0] = i;
                    chartDPTotal[j].data[chartDPTotal[j].data.length-1][1] = 0;
                    chartDPSum[j].data[chartDPSum[j].data.length-1][0] = i;
                    chartDPSum[j].data[chartDPSum[j].data.length-1][1] = 0;
                    chartDPDur[j].data[chartDPDur[j].data.length-1][0] = i;
                    chartDPDur[j].data[chartDPDur[j].data.length-1][1] = 0;

                    chartData[_segmentationDb.meta[j]].push({date:ticks.tickTexts[i], t:0, u:0, s:0, dur:0});
                }
            }

            for (var week in _segmentationDb.data) {
                var i = (52 * (parseInt(week.split(".")[0], 10) - beginDate.year())) + (parseInt(week.split("w")[1], 10) - beginWeek);

                for (var segment in _segmentationDb.data[week]) {
                    chartDPUser[segmentIndices[segment]].data[i][1] = _segmentationDb.data[week][segment].u;
                    chartDPTotal[segmentIndices[segment]].data[i][1] = _segmentationDb.data[week][segment].t;
                    chartDPSum[segmentIndices[segment]].data[i][1] = _segmentationDb.data[week][segment].s;
                    chartDPDur[segmentIndices[segment]].data[i][1] = _segmentationDb.data[week][segment].dur;

                    chartData[segment][i].u = _segmentationDb.data[week][segment].u;
                    chartData[segment][i].t = _segmentationDb.data[week][segment].t;
                    chartData[segment][i].s = _segmentationDb.data[week][segment].s;
                    chartData[segment][i].dur = _segmentationDb.data[week][segment].dur;
                }
            }
        } else if (_bucket == "monthly") {

            var beginDate = moment(_periodObj.currentPeriodArr[0], "YYYY.M.D"),
                endDate =  moment(_periodObj.currentPeriodArr[_periodObj.currentPeriodArr.length -1], "YYYY.M.D"),
                beginMonth = beginDate.month() + 1,
                endMonth = endDate.month() + 1;

            endMonth += 12 * (endDate.year() - beginDate.year());

            for (var i = 0 ; i < (endMonth - beginMonth + 1); i++) {
                for (var j = 0; j < _segmentationDb.meta.length; j++) {
                    chartDPUser[j].data.push([]);
                    chartDPTotal[j].data.push([]);
                    chartDPSum[j].data.push([]);
                    chartDPDur[j].data.push([]);

                    chartDPUser[j].data[chartDPUser[j].data.length-1][0] = i;
                    chartDPUser[j].data[chartDPUser[j].data.length-1][1] = 0;
                    chartDPTotal[j].data[chartDPTotal[j].data.length-1][0] = i;
                    chartDPTotal[j].data[chartDPTotal[j].data.length-1][1] = 0;
                    chartDPSum[j].data[chartDPSum[j].data.length-1][0] = i;
                    chartDPSum[j].data[chartDPSum[j].data.length-1][1] = 0;
                    chartDPDur[j].data[chartDPDur[j].data.length-1][0] = i;
                    chartDPDur[j].data[chartDPDur[j].data.length-1][1] = 0;

                    chartData[_segmentationDb.meta[j]].push({ date:ticks.tickTexts[i], t:0, u:0, s:0, dur:0});
                }
            }

            for (var month in _segmentationDb.data) {
                var i = (12 * (parseInt(month.split(".")[0], 10) - beginDate.year())) + (parseInt(month.split("m")[1], 10) - beginMonth);

                for (var segment in _segmentationDb.data[month]) {
                    if(chartDPUser[segmentIndices[segment]].data[i]){
                        chartDPUser[segmentIndices[segment]].data[i][1] = _segmentationDb.data[month][segment].u;
                        chartDPTotal[segmentIndices[segment]].data[i][1] = _segmentationDb.data[month][segment].t;
                        chartDPSum[segmentIndices[segment]].data[i][1] = _segmentationDb.data[month][segment].s;
                        chartDPDur[segmentIndices[segment]].data[i][1] = _segmentationDb.data[month][segment].dur;
                    }

                    if(chartData[segment][i]){
                        chartData[segment][i].u = _segmentationDb.data[month][segment].u;
                        chartData[segment][i].t = _segmentationDb.data[month][segment].t;
                        chartData[segment][i].s = _segmentationDb.data[month][segment].s;
                        chartData[segment][i].dur = _segmentationDb.data[month][segment].dur;
                    }
                }
            }
        } else if (_bucket == "hourly") {
            for (var i = 0; i < (24 * _periodObj.numberOfDays); i++) {
                for (var j = 0; j < _segmentationDb.meta.length; j++) {
                    chartDPUser[j].data.push([]);
                    chartDPTotal[j].data.push([]);
                    chartDPSum[j].data.push([]);
                    chartDPDur[j].data.push([]);

                    chartDPUser[j].data[chartDPUser[j].data.length-1][0] = i;
                    chartDPUser[j].data[chartDPUser[j].data.length-1][1] = 0;
                    chartDPTotal[j].data[chartDPTotal[j].data.length-1][0] = i;
                    chartDPTotal[j].data[chartDPTotal[j].data.length-1][1] = 0;
                    chartDPSum[j].data[chartDPSum[j].data.length-1][0] = i;
                    chartDPSum[j].data[chartDPSum[j].data.length-1][1] = 0;
                    chartDPDur[j].data[chartDPSum[j].data.length-1][0] = i;
                    chartDPDur[j].data[chartDPSum[j].data.length-1][1] = 0;

                    chartData[_segmentationDb.meta[j]].push({ date:ticks.tickTexts[i], t:0, u:0, s:0, dur:0});
                }
            }

            var processedDays = [],
                // Received buckets needs to be sorted
                hourBuckets = _.map(_segmentationDb.data || [], function(val, key) { return key; }).sort();
            var dayCounter = 0;
            for (var j = 0; j < hourBuckets.length; j++) {
                var i = parseInt(hourBuckets[j].split("h")[1], 10);

                if (processedDays.indexOf(hourBuckets[j].split("h")[0]) === -1) {
                    processedDays.push(hourBuckets[j].split("h")[0]);
                    dayCounter = moment(hourBuckets[j].split(".h")[0], "YYYY.M.D").unix() - moment(_periodObj.currentPeriodArr[0], "YYYY.M.D").unix();
                    dayCounter = dayCounter / (60 * 60);
                }
                var hourIndex = i + dayCounter;

                for (var segment in _segmentationDb.data[hourBuckets[j]]) {
                    if( chartDPUser[segmentIndices[segment]].data[hourIndex] ){
                        chartDPUser[segmentIndices[segment]].data[hourIndex][1] = _segmentationDb.data[hourBuckets[j]][segment].u;
                        chartDPTotal[segmentIndices[segment]].data[hourIndex][1] = _segmentationDb.data[hourBuckets[j]][segment].t;
                        chartDPSum[segmentIndices[segment]].data[hourIndex][1] = _segmentationDb.data[hourBuckets[j]][segment].s;
                        chartDPDur[segmentIndices[segment]].data[hourIndex][1] = _segmentationDb.data[hourBuckets[j]][segment].dur;

                        chartData[segment][hourIndex].u = _segmentationDb.data[hourBuckets[j]][segment].u;
                        chartData[segment][hourIndex].t = _segmentationDb.data[hourBuckets[j]][segment].t;
                        chartData[segment][hourIndex].s = _segmentationDb.data[hourBuckets[j]][segment].s;
                        chartData[segment][hourIndex].dur = _segmentationDb.data[hourBuckets[j]][segment].dur;
                    }
                }
            }
        }

        for (var i = 0; i < chartDPTotal.length ; i++) {
            chartDPAvg.push({data:[], label:chartDPTotal[i].label});

            for (var j = 0; j < chartDPTotal[i].data.length ; j++) {
                chartDPAvg[i].data.push([ j , safeDivision(chartDPTotal[i].data[j][1] , chartDPUser[i].data[j][1]) ]);
            }
        }

        for (var i = 0; i < chartDPSum.length ; i++) {
            chartDPSumAvg.push({data:[], label:chartDPTotal[i].label});

            for (var j = 0; j < chartDPSum[i].data.length ; j++) {
                chartDPSumAvg[i].data.push([ j , safeDivision(chartDPSum[i].data[j][1] , chartDPUser[i].data[j][1]) ]);
            }
        }

        for (var i = 0; i < chartDPSum.length ; i++) {
            chartDPDurAvg.push({data:[], label:chartDPTotal[i].label});

            for (var j = 0; j < chartDPDur[i].data.length ; j++) {
                chartDPDurAvg[i].data.push([ j , safeDivision(chartDPDur[i].data[j][1] , chartDPUser[i].data[j][1]) ]);
            }
        }

        for (var segKey in chartData) {
            for (var i=0; i < chartData[segKey].length ; i++){
                chartData[segKey][i].a = safeDivision( chartData[segKey][i].t, chartData[segKey][i].u);
                chartData[segKey][i].as = safeDivision( chartData[segKey][i].s, chartData[segKey][i].u);
                chartData[segKey][i].adur = safeDivision( chartData[segKey][i].dur, chartData[segKey][i].u);
            }
        }

        {
            barChartDPTotal = {dp:[],ticks:barChartDP.ticks};
            barChartDPTotal.dp.push(barChartDP.dp[1]);

            barChartDPUser = {dp:[],ticks:barChartDP.ticks};
            barChartDPUser.dp.push(barChartDP.dp[0]);

            barChartDPAvg = {dp:[],ticks:barChartDP.ticks};
            barChartDPAvg.dp.push({color:countlyCommon.GRAPH_COLORS[2],data:[]});
            barChartDPAvg.dp[0].data.push([-1,null]);

            for (var i = 0; i < barChartDPTotal.dp[0].data.length-1; i++) {
                barChartDPAvg.dp[0].data.push([ i , safeDivision(barChartDPTotal.dp[0].data[i+1][1],barChartDPUser.dp[0].data[i+1][1]) ]);
            }

            barChartDPAvg.dp[0].data[barChartDPAvg.dp[0].data.length-1][1]= null;

            barChartDPSum = {dp:[],ticks:barChartDP.ticks};
            barChartDPSum.dp.push(barChartDP.dp[2]);

            barChartDPSumAvg = {dp:[],ticks:barChartDP.ticks};
            barChartDPSumAvg.dp.push({color:countlyCommon.GRAPH_COLORS[2],data:[]});
            barChartDPSumAvg.dp[0].data.push([-1,null]);

            for (var i = 0; i < barChartDPSum.dp[0].data.length-1; i++) {
                barChartDPSumAvg.dp[0].data.push([ i , safeDivision(barChartDPSum.dp[0].data[i+1][1],barChartDPUser.dp[0].data[i+1][1]) ]);
            }

            barChartDPSumAvg.dp[0].data[barChartDPSumAvg.dp[0].data.length-1][1]= null;

            barChartDPDur = {dp:[],ticks:barChartDP.ticks};
            barChartDPDur.dp.push(barChartDP.dp[3]);

            barChartDPDurAvg = {dp:[],ticks:barChartDP.ticks};
            barChartDPDurAvg.dp.push({color:countlyCommon.GRAPH_COLORS[3],data:[]});
            barChartDPDurAvg.dp[0].data.push([-1,null]);

            for (var i = 0; i < barChartDPDur.dp[0].data.length-1; i++) {
                barChartDPDurAvg.dp[0].data.push([ i , safeDivision(barChartDPDur.dp[0].data[i+1][1],barChartDPUser.dp[0].data[i+1][1]) ]);
            }

            barChartDPDurAvg.dp[0].data[barChartDPDurAvg.dp[0].data.length-1][1]= null;
        }

        {
            pieChartDPTotal = pieChartDP.totalDP;
            pieChartDPUser = pieChartDP.userDP;
            pieChartDPAvg = {dp:[]};

            for(var i = 0; i < pieChartDPTotal.dp.length; i++){
                pieChartDPAvg.dp.push({data:[],label:pieChartDPTotal.dp[i].label});
                pieChartDPAvg.dp[i].data.push([0,safeDivision(pieChartDPTotal.dp[i].data[0][1],pieChartDPUser.dp[i].data[0][1])]);
            }

            pieChartDPSum = pieChartDP.sumDP;
            pieChartDPSumAvg = {dp:[]};

            for(var i = 0; i < pieChartDPSum.dp.length; i++){
                pieChartDPSumAvg.dp.push({data:[],label:pieChartDPSum.dp[i].label});
                pieChartDPSumAvg.dp[i].data.push([0,safeDivision(pieChartDPSum.dp[i].data[0][1],pieChartDPUser.dp[i].data[0][1])]);
            }

            pieChartDPDur = pieChartDP.durDP;
            pieChartDPDurAvg = {dp:[]};

            for(var i = 0; i < pieChartDPDur.dp.length; i++){
                pieChartDPDurAvg.dp.push({data:[],label:pieChartDPDur.dp[i].label});
                pieChartDPDurAvg.dp[i].data.push([0,safeDivision(pieChartDPDur.dp[i].data[0][1],pieChartDPUser.dp[i].data[0][1])]);
            }
        }

        var chartDP = {
            line:{
                times:chartDPTotal,
                users:chartDPUser,
                average:chartDPAvg,
                sum:chartDPSum,
                sum_average:chartDPSumAvg,
                dur:chartDPDur,
                dur_average:chartDPDurAvg
            },
            pie:{
                times:pieChartDPTotal,
                users:pieChartDPUser,
                average: pieChartDPAvg,
                sum:pieChartDPSum,
                sum_average:pieChartDPSumAvg,
                dur:pieChartDPDur,
                dur_average:pieChartDPDurAvg
            },
            bar:{
                times:barChartDPTotal,
                users:barChartDPUser,
                average:barChartDPAvg,
                sum:barChartDPSum,
                sum_average:barChartDPSumAvg,
                dur:barChartDPDur,
                dur_average:barChartDPDurAvg
            }
        };

        if (_projectionKey.length === 2) {

          var ax =  countlySegmentation.getPunchcardAxes(_segmentationDb);

          chartDP.punchcard = {
            users:countlySegmentation.getPunchcardData(ax.axes, ax.meta, _segmentationDb, function(pair){
              return pair.u;
            }),
            times:  countlySegmentation.getPunchcardData(ax.axes, ax.meta, _segmentationDb, function(pair){
              return pair.t;
            }),
            average:countlySegmentation.getPunchcardData(ax.axes, ax.meta, _segmentationDb, function(pair){
              return safeDivision(pair.t, pair.u);
            }),
            dur: countlySegmentation.getPunchcardData(ax.axes, ax.meta, _segmentationDb, function(pair){
              return pair.dur;
            }),
            dur_average: countlySegmentation.getPunchcardData(ax.axes, ax.meta, _segmentationDb, function(pair){
              return safeDivision(pair.dur, pair.u);
            }),
            sum:countlySegmentation.getPunchcardData(ax.axes, ax.meta, _segmentationDb, function(pair){
              return pair.s;
            }),
            sum_average:countlySegmentation.getPunchcardData(ax.axes, ax.meta, _segmentationDb, function(pair){
              return safeDivision(pair.s, pair.u);
            }),
          };

        }

        return {
            chartDP:chartDP,
            chartData:chartData,
            aggregatedChartData:aggregatedChartData
        };
    };
    countlySegmentation.getPunchcardAxes = function(segmentationDb) {
      var axes = {};
      var meta = {index0:0 , index1:0, transposed: false};

      axes[_projectionKey[0]] = {key: _projectionKey[0], values:{}, labels:[]};
      axes[_projectionKey[1]] = {key: _projectionKey[1], values:{}, labels:[]};

      segmentationDb.meta.forEach(function(pair){
        var val0 = segmentationDb[pair].keys[_projectionKey[0]];
        var val1 = segmentationDb[pair].keys[_projectionKey[1]];
        if (axes[_projectionKey[0]].values[val0] === undefined){
          axes[_projectionKey[0]].values[val0] = meta.index0++;
          axes[_projectionKey[0]].labels.push(countlySegmentation.getUserPropertyLongName(_projectionKey[0], val0));
        }
        if (axes[_projectionKey[1]].values[val1] === undefined){
          axes[_projectionKey[1]].values[val1] = meta.index1++;
          axes[_projectionKey[1]].labels.push(countlySegmentation.getUserPropertyLongName(_projectionKey[1], val1));
        }
      });

      if (meta.index0 < meta.index1) { // always landscape
        meta.axisX = axes[_projectionKey[1]];
        meta.axisY = axes[_projectionKey[0]];
        meta.transposed = true;
      } else {
        meta.axisX = axes[_projectionKey[0]];
        meta.axisY = axes[_projectionKey[1]];
      }
      return {axes:axes, meta:meta};
    }

    countlySegmentation.getPunchcardData = function(axes, meta, segmentationDb, dataFilter) {
        var labelsX = meta.axisX.labels;
        var labelsY = meta.axisY.labels;
        var data = [];

        labelsY.forEach(function(){
          var emptyRow = [];
          labelsX.forEach(function(){
            emptyRow.push(0);
          });
          data.push(emptyRow);
        });

        segmentationDb.meta.forEach(function(pair){
          var val0 = segmentationDb[pair].keys[_projectionKey[0]];
          var val1 = segmentationDb[pair].keys[_projectionKey[1]];
          var value = dataFilter(segmentationDb[pair]);
          var i0 = axes[_projectionKey[0]].values[val0];
          var i1 = axes[_projectionKey[1]].values[val1];
          if (meta.transposed) {
            data[i0][i1] = value;
          } else {
            data[i1][i0] = value;
          }
        });

        labelsY = labelsY.map(function(item){
          return {
            label: item,
            dispLabel: item,
            data: []
          }
        });

        var barColors = ["rgba(111, 163, 239, 1)", "rgba(85, 189, 185, 1)", "rgba(239, 136, 0, 1)", "rgba(174, 131, 210, 1)"];

        var color = barColors[0];
        var maxDataValue = Math.max.apply(null, ([].concat.apply([], data))) || 1;
        var defaultColor = "rgba(255, 255, 255, .07)";
        var maxRadius = 40;
        var minRadius = 5;

        var averages = [];

        var reducer = function(c, acc, current, y) {
            return acc + data[y][c];
        };

        var colVector = [];

        for (var c = 0; c < meta.axisY.labels.length; c++) {
          colVector.push(c);
        }

        for (var c = 0; c < meta.axisX.labels.length; c++) {
            var total = colVector.reduce(reducer.bind(this, c), 0);
            averages.push(total / colVector.length);
        }

        for (var i = 0; i < data.length; i++) {
            for (var j = 0; j < data[i].length; j++) {
                var fill = parseFloat((data[i][j] / maxDataValue).toFixed(2));
                var radius = ((maxRadius - minRadius) * fill) + minRadius;
                var setColor = defaultColor;
                if (radius > minRadius) {
                    setColor = color.slice(0, (color.length - 2)) + fill + ")";
                }

                var percentage = ((data[i][j] - averages[j]) * 100) / averages[j];

                var obj = {
                    color: setColor,
                    radius: radius,
                    count: parseFloat(data[i][j]).toFixed(2),
                    averagePercentage: percentage.toFixed(0),
                    text: ""
                };
                labelsY[i].data.push(obj);
            }
        }

        return {
            data: {
              labelsX: labelsX,
              labelsY: labelsY,
              xAxisType: countlySegmentation.getReadableFieldName(meta.axisX.key),
              yAxisType: countlySegmentation.getReadableFieldName(meta.axisY.key),
          }
        };
    }

    countlySegmentation.getReadableFieldName = function(key){
      if (key == "did"){
         return "ID";
      }
      var keySplit = key.split('.');
      if (keySplit.length > 1) {
        if (keySplit[0] == "cmp" && keySplit[1] == "c") {
          return jQuery.i18n.map["drill.cmp_c"];
        }
        if (keySplit[0] == "custom") {
          return keySplit[1];
        } else {
          var segKey = keySplit[1];
          if (_segmentationDbMeta.e && _segmentationDbMeta.e.indexOf("[CLY]_") == 0) {
            var name = (segKey.charAt(0).toUpperCase() + segKey.slice(1)).replace(/_/g, " ");
            if ((_segmentationDbMeta.e == "[CLY]_crash" && segKey == "crash") || keySplit[0] == "sg") {
              return name;
            }
            if (_segmentationDbMeta.e == "[CLY]_view" && segKey == "name") {
              return jQuery.i18n.map["drill.lv"];
            }
            if (_segmentationDbMeta.e == "[CLY]_view" && (segKey == "start" || segKey == "exit" || segKey == "bounce")) {
              return jQuery.i18n.map["drill.view." + segKey];
            }
          }
        }
      }

      return jQuery.i18n.map["drill." + keySplit[keySplit.length-1]];

    }

    countlySegmentation.getSegmentationDPWithHistogram = function() {
        var chartDPTotal = {dp:[{color:countlyCommon.GRAPH_COLORS[0],data:[]}],ticks:[]},
            chartDPUser = {dp:[{color:countlyCommon.GRAPH_COLORS[1],data:[]}],ticks:[]},
            chartDPAvg = {dp:[{color:countlyCommon.GRAPH_COLORS[2],data:[]}],ticks:[]},
            chartData = [],
            ticks = [];

        chartDPTotal.dp[0].data.push([-1,null]);
        chartDPUser.dp[0].data.push([-1,null]);
        chartDPAvg.dp[0].data.push([-1,null]);
        ticks.push([-1,""]);

        var segVal, i;
        for (i=0; i<_segmentationDb.meta.length; i++){
            segVal = _segmentationDb.meta[i];
            chartDPTotal.dp[0].data.push([i,_segmentationDb[segVal].t]);
            chartDPUser.dp[0].data.push([i,_segmentationDb[segVal].u]);
            chartDPAvg.dp[0].data.push([i,safeDivision(_segmentationDb[segVal].t, _segmentationDb[segVal].u)]);
            chartData.push({
                curr_segment:segVal,
                t: _segmentationDb[segVal].t,
                u: _segmentationDb[segVal].u,
                a: chartDPAvg.dp[0].data[i+1][1]
            });
            ticks.push([i,segVal]);
        }
        chartDPTotal.dp[0].data.push([i,null]);
        chartDPUser.dp[0].data.push([i,null]);
        chartDPAvg.dp[0].data.push([i,null]);

        chartDPTotal.ticks = ticks;
        chartDPUser.ticks = ticks;
        chartDPAvg.ticks = ticks;

        return {
            chartDP:{
                bar:{
                    average:chartDPAvg,
                    times:chartDPTotal,
                    users:chartDPUser
                }
            },
            aggregatedChartData:chartData
        };
    };

    countlySegmentation.getActiveEvent = function() {
        return _event;
    };

    countlySegmentation.getBookmarks = function (mode) {
        var data = {
            "api_key":countlyGlobal.member.api_key,
            "app_id":countlyCommon.ACTIVE_APP_ID,
            "method":"drill_bookmarks",
            "event_key" : _event
        };

        data.app_level = mode;

        return $.ajax({
            type: "GET",
            url: countlyCommon.API_PARTS.data.r,
            data: data,
            dataType:"json",
            success: function (json) {}
        });
    };

    countlySegmentation.isHistogram = function () {
        return _segmentationDb.chart && _segmentationDb.chart == "histogram";
    };

    countlySegmentation.isMap = function () {
        return _segmentationDb.chart && _segmentationDb.chart == "map";
    };

    countlySegmentation.formatToDbVal= function (key,value){
        var newValue = value;
        switch (key) {
            case "up.av":
                newValue = value.replace(".", ":");
                break;
        }

        return newValue;
    }

    countlySegmentation.getMultiUserPropertyLongName = function(keys, values) {
      if(typeof keys === 'string'){
        return countlySegmentation.getUserPropertyLongName(keys, values);
      }
      if (keys.length === 1) {
        if (typeof values !== 'object') {
          return countlySegmentation.getUserPropertyLongName(keys[0], values);
        } else {
          return "";
        }
      }
      if(typeof values === 'string'){
        var splittedValues = values.split(' | ');
        return keys.map(function(key, index) {
          var value = countlySegmentation.getUserPropertyLongName(key, splittedValues[index])
          if (value === undefined || value === ""){
            return "(N/A)"
          }
          return countlySegmentation.getUserPropertyLongName(key, splittedValues[index]);
        }).join(' | ');
      }
      return keys.map(function(key) {
        return countlySegmentation.getUserPropertyLongName(key, values[key]);
      }).join(' | ');
    }

    countlySegmentation.getUserPropertyLongName = function(key, value) {
        var newValue = value;
        switch (key) {
            case "d":
            case "up.d":
                newValue = countlyDevice.getDeviceFullName(value);
                break;
            case "pv":
            case "up.pv":
                newValue = countlyDeviceDetails.fixOSVersion(value);
                break;
            case "dnst":
            case "up.dnst":
                newValue = countlyDeviceDetails.fixOSVersion(value);
                break;
            case "brwv":
            case "up.brwv":
                newValue = countlyBrowser.fixBrowserVersion(value, countlySegmentation.getFilterNames("up.brw"));
                break;
            case "cc":
                newValue = countlyLocation.getCountryName(value);
                break;
            case "av":
            case "up.av":
                newValue = (value+"").replace(/:/g, ".");
                break;
            case "c":
            case "up.c":
                newValue = countlyCarrier.getCarrierCodeName(value);
                break;
            case "up.cc":
                // up.cc key comes from getSegmentationDPWithProjection function
                // we don't want to replace this since we need the short names to draw the map
                break;
            case "la":
            case "up.la":
                newValue = (typeof countlyLanguage !== 'undefined') ? countlyLanguage.getLanguageName(value) : value;
                break;
            case "src":
            case "up.src":
                newValue = (typeof countlySources !== 'undefined') ? countlySources.getSourceName(value, null, true) : value;
                break;
            case "sg.crash":
                newValue = (typeof countlyCrashes !== 'undefined' && _event == "[CLY]_crash") ? countlyCrashes.getCrashName(value) : value;
                break;
            case "cmp.c":
                newValue = (typeof countlyAttribution !== 'undefined') ? countlyAttribution.getCampaignName(value) : value;
                break;
            case "chr":
                newValue = (typeof countlyCohorts !== 'undefined') ? countlyCohorts.getName(value) : value;
                break;
            case "hour":
            case "up.hour":
                newValue = (value < 10) ? "0"+value+":00" : value+":00";
                break;
            case "dow":
            case "up.dow":
                newValue = jQuery.i18n.map["drill."+_weekDays[value]];
                break;
        }

        return newValue;
    };

    countlySegmentation.getEvent = function () {
        return _event;
    };

    countlySegmentation.getDrillReportsForApps = function(appId, results){
        var dfd = jQuery.Deferred();

        if (_drillMaps[appId]) {
            results["data"] = _drillMaps[appId];
            dfd.resolve();
        }else{
            $.ajax({
                type:"GET",
                url:countlyCommon.API_PARTS.data.r+"/tasks/all",
                data:{
                    "app_id":appId,
                    "query": JSON.stringify({"manually_create": true, "autoRefresh": true, "type": "drill", "status": "completed"}),
                    "period":countlyCommon.getPeriodForAjax(),
                    "timestamp": +new Date()
                },
                dataType:"json",
                success:function (json) {
                    for(var i = 0; i < json.length; i++){
                        if(json[i].meta)
                            json[i].meta = countlyCommon.decodeHtml(json[i].meta);
                        if(json[i].request)
                            json[i].request = JSON.parse(countlyCommon.decodeHtml(json[i].request));
                    }

                    if(json && json.length){
                        _drillMaps[appId] = json;
                    }
                    results["data"] = json;
                    dfd.resolve();
                }
            });
        }

        return dfd.promise();
    }

    countlySegmentation.clearDrillReportCache = function(){
        _drillMaps = {};
    }

    countlySegmentation.setCommonInstance = function(instance){
        _commonInstance = instance;
    }

    function setMeta() {
        if (_segmentationDbMeta && _segmentationDbMeta.up) {
            for (var property in _segmentationDbMeta.up) {
                _filterValues["up." + property] = _segmentationDbMeta.up[property].values || [];
                _filterValues["up." + property].sort(_sortFilter);
                _filterNames["up." + property] = getUserPropertyLongNames(property, _segmentationDbMeta.up[property].values);
            }
        }

        if (_segmentationDbMeta && _segmentationDbMeta.chr && typeof countlyCohorts !== "undefined") {
            _filterValues.chr = _segmentationDbMeta.chr.values;
            _filterValues.chr.sort(_sortFilter);
            _filterNames.chr = getUserPropertyLongNames("chr", _segmentationDbMeta.chr.values);
        }

        if (_segmentationDbMeta && _segmentationDbMeta.custom) {
            for (var property in _segmentationDbMeta.custom) {
                _filterValues["custom." + property] = _segmentationDbMeta.custom[property].values || [];
                _filterValues["custom." + property].sort(_sortFilter);
                _filterNames["custom." + property] = _segmentationDbMeta.custom[property].values || [];
            }
        }

        if (_segmentationDbMeta && _segmentationDbMeta.cmp) {
            for (var property in _segmentationDbMeta.cmp) {
                _filterValues["cmp." + property] = _segmentationDbMeta.cmp[property].values || [];
                _filterValues["cmp." + property].sort(_sortFilter);

                var values = _segmentationDbMeta.cmp[property].values || [];
                if(property == "c" && typeof countlyAttribution !== 'undefined'){
                    var newVals = [];
                    for(var i = 0; i < values.length; i++){
                        newVals[i] = countlyAttribution.getCampaignName(values[i]);
                    }
                    values = newVals;
                }
                _filterNames["cmp." + property] = values;
            }
        }

        if (_segmentationDbMeta && _segmentationDbMeta.sg) {
            for (var property in _segmentationDbMeta.sg) {
                _filterValues["sg." + property] = _segmentationDbMeta.sg[property].values || [];
                _filterValues["sg." + property].sort(_sortFilter);
                _filterNames["sg." + property] = _segmentationDbMeta.sg[property].values || [];
            }
        }
    }

    function getUserPropertyLongNames(key, values) {
        var newValues = [];

        if (!values) {
            return newValues;
        }

        switch (key) {
            case "d":
            case "pv":
            case "cc":
            case "av":
            case "brwv":
            case "up.d":
            case "up.pv":
            case "up.cc":
            case "up.av":
            case "up.brwv":
            case "la":
            case "up.la":
            case "dnst":
            case "up.dnst":
            case "hour":
            case "up.hour":
            case "dow":
            case "up.dow":
            case "c":
            case "up.c":
            case "chr":
                for (var i = 0; i < values.length; i++) {
                    newValues.push(countlySegmentation.getUserPropertyLongName(key, values[i]));
                }
                break;
            default:
                newValues = values;
                break;
        }

        return newValues;
    }

    function safeDivision(dividend, divisor) {
        var tmpAvgVal;
        tmpAvgVal = dividend / divisor;
        if(!tmpAvgVal || tmpAvgVal == Number.POSITIVE_INFINITY){
            tmpAvgVal = 0;
        }
        return tmpAvgVal.toFixed(2);
    }

}(window.countlySegmentation = window.countlySegmentation || {}, jQuery));