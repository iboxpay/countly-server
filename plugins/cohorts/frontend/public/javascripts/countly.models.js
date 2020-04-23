(function (countlyCohorts, $, undefined) {

    //Private Properties
    var _resultData = [],
        _datas = {},
        _selected = {},
        _selectCount = 0,
        _names = {},
        _forceDataReload = false,
        _appId = "";
        
    countlyCohorts.loadList = function (id) {
        return $.ajax({
            type:"GET",
            url:countlyCommon.API_PARTS.data.r,
            data:{
                "app_id":id,
                "method":"get_cohort_list",
                "preventRequestAbort":true
            },
            dataType:"json",
            success:function (json) {
                _names = json;
            }
        });
    };
    if(countlyGlobal.member && countlyGlobal.member.api_key && countlyCommon.ACTIVE_APP_ID){
        countlyCohorts.loadList(countlyCommon.ACTIVE_APP_ID);
    }

    //Public Methods
    countlyCohorts.initialize = function (isRefresh, query) {
        if(_appId != countlyCommon.ACTIVE_APP_ID){
            _appId = countlyCommon.ACTIVE_APP_ID;
            countlyCohorts.reset();
        }
        return $.ajax({
            type:"GET",
            url:countlyCommon.API_PARTS.data.r,
            data:{
                "app_id":countlyCommon.ACTIVE_APP_ID,
                "method": "get_cohorts",
                "display_loader": !isRefresh
            },
            dataType:"json",
            success:function (json) {
                _resultData = json;
                _selected = {};
                _selectCount = 0;
                for(var i = 0; i < _resultData.length; i++){
                    _names[_resultData[i]._id] = _resultData[i].name;
                    if(_resultData[i].steps){
                        _resultData[i].steps.forEach(function(step){
                            step.times = step.times || '{"$gte":1}';
                        });
                    }
                    if(_selectCount < countlyCommon.GRAPH_COLORS.length && typeof _selected[_resultData[i]._id] === "undefined"){
                        _selected[_resultData[i]._id] = true;
                        _selectCount++;
                    }
                }
            }
        });
    };

    countlyCohorts.loadLocations = function(id){
        return $.ajax({
            type:"GET",
            url:countlyCommon.API_PARTS.data.r,
            data:{
                "app_id":id,
                "method":"get_locations"
            },
            dataType:"json"
        });
    }

    countlyCohorts.refresh = function (cohorts) {
        if(_appId != countlyCommon.ACTIVE_APP_ID){
            _appId = countlyCommon.ACTIVE_APP_ID;
            countlyCohorts.reset();
        }
        return $.when(
            $.ajax({
                type:"GET",
                url:countlyCommon.API_PARTS.data.r,
                data:{
                    "app_id":countlyCommon.ACTIVE_APP_ID,
                    "method":"get_cohorts",
                    "display_loader": false
                },
                dataType:"json",
                success:function (json) {
                    _resultData = json;
                    for(var i = 0; i < _resultData.length; i++){
                        if(_resultData[i].steps){
                            _resultData[i].steps.forEach(function(step){
                                step.times = step.times || '{"$gte":1}';
                            });
                        }
                        _names[_resultData[i]._id] = _resultData[i].name;
                    }
                }
            }),
            $.ajax({
                type:"GET",
                url:countlyCommon.API_PARTS.data.r,
                data:{
                    "cohorts": JSON.stringify(cohorts || countlyCohorts.getAllSelected()),
                    "method": "cohortdata",
                    "app_id":countlyCommon.ACTIVE_APP_ID,
                    "action": "refresh"
                },
                dataType:"json",
                success:function (json) {
                    for(var i = 0; i < json.length; i++){
                        if(!_datas[json[i]._id])
                            _datas[json[i]._id] = json[i].data;
                        else
                            countlyCommon.extendDbObj(_datas[json[i]._id], json[i].data);
                    }
                }
            })
        );
    };
    
    countlyCohorts.getResults = function () {
        return _resultData;
    };
    
    countlyCohorts.reset = function () {
        _resultData = [];
        _datas = {};
        _selected = {};
        _selectCount = 0;
        _names = {};
        _forceDataReload = false;
    };
    
    countlyCohorts.select = function (id) {
        if(!_selected[id]){
            if(typeof _selected[id] === "undefined")
                _forceDataReload = true;
            _selected[id] = true;
            _selectCount++;
        }
        return _forceDataReload;
    };
    
    countlyCohorts.unselect = function (id) {
        if(_selected[id]){
            _selected[id] = false;
            _selectCount--;
        }
    };
    
    countlyCohorts.unselectAll = function (id) {
        _selected = {};
        _selectCount = 0;
    };
    
    countlyCohorts.getSelected = function (id) {
        return _selected[id];
    };
    
    countlyCohorts.anySelected = function () {
        for(var i in _selected){
            if(_selected[i]){
                return true;
            }
        }
        return false
    };
    
    countlyCohorts.getAllSelected = function(){
        var ids = [];
        for(var i in _selected){
            if(_selected[i])
                ids.push(i);
        }
        return ids;
    };
    
    countlyCohorts.getName = function(id){
        return _names[id];
    };

    countlyCohorts.removeName = function(id){
        delete _names[id];
    };
    
    countlyCohorts.getNames = function(){
        return _names;
    };
    
    countlyCohorts.loadData = function (cohorts, force) {
        if(_appId != countlyCommon.ACTIVE_APP_ID){
            _appId = countlyCommon.ACTIVE_APP_ID;
            countlyCohorts.reset();
        }
        var data ={
            "cohorts": JSON.stringify(cohorts || countlyCohorts.getAllSelected()),
            "method": "cohortdata",
			"app_id":countlyCommon.ACTIVE_APP_ID
		}
        if(force)
            data.period = countlyCommon.getPeriodForAjax();
        else
            data.action = "refresh";
		return $.ajax({
			type:"GET",
			url:countlyCommon.API_PARTS.data.r,
			data:data,
			success:function (json) {
                _datas = {};
				for(var i = 0; i < json.length; i++){
                    if(!_datas[json[i]._id])
                        _datas[json[i]._id] = json[i].data;
				}
			}
		});
    };
    
    countlyCohorts.get = function (id, callback) {
        var data = {};
        data.app_id = countlyCommon.ACTIVE_APP_ID;
        data.method = "cohort";
        data.cohort = id;
		$.ajax({
			type:"GET",
            url:countlyCommon.API_PARTS.data.r,
            data:data,
            dataType:"json",
			success:function (json) {
                if(callback)
                    callback(json);
			},
			error:function(){
                if(callback)
                    callback(false);
			}
		});
    };
    
    countlyCohorts.common = function (data, path, callback) {
        data.app_id = countlyCommon.ACTIVE_APP_ID;
		$.ajax({
			type:"GET",
            url:countlyCommon.API_PARTS.data.w + '/cohorts/'+path,
            data:data,
            dataType:"json",
			success:function (json) {
                if(callback)
                    callback(json);
			},
			error:function(){
                if(callback)
                    callback(false);
			}
		});
    };
    
    countlyCohorts.del = function (id, ack, callback) {
        countlyCohorts.common({cohort_id:id, ack: ack}, "delete", callback);
    };
    
    countlyCohorts.add = function (data, callback) {        
        var wrapperCallback = function(json) {
            if(callback) {
                callback(json);
            }
            var segmentation = {};
            if (data.steps) {
                try {
                    var steps = JSON.parse(data.steps);
                    segmentation.user_behaviour_count = steps.length;
    
                    steps.forEach(function(step){
                        if (!step.event){
                            return;
                        }
        
                        if (step.event === "[CLY]_view") {
                            segmentation.contains_view = true;   
                        } else if (step.event === "[CLY]_crash") {
                            segmentation.contains_crash = true;   
                        } else if (step.event === "[CLY]_session") {
                            segmentation.contains_session = true;   
                        } else {
                            segmentation.contains_event = true;   
                        }
                    });
                }
                catch(ex) {
                    //silent catch
                }
            }
            
            if (data.user_segmentation) {
                try {
                    var userSeg = JSON.parse(data.user_segmentation);
                    if (userSeg && userSeg.query) {
                        segmentation.user_property_count = Object.keys(userSeg.query).length;
                    }
                }
                catch(ex) {
                    //silent catch
                }
            }

            app.recordEvent({
                "key": "cohort-create",
                "count": 1,
                "segmentation": segmentation
            });
        };

        countlyCohorts.common(data, "add", wrapperCallback);
    };

    countlyCohorts.update = function(data, callback){
        countlyCohorts.common(data, "edit", callback);
    }
    
    countlyCohorts.clearObject = function (obj) {
        if (obj) {
            if (!obj["i"]) obj["i"] = 0;
            if (!obj["o"]) obj["o"] = 0;
        }
        else {
            obj = {"i":0, "o":0};
        }
        return obj;
    };
    
    countlyCohorts.getChartData = function(path, metric, name){
        var chartData = [
                { data:[], label:name, color:'#DDDDDD', mode:"ghost" },
                { data:[], label:name, color:'#333933' }
            ],
            dataProps = [
                {
                    name:"p"+metric,
                    func:function (dataObj) {
                        return dataObj[metric]
                    },
                    period:"previous"
                },
                { name:metric}
            ];

        return countlyCommon.extractChartData(_datas[path], countlyCohorts.clearObject, chartData, dataProps);
    };

    countlyCohorts.setSelected = function(data){
        _selected = data;
    }

    countlyCohorts.getData = function() {
        return _datas;
    }
	
}(window.countlyCohorts = window.countlyCohorts || {}, jQuery));