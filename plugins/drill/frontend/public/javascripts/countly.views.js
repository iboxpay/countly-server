window.DrillView = countlyView.extend({
    beforeRender: function() {
        this.bookmarkList = {};
        var self = this;
        if(!this.template){
            if(this._task)
                return $.when($.get(countlyGlobal["path"]+'/drill/templates/drill.html', function(src){
                    self.template = Handlebars.compile(src);
                }), countlyTaskManager.fetchResult(this._task)).then(function () {
                    self.previousCommonObject = countlyCommon;
                    countlyCommon = new CommonConstructor();
                    countlySegmentation.setCommonInstance(countlyCommon);
                });
            else
                return $.when($.get(countlyGlobal["path"]+'/drill/templates/drill.html', function(src){
                    self.template = Handlebars.compile(src);
                })).then(function () {});
        }
        else if(this._task){
            return $.when(countlyTaskManager.fetchResult(this._task)).then(function () {
                self.previousCommonObject = countlyCommon;
                countlyCommon = new CommonConstructor();
                countlySegmentation.setCommonInstance(countlyCommon);
            });
        }
    },
    filterObj:{},
    byVal:"",
    graphType:"line",
    graphVal:"times",
    graphBucket:"daily",
    drillChartDP:{},
    drillChartData:{},
    activeSegmentForTable:"",
    previousCommonObject: null,
    viewName: "drill",
    destroy: function () {
        countlyCommon =  self.previousCommonObject ||  new CommonConstructor();
    },
    draw:function (needData, dateChange, task_id){
        if (this.byVal == "") {
            this.graphType = "line";
        }else{
          if (Array.isArray(this.byVal) && this.byVal.length === 2){
            $(".only-2by").show();
          }else{
            $(".only-2by").hide();
          }
          if (this._filter.setFilter == "times" && countlyCommon.getPersistentSettings().drillMetricType != 'times') {
            countlyCommon.setPersistentSettings({ drillMetricType: 'times' });
            $(".value").find(".button[data-value='" + countlyCommon.getPersistentSettings().drillMetricType + "']").trigger('click');
          }
          else if (this._filter.setFilter == "users" && countlyCommon.getPersistentSettings().drillMetricType != 'users') {
            countlyCommon.setPersistentSettings({ drillMetricType: 'users' });
            $(".value").find(".button[data-value='" + countlyCommon.getPersistentSettings().drillMetricType + "']").trigger('click');
          }
        }

        var limit = undefined;

        if(this.graphType === "punchcard"){
          this.initializeEventListeners();
          limit = 20;
        }else{
          this.destroyEventListeners();
        }

        this.initBuckets();
        var self = this;
        if (needData) {
            $.when(countlySegmentation.getSegmentationData(task_id, limit)).then(function(){
                if(!countlySegmentation.hasTask()){
                    $(".drill .date-selector.selected").off('click').on('click',function(){
                        CountlyHelpers.setUpDateSelectors(this);
                        self.dateChanged()
                    })
                    self.setTempPeriodForTask();
                    self.taskReportRemind();
                    if (self.byVal == "") {
                        self.drillChartDP = countlySegmentation.getSegmentationDP().chartDP;
                    } else {
                        self.drillChartDP = countlySegmentation.getSegmentationDPWithProjection().chartDP;
                    }
                    self.initBuckets();
                    self.fillTable();
                    self.drawGraph(dateChange);
                }
            });
        } else {
            self.fillTable();
            self.drawGraph(false);
        }

        if (countlySegmentation.getEvent() == "[CLY]_session" || countlySegmentation.getEvent() == "[CLY]_view") {
            $(".graph-settings .value-sum").hide();
            $(".graph-settings").find(".value .button").removeClass("last");
        } else if(countlySegmentation.getEvent() == "[CLY]_crash"){
            $(".graph-settings .value-sum").hide();
            $(".graph-settings .value-dur").hide();
            $(".graph-settings").find(".value .button[data-value=average]").addClass("last");
        } else {
            $(".graph-settings .value-sum").show();
            $(".graph-settings").find(".value .button").removeClass("last");
        }
        CountlyHelpers.setUpDateSelectors(this)
    },
    setTempPeriodForTask: function() {
        if(this._task){
            var task = countlyTaskManager.getResult(this._task)
            var period = task.request.json.period
            var periodRang = countlyCommon.getPeriodRange(period, task.end);
            return countlyCommon.setPeriod(periodRang, null, true);
        }
    },
    drawGraph:function (dateChange) {
        $("#drill").find("#geo-chart").hide();
        $("#drill").find("#drill-punchcard").hide();
        $("#drill").find("#dashboard-graph").show();
        $("#drill").find(".widget-content").removeClass("pie");
        $("#drill").find(".widget-content").removeClass("bar");
        $("#drill").find(".widget-content").removeClass("punchcard");
        $("#label-container").hide();

        if(this.drillChartDP["dur"] && this.drillChartDP["dur_average"]){
            countlyCommon.formatSecondForDP(this.drillChartDP["dur_average"], jQuery.i18n.map["drill.dur-users"]);
            countlyCommon.formatSecondForDP(this.drillChartDP["dur"], jQuery.i18n.map["drill.dur"]);
        }

        if (this.byVal == "") {
            $("#label-container").find(".labels").html("");
            countlyCommon.drawTimeGraph(this.drillChartDP[this.graphVal], "#dashboard-graph", this.graphBucket);
        } else {
            var isByCountry = (this.byVal.indexOf("up.cc") === 0 && this.byVal.length === 1);
            if (isByCountry && countlyGlobal["config"].use_google) {
                this.drawMap();
            } else if (countlySegmentation.isHistogram()) {
                countlyCommon.drawGraph(this.drillChartDP["bar"][this.graphVal], "#dashboard-graph", "bar");
            } else {
                $("#empty-graph").hide();
                if (this.graphType == "line") {
                    if(!this.drillChartDP[this.graphType][this.graphVal].length){
                        $("#empty-graph").show();
                    }
                    $("#label-container").show();

                    var lineChartData = this.drillChartDP[this.graphType][this.graphVal],
                        labels = _.pluck(lineChartData, "label"),
                        labelsEl = $("#label-container").find(".labels"),
                        labelsClone = labelsEl.clone(),
                        self = this;

                    for (var i = 0; i < lineChartData.length; i++) {
                        lineChartData[i].color = countlyCommon.GRAPH_COLORS[i];
                    }

                    labelsEl.html("");

                    for (var i = 0; i < labels.length; i++) {
                        labelsEl.append("<div class='label'><div class='color' style='background-color:" + countlyCommon.GRAPH_COLORS[i] + "'></div><div class='text' title='"+ labels[i] + "'>" + labels[i] + "</div></div>");
                    }

                    if (dateChange) {
                        labelsClone.find(".label").each(function(index) {
                            if ($(this).hasClass("hidden")) {
                                var text = $(this).text();
                                labelsEl.find(".label").filter(function() {
                                    return $(this).text() == text;
                                }).addClass("hidden");
                            }
                        });
                    }

                    labelsEl.find(".label").unbind('click');
                    labelsEl.find(".label").click(function() {
                        if ($(this).hasClass("hidden")) {
                            $(this).toggleClass("hidden");
                            countlyCommon.drawTimeGraph(getActiveLabelData(lineChartData), "#dashboard-graph", self.graphBucket);
                        } else if (labelsEl.find(".label:not(.hidden)").length > 1) {
                            $(this).toggleClass("hidden");
                            countlyCommon.drawTimeGraph(getActiveLabelData(lineChartData), "#dashboard-graph", self.graphBucket);
                        }
                    });

                    countlyCommon.drawTimeGraph(getActiveLabelData(lineChartData), "#dashboard-graph", this.graphBucket);
                } else {
                    var graphProps = {};

                    if (this.graphType == "pie") {
                        graphProps = {series: {pie: { innerRadius: 0.45 }}};
                        $("#drill").find(".widget-content").addClass("pie");
                        if(!this.drillChartDP[this.graphType][this.graphVal].dp.length){
                            $("#empty-graph").show();
                        }
                    } else if (this.graphType == "bar") {
                        $("#drill").find(".widget-content").addClass("bar");
                        if(this.drillChartDP[this.graphType][this.graphVal].dp.length == 1 &&
                            this.drillChartDP[this.graphType][this.graphVal].dp[0].data.length == 2){
                            $("#empty-graph").show();
                        }
                    }
                    var self = this;
                    if (this.graphType !== "punchcard"){
                      countlyCommon.drawGraph(this.drillChartDP[this.graphType][this.graphVal], "#dashboard-graph", this.graphType, graphProps);
                    } else {
                      if (this.punchcardTemplate===undefined) {
                        $.when($.get(countlyGlobal["path"]+'/drill/templates/punchcard.html', function(src){
                          self.punchcardTemplate =  Handlebars.compile(src);
                        })).then(function () {
                          self.drawPunchcard(self.drillChartDP[self.graphType][self.graphVal]);
                        });
                      } else {
                          self.drawPunchcard(self.drillChartDP[self.graphType][self.graphVal]);
                      }
                    }


                }
            }
        }

        if ($("#empty-graph").is(":hidden")) {
            $(".graph-settings").find(".type").show();

            if (countlySegmentation.isHistogram() || countlySegmentation.isMap()) {
                $("#label-container").find(".labels").html("");
                $(".graph-settings").find(".type").hide();
            } else if (this.byVal) {
                $(".graph-settings").find(".type").show();
            } else {
                $(".graph-settings").find(".type").hide();
            }
        }

        function getActiveLabelData(data) {
            var labels = _.pluck(data, "label"),
                newData = $.extend(true, [], data),
                newLabels = $.extend(true, [], labels);

            for (var i = 0; i < newLabels.length; i++) {
                newLabels[i] += "";
            }

            $("#label-container").find(".label").each(function (index) {
                var escapedLabel = _.escape($(this).text().replace(/(?:\r\n|\r|\n)/g, ''));

                if ($(this).hasClass("hidden") && newLabels.indexOf(escapedLabel) != -1) {
                    delete newLabels[newLabels.indexOf(escapedLabel)];
                }
            });

            newLabels = _.compact(newLabels);

            for (var j = 0; j < newData.length; j++) {
                if (newLabels.indexOf(newData[j].label + "") == -1) {
                    delete newData[j];
                }
            }

            return _.compact(newData);
        }
    },
    drawPunchcard:function(data){
      if (data.data.labelsY.length === 0){
          $("#empty-graph").show();
          $("#drill").find("#dashboard-graph").show();
          $("#drill-punchcard").hide();
          return;
      }
      $("#empty-graph").hide();
      $("#drill").find("#dashboard-graph").hide();
      $("#drill-punchcard").html(this.punchcardTemplate(data));
      $("#drill-punchcard").show();
      $("#drill").find(".widget-content").addClass("punchcard");
      if(data.data.labelsX.length === 1 && data.data.labelsY.length === 1) {
          $("#drill-punchcard-table").addClass("single-point");
      } else {
        $("#drill-punchcard-table").removeClass("single-point");
        $(".has-sticky-cols").each(function() {
          var original = $(this);
          var copy = $(original[0].outerHTML);
          var newId = copy.attr("id") + "-sticky-cols";
          if ($("#" + newId).length == 0) {
            /* elements */
            copy.find("td:not(.sticky-col)").remove()
            copy.find("th:not(.sticky-col)").remove()
            copy.addClass("sticky-cols-table").removeClass("has-sticky-cols").attr("id", newId).addClass("inherits-drill-punchcard-table")
            copy.find("tr, td").each(function() {
              var copiedElement = $(this);
              if (copiedElement.attr("id")) {
                copiedElement.attr("id", copiedElement.attr("id") + "-sticky")
              }
            })
            original.parent().parent().prepend(copy);
            copy.addClass("table-shadow");

          }
        })
        $(".has-sticky-header").each(function() {
          var original = $(this);
          var copy = $(original[0].outerHTML);
          var newId = copy.attr("id") + "-sticky-header";
          copy.find("tbody").remove();
          copy
            .removeClass("has-sticky-header")
            .addClass("sticky-header-table")
            .attr("id", newId);
          if (!copy.hasClass("sticky-cols-table")) {
            copy.addClass("sync-hscroll");
          }
          $("#sticky-header-wrapper").prepend(copy);

        })
      }
      addTooltip($("#drill-punchcard"));
      function addTooltip(placeHolder) {
        placeHolder.find('.punchcard-x-value > div, .punchcard-y-value').tooltipster({
            animation: "fade",
            animationDuration: 50,
            delay: 100,
            zIndex: 300,
            theme: 'tooltipster-borderless',
            trigger: 'custom',
            triggerOpen: {
                mouseenter: true,
                touchstart: true
            },
            triggerClose: {
                mouseleave: true,
                touchleave: true
            },
            interactive: true,
            contentAsHTML: true,
            functionInit: function(instance, helper) {
                var origin = $(helper.origin);
                var text = origin.attr("data-tooltip");

                if (text) {
                  instance.content(text);
                }
                instance.option("side", origin.attr('data-side'));

            }
        });

        function getTooltipText(jqueryEl) {
            return "";
        }
      }
    },
    drawMap:function () {
        $("#empty-graph").hide();
        $("#drill").find("#geo-chart").show();
        $("#drill").find("#dashboard-graph").hide();

        var values = this.getFilterTickValues(),
            mapData = [];

        for (var i = 0; i < values.length; i++) {
            mapData.push({
                country:values[i].tick,
                value:values[i].data
            });
        }

        countlyMapHelper.drawGeoChart({height:335}, mapData);
    },
    getExportAPI: function(tableID){
        if(tableID === 'drill-table'){
            var requestPath = countlyCommon.API_PARTS.data.r + "?api_key="+countlyGlobal.member.api_key+
                "&app_id="+countlyCommon.ACTIVE_APP_ID+"&method=segmentation&list=true&iDisplayStart=0&iDisplayLength=10000" +
                "&event="+countlySegmentation.getEvent() + "&queryObject=" + JSON.stringify(this.getFilterObjAndByVal().dbFilter) +
                "&period="+countlyCommon.getPeriodForAjax() + "&bucket=" + countlySegmentation.getBucket() +
                "&projectionKey=" + countlySegmentation.getProjectionSignature(this.getFilterObjAndByVal().byVal)+
                "&skip=0&limit=10000&sEcho=2&iColumns=6&sColumns=&mDataProp_0=curr_segment&mDataProp_1=u&mDataProp_2=t&mDataProp_3=a&mDataProp_4=dur&mDataProp_5=adur&iSortCol_0=1&sSortDir_0=desc&iSortingCols=1&bSortable_0=true&bSortable_1=true&bSortable_2=true&bSortable_3=false&bSortable_4=true&bSortable_5=false"

            requestPath = requestPath.split('"').join('&quot;');

            var apiQueryData = {
                api_key: countlyGlobal.member.api_key,
                app_id: countlyCommon.ACTIVE_APP_ID,
                path: requestPath,
                method: "GET",
                filename:"Drill_on_" + moment().format("DD-MMM-YYYY"),
                prop: ['data']
            };
            return apiQueryData;
        }
    },
    getFilterTicks:function (needUnique) {
        var data = this.drillChartDP.bar[this.graphVal].ticks,
            ticks = [];

        for (i = 0; i < data.length; i++) {
            ticks.push(data[i][1]);
        }

        ticks = _.compact(ticks);
        ticks.sort();

        if (needUnique) {
            return _.uniq(ticks);
        } else {
            return ticks;
        }
    },
    getFilterTickValues:function () {
        var ticks = _.sortBy(this.drillChartDP.bar[this.graphVal].ticks, function(arr) { return arr[0]; }),
            tickValues = _.sortBy(this.drillChartDP.bar[this.graphVal].dp[0]["data"], function(arr) { return arr[0]; }),
            combinedArr = [];

        for (var i = 0; i < ticks.length; i++) {
            if (!ticks[i]) {
                continue;
            }

            if (typeof tickValues[i][1] == "undefined" || !tickValues[i][1]) {
                tickValues[i][1] = 0;
            }

            combinedArr.push({
                tick:ticks[i][1],
                data:Math.round(tickValues[i][1]*100) / 100
            });
        }

        combinedArr = _.sortBy(combinedArr, function(obj) { return obj.tick; });

        return combinedArr;
    },
    isFilterInt:function () {
        var vals = this.getFilterTicks(),
            isInt = true;

        for (var i = 0; i < vals.length; i++) {
            if(!_.isNumber(vals[i])) {
                isInt = false;
                break;
            }
        }

        return isInt;
    },
    isFilterDate:function () {
        var vals = this.getFilterTicks(),
            isDate = true;

        for (var i = 0; i < vals.length; i++) {
            if(!_.isNumber(vals[i]) || (vals[i] + "").length != 10) {
                isDate = false;
                break;
            }
        }

        return isDate;
    },
    initBuckets:function() {
        var numberOfDays = countlyCommon.periodObj.numberOfDays,
            period = countlyCommon.getPeriod(),
            currBucket = countlySegmentation.getBucket(),
            $graphSettings = $(".graph-settings"),
            showBuckets = false;
        
        $graphSettings.find(".bucket .button").hide();
        $graphSettings.find(".bucket").hide();
        var allowedBuckets = {};
        
        if (this._task) {
            var request = countlyTaskManager.getResult(this._task).request;
            if (request && request.json && request.json.bucket) {
                allowedBuckets[request.json.bucket] = true;
            }
            else {
                allowedBuckets["daily"] = true;
            }
        }
        else {
            if (numberOfDays == 1) {
                allowedBuckets["hourly"] = true;
            } else {
                if (numberOfDays <= 7) {
                    allowedBuckets["hourly"] = true;
                    allowedBuckets["daily"] = true;
                }
                else {
                    if (numberOfDays >= 30) {
                        allowedBuckets["weekly"] = true;
                        allowedBuckets["daily"] = true;
                    }
        
                    if (numberOfDays >= 60) {
                        allowedBuckets["monthly"] = true;
                    }
                }
            }
            
            if (period === "day") {
                allowedBuckets["daily"] = true;
            }
            
            if (period === "month") {
                allowedBuckets["monthly"] = true;
            }
        }
        
        var buckets = Object.keys(allowedBuckets);
        
        if(buckets.indexOf(currBucket) === -1){
            currBucket = buckets[0];
        }
        
        for (var i = 0; i < buckets.length; i++) {
            $graphSettings.find(".bucket .button[data-bucket=" + buckets[i] + "]").show();
        }
        
        if (buckets.length > 1) {
            showBuckets = true;
        }
        
        if (currBucket) {
            this.graphBucket = currBucket;
            countlySegmentation.setBucket(currBucket);
        } else {
            this.graphBucket = "daily";
            countlySegmentation.setBucket("daily");
        }
        $graphSettings.find(".bucket .button").removeClass("active");
        $graphSettings.find(".bucket .button[data-bucket="+this.graphBucket+"]").addClass("active");
        
        if (this.graphType == "line" && showBuckets && !countlySegmentation.isHistogram() && !countlySegmentation.isMap()) {
            $graphSettings.find(".bucket").show();
        }
        
        var bucketButtons = $graphSettings.find(".bucket .button");
        
        bucketButtons.removeClass("first").removeClass("last");
        bucketButtons.not(':hidden').first().addClass("first");
        bucketButtons.not(':hidden').last().addClass("last");
        
        $graphSettings.find(".value.button-selector .button").removeClass("active");
        $graphSettings.find(".value.button-selector .button[data-value=" + this.graphVal + "]").addClass("active");
        
    },
    fillTable:function() {
        var currEvent = countlySegmentation.getEvent();
        var self = this;
        var hasSum = false;
        var hasDuration = false;
        if (this.dtable) {
            this.dtable.fnDestroy();
        }
        if (this.byVal == "") {
            this.drillChartData = countlySegmentation.getSegmentationDP().chartData;

            $("#drill-table-for").hide();

            var aoColumns = [
                { "mData": "date", "sType":"customDate", "sTitle": jQuery.i18n.map["common.date"] },
                { "mData": "u", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["drill.users"] },
                { "mData": "t", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["drill.times"] },
                { "mData": "a", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["drill.times-users"] }
            ];

            if (currEvent != "[CLY]_session" && currEvent != "[CLY]_crash" && currEvent != "[CLY]_view") {
                aoColumns.push({ "mData": "s", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["drill.sum"] });
                aoColumns.push({ "mData": "as", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["drill.sum-users"] });
            }
            if (currEvent != "[CLY]_crash") {
                aoColumns.push({ "mData": "dur", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatSecond(d); }, "sTitle": jQuery.i18n.map["drill.dur"] });
                aoColumns.push({ "mData": "adur", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatSecond(d); }, "sTitle": jQuery.i18n.map["drill.dur-users"] });
            }
            this.dtable = $('#drill-table').dataTable($.extend({}, $.fn.dataTable.defaults, {
                "aaData": this.drillChartData || [],
                "aoColumns": aoColumns
            }));
        }
        else if (this.graphType != "line" || countlySegmentation.isHistogram() || countlySegmentation.isMap()) {
            this.drillChartData = countlySegmentation.getSegmentationDPWithProjection().aggregatedChartData;

            $("#drill-table-for").hide();
            if (countlySegmentation.isMap()) {
                for (var i = 0; i < this.drillChartData.length; i++) {
                    this.drillChartData[i].curr_segment = countlyLocation.getCountryName(this.drillChartData[i].curr_segment);
                }
            }
            var shouldSort = countlySegmentation.isMap() ? true : false;
            var aoColumns = [
                { "mData": "curr_segment", "mRender":function(d) { return countlySegmentation.getMultiUserPropertyLongName(self.byVal, d); }, "sTitle": jQuery.i18n.map["events.table.segmentation"] },
                { "mData": "u", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["drill.users"] },
                { "mData": "t", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["drill.times"] },
                { "mData": "a", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["drill.times-users"], bSortable:shouldSort}
            ];

            if (currEvent != "[CLY]_session" && currEvent != "[CLY]_crash" && currEvent != "[CLY]_view") {
                hasSum = true;
                aoColumns.push({ "mData": "s", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["drill.sum"] });
                aoColumns.push({ "mData": "as", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["drill.sum-users"], bSortable:shouldSort });
            }
            if (currEvent != "[CLY]_crash") {
                hasDuration = true;
                aoColumns.push({ "mData": "dur", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatSecond(d); }, "sTitle": jQuery.i18n.map["drill.dur"] });
                aoColumns.push({ "mData": "adur", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatSecond(d); }, "sTitle": jQuery.i18n.map["drill.dur-users"], bSortable:shouldSort });
            }
            if (countlySegmentation.isMap()) {
                this.dtable = $('#drill-table').dataTable($.extend({}, $.fn.dataTable.defaults, {
                    "aaData": this.drillChartData || [],
                    "aoColumns": aoColumns
                }));
            } else{
                var byValData = this.byVal;
                var dbFilterData = this.filterObj;
                var period = countlyCommon.getPeriod();
                if (Object.prototype.toString.call(period) === '[object Array]'){
                    period = JSON.stringify(period);
                }
                
                var limit = countlyGlobal.projection_limit;
                if (countlyGlobal.apps && countlyGlobal.apps[countlyCommon.ACTIVE_APP_ID] && countlyGlobal.apps[countlyCommon.ACTIVE_APP_ID].plugins && countlyGlobal.apps[countlyCommon.ACTIVE_APP_ID].plugins.drill && typeof countlyGlobal.apps[countlyCommon.ACTIVE_APP_ID].plugins.drill.projection_limit !== "undefined") {
                    limit = countlyGlobal.apps[countlyCommon.ACTIVE_APP_ID].plugins.drill.projection_limit;
                }
                        
                this.dtable = $('#drill-table').dataTable($.extend({}, $.fn.dataTable.defaults, {
                    "aaSorting": [[ 1, "desc" ]],
                    "bServerSide": true,
                    "bFilter": false,
                    "iDisplayLength": limit,
                    "sAjaxSource": countlyCommon.API_PARTS.data.r + "?api_key="+countlyGlobal.member.api_key+"&app_id="+countlyCommon.ACTIVE_APP_ID+"&method=segmentation&list=true",
                    "fnServerData": function ( sSource, aoData, fnCallback ) {
                            self.request = $.ajax({
                                "dataType": 'json',
                                "type": "POST",
                                "url": sSource,
                                "data": aoData,
                                "success": function(data){
                                    var limit = 0;
                                    var skip = 0;
                                    var find = 2;
                                    var found = 0;
                                    for(var i = 0; i <  aoData.length; i++){
                                        if(aoData[i].name === "iDisplayStart"){
                                            skip = aoData[i].value;
                                            found++;
                                        }
                                        if(aoData[i].name === "iDisplayLength"){
                                            limit = aoData[i].value;
                                            found++;
                                        }
                                        if(found === find){
                                            break;
                                        }
                                    }
                                    var total = skip + limit*2;
                                    if(data.page_data && data.page_data.total)
                                        total = data.page_data.total;
                                    data.data = data.data || [];
                                    for(var i = 0; i < data.data.length; i++){
                                        data.data[i].curr_segment = data.data[i]._id;
                                        data.data[i].a = countlyCommon.safeDivision(data.data[i].t, data.data[i].u);
                                        data.data[i].as = countlyCommon.safeDivision(data.data[i].s, data.data[i].u);
                                        data.data[i].adur = countlyCommon.safeDivision(data.data[i].dur, data.data[i].u);
                                    }
                                    var tdata = {sEcho:aoData.sEcho, iTotalRecords:total, iTotalDisplayRecords:total, aaData:data.data};
                                    fnCallback(tdata);
                                }
                            });
                    },
                    "fnServerParams": function ( aoData ) {
                        var skip = 0;
                        var sort = {};
                        var sortCol = "u";
                        var sortDir = -1;
                        var find = 4;
                        var found = 0;
                        var columns = ["_id","u","t",null];
                        var limit = countlyGlobal.projection_limit;
                        if (countlyGlobal.apps && countlyGlobal.apps[countlyCommon.ACTIVE_APP_ID] && countlyGlobal.apps[countlyCommon.ACTIVE_APP_ID].plugins && countlyGlobal.apps[countlyCommon.ACTIVE_APP_ID].plugins.drill && typeof countlyGlobal.apps[countlyCommon.ACTIVE_APP_ID].plugins.drill.projection_limit !== "undefined") {
                            limit = countlyGlobal.apps[countlyCommon.ACTIVE_APP_ID].plugins.drill.projection_limit;
                        }
                        if(hasSum){
                            columns.push("s");
                            columns.push(null);
                        }
                        if(hasDuration){
                            columns.push("dur");
                            columns.push(null);
                        }
                        for(var i = 0; i <  aoData.length; i++){
                            if(aoData[i].name === "iDisplayStart"){
                                skip = aoData[i].value;
                                found++;
                            }
                            if(aoData[i].name === "iDisplayLength"){
                                limit = aoData[i].value;
                                found++;
                            }
                            if(aoData[i].name === "iSortCol_0"){
                                if(columns[aoData[i].value]){
                                    sortCol = columns[aoData[i].value];
                                }
                                found++;
                            }
                            if(aoData[i].name === "sSortDir_0"){
                                if(aoData[i].value === "asc")
                                    sortDir = 1;
                                found++;
                            }
                            if(found === find){
                                break;
                            }
                        }
                        sort[sortCol] = sortDir;
                        aoData.push( { "name": "event", "value": currEvent } );
                        aoData.push( { "name": "queryObject", "value": JSON.stringify(dbFilterData) } );
                        aoData.push( { "name": "period", "value": period } );
                        aoData.push( { "name": "bucket", "value": countlySegmentation.getBucket() } );
                        aoData.push( { "name": "projectionKey", "value": countlySegmentation.getProjectionSignature(byValData) } );
                        aoData.push( { "name": "skip", "value": skip } );
                        aoData.push( { "name": "limit", "value": limit } );
                        aoData.push( { "name": "sort", "value": JSON.stringify(sort) } );
                    },
                    "aoColumns": aoColumns,
                    "fnInitComplete": function(oSettings, json) {
                        $.fn.dataTable.defaults.fnInitComplete(oSettings, json);
                        var tableWrapper = $("#" + oSettings.sTableId + "_wrapper");
                        tableWrapper.find(".dataTables_length").show();
                    }
                }));
            }
        }
        else {
            this.drillChartData = countlySegmentation.getSegmentationDPWithProjection().chartData;

            var tableForStr = "",
                firstSegment = "";

            for (var segment in this.drillChartData) {
                firstSegment = segment;
                break;
            }

            for (var segment in this.drillChartData) {
                var tmpItem = $("<div>");

                tmpItem.addClass("item");
                if (segment === "") {
                  segment = "N/A";
                }
                tmpItem.attr("data-value", segment);

                tmpItem.text(countlySegmentation.getMultiUserPropertyLongName(this.byVal, segment));

                tableForStr += tmpItem.prop('outerHTML');
            }

            var tableFor = (this.activeSegmentForTable)? this.activeSegmentForTable : firstSegment;

            if (!_.isEmpty(this.drillChartData)) {
                $("#drill-table-for").find(".text").text(countlySegmentation.getMultiUserPropertyLongName(this.byVal, tableFor));
                $("#drill-table-for").find(".text").data("value", tableFor);
                $("#drill-table-for").find(".select-items>div").html(tableForStr);
                $("#drill-table-for").show();
            } else {
                $("#drill-table-for").hide();
            }

            var aoColumns = [
                { "mData": "date", "sType":"customDate", "sTitle": jQuery.i18n.map["common.date"] },
                { "mData": "u", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["drill.users"] },
                { "mData": "t", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["drill.times"] },
                { "mData": "a", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["drill.times-users"] }
            ];

            if (currEvent != "[CLY]_session" && currEvent != "[CLY]_crash" && currEvent != "[CLY]_view") {
                aoColumns.push({ "mData": "s", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["drill.sum"] });
                aoColumns.push({ "mData": "as", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatNumber(d); }, "sTitle": jQuery.i18n.map["drill.sum-users"] });
            }
            if (currEvent != "[CLY]_crash") {
                aoColumns.push({ "mData": "dur", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatSecond(d); }, "sTitle": jQuery.i18n.map["drill.dur"] });
                aoColumns.push({ "mData": "adur", sType:"formatted-num", "mRender":function(d) { return countlyCommon.formatSecond(d); }, "sTitle": jQuery.i18n.map["drill.dur-users"] });
            }

            var drillChartCol = tableFor;

            this.dtable = $('#drill-table').dataTable($.extend({}, $.fn.dataTable.defaults, {
                "aaData": this.drillChartData[drillChartCol] || [],
                "aoColumns": aoColumns
            }));
        }

        $("#drill-table").stickyTableHeaders();

        var self = this;
        $("#drill-table-for").find(".item").on("click", function() {
            self.activeSegmentForTable = $(this).data("value");
            self.fillTable();
        });
    },
    bookmarkList: {},
    fillBookmarks:function() {
        var self = this;

        $.when(countlySegmentation.getBookmarks(self.bookmarkMode)).then(function(bookmarks){
            var selectedItem = $("#bookmark-table-for").find(".cly-select").find(".text");
            if (self.bookmarkMode !== selectedItem.data("value") && self.bookmarkMode !== undefined){
              selectedItem.text($("#bookmark-table-for").find(".cly-select").find(".item[data-value='" + self.bookmarkMode + "']").text());
              selectedItem.data("value", self.bookmarkMode);
            }
            var newBookmarkBody = "";
            self.bookmarks = bookmarks;
            for (var i = 0; i < bookmarks.length; i++) {
                if (bookmarks[i].query_obj) {
                    bookmarks[i].query_obj = _.unescape(bookmarks[i].query_obj);
                }
                self.bookmarkList[bookmarks[i]._id] = bookmarks[i];
                newBookmarkBody +=
                    "<tr>" +
                        "<td>  <div class='fa fa-play-circle bookmark-action apply' data-id='" + bookmarks[i]._id + "' data-query='" + (bookmarks[i].query_obj || "") + "' data-by-val='" + (bookmarks[i].by_val || "") + "'></div> </td>" +
                        "<td>" + (bookmarks[i].name || "") + "<div class='bookmark-desc'>"+(bookmarks[i].desc || "") +"</div></td>" +
                        "<td>" + (bookmarks[i].global === false ? '私有' : '公共') + "</td>"  +
                        "<td>" + (bookmarks[i].query_text || "-").replace(/]/g, "]<br>") + "</td>" +
                        "<td>" +
                            "<div class='bookmark-options'><div class='bookmark-name'>" + (bookmarks[i].by_val_text || "-") +
                                "</div><div class='edit'>" +
                                    "<div class='edit-menu'>" +
                                        "<div class='edit-bookmark item'" + " id='" + bookmarks[i]._id + "'" + " ><i class='fa fa-pencil'></i>" + jQuery.i18n.map["drill.bookmark-edit"] +"</div>" +
                                        "<div class='delete-bookmark item'" + " id='" + bookmarks[i]._id + "'"  + " ><i class='fa fa-trash'></i>" + jQuery.i18n.map["drill.bookmark-delete"] +"</div>" +
                                    "</div>" +

                            "</div>"+
                        "</td>" +
                    "</tr>";
            }

            if (bookmarks.length == 0) {
                newBookmarkBody =
                    "<tr>" +
                        "<td colspan='5' class='table-no-data'>" + jQuery.i18n.map["common.table.no-data"]  + "</td>" +
                    "</tr>";
            }

            $("#drill-bookmark-body").html(newBookmarkBody);

            // app.localize();

            $(".bookmark-options .edit").off("click").on("click", function(){
                $("#actions-popup").fadeOut();
                $(".edit-menu").fadeOut();
                ($(this).children('.edit-menu')).fadeToggle()
                event.stopPropagation();
            })
            $(".delete-bookmark").off("click").on("click", function(e){
                var bookmarkId = e.target.id;

                CountlyHelpers.confirm(jQuery.i18n.map["drill.bookmark-delete-remind"], "popStyleGreen", function (result) {
                    if (!result) {
                        return true;
                    }

                    $.ajax({
                        type:"GET",
                        url:countlyGlobal["path"]+"/i/drill/delete_bookmark",
                        data:{
                            "bookmark_id": bookmarkId,
                            "app_id": countlyCommon.ACTIVE_APP_ID,
                            "api_key":countlyGlobal["member"].api_key
                        },
                        success:function(res) {
                            if (res == false) {
                                CountlyHelpers.alert(jQuery.i18n.map["drill.bookmark-error"], "red");
                            }
                            self.fillBookmarks();
                        }
                    });
                },[jQuery.i18n.map["common.no-dont-delete"],jQuery.i18n.map["drill.bookmark-delete-confirm"]],{title:jQuery.i18n.map["drill.bookmark-delete-confirm-title"] ||jQuery.i18n.map["errorlogs.confirm-delete-title"],image:"delete-bookmark"});

            });
            $(".edit-bookmark").off("click").on("click", function(e){
                var bookmarkId = e.target.id;
                var record = null;
                for(var i = 0; i < self.bookmarks.length; i++){
                    if(self.bookmarks[i]._id === bookmarkId){
                        record = self.bookmarks[i];
                    }
                }
                if(record){
                    $("#current_bookmark_id").text(bookmarkId);
                    $("#bookmark-name-input").val(record.name);
                    $("#bookmark-desc-input").val(record.desc);
                    if(record.global === false){
                        $("#global-option").removeClass("selected");
                        $("#private-option").addClass("selected");
                    }else{
                        $("#global-option").addClass("selected");
                        $("#private-option").removeClass("selected");
                    }
                }
                $("#add-bookmark-title").css("display","none")
                $("#edit-bookmark-title").css("display","block")
                $("#bookmark-widget-drawer").addClass("open");

            })
            var hasMessaging = false;
            var a = countlyGlobal['apps'][countlyCommon.ACTIVE_APP_ID];
            if ((a.apn && (a.apn.test || a.apn.prod)) || (a.gcm && a.gcm.key)) {
                if (countlyGlobal['admin_apps'][a._id]) {
                    hasMessaging = true;
                }
            }
            if (hasMessaging) {
                $('#bookmark-view').find('th').first().css({width: '75px'});
                $('#bookmark-view').find('.bookmark-action.send').show();
            } else {
                $('#bookmark-view').find('th').first().css({width: '45px'});
                $('#bookmark-view').find('.bookmark-action.send').hide();
            }
        });
    },
    initialize:function () {
        $.when($.get(countlyGlobal["path"]+'/drill/templates/filter-view.html', function(src){
            Handlebars.registerPartial("filter-view", src);
        })).then(function () {});
    },
    dateChanged:function () {
        if(this._task) {
            if(JSON.stringify(this._filter.dbFilter) == "{}" && this._filter.byVal == "")
                app.navigate("/drill", false);
            else
                app.navigate("/drill/"+JSON.stringify({event:countlySegmentation.getActiveEvent() || "[CLY]_session", dbFilter:this._filter.dbFilter, byVal:this._filter.byVal || ""}), false);
        }
        this._task = null;
        this.taskReportRemind();
        countlySegmentation.clearBucket();
        this.draw(true, true);
    },
    bookmarkInputValidator: function (){
        var bookmark_name = $("#bookmark-name-input").val();
        var bookmark_desc = $("#bookmark-desc-input").val();
        if(!bookmark_name || !bookmark_desc ){
            $("#create-bookmark").addClass("disabled")
            return false;
        }
        $("#create-bookmark").removeClass("disabled")
        return true;
    },
    reporInputValidator: function (){
        var report_name = $("#report-name-input").val();
        var report_desc = $("#report-desc-input").val();
        // var global = $("#report-global-option").hasClass("selected") || false;
        var autoRefresh = $("#report-refresh-option").hasClass("selected");
        var period = $("#single-period-dropdown").clySelectGetSelection();
        if(!report_name || (autoRefresh && ! period)){
            $("#create-report").addClass("disabled")
            return false;
        }
        $("#create-report").removeClass("disabled")
        return true;
    },
    onScroll: function(event) {
      var self = this;
      if($("#drill-punchcard-table").hasClass("single-point")){
        return;
      }
      if(event.target==document){
        var topBarHeight = $("#top-bar").outerHeight();
        var cutOffAdd = $("#drill-punchcard-types").outerHeight();
        if ($("#top-bar").is(":visible") && topBarHeight) {
            cutOffAdd += topBarHeight;
        }

        if ($(".has-sticky-header").length===0) {
          return;
        }
        var rect = $(".has-sticky-header")[0].getBoundingClientRect();
        var punchTableRect = $("#drill-punchcard")[0].getBoundingClientRect();
        var isPunchTableInViewport = (punchTableRect.top + punchTableRect.height) > 150;

        if(rect.top > cutOffAdd || !isPunchTableInViewport){
          $("#sticky-header-wrapper").addClass("hidden");
          $("#drill-punchcard-types").removeClass("sticky");
        }else{
          var currentHeight = parseInt($("#sticky-header-wrapper").css("height").replace("px",""))
          $("#sticky-header-wrapper").children().each(function(){
              var inner = parseInt($(this).css("height").replace("px",""))
              if(currentHeight<inner){
                currentHeight=inner;
              }
          })
          $("#sticky-header-wrapper").css({height:currentHeight-1, top:cutOffAdd-1}).removeClass("hidden");
          $("#drill-punchcard-types").addClass("sticky").css({top: topBarHeight});
          self.updateStickyHeader()
        }
      } else if(event.target.id == "drill-punchcard-container") {
        $(".sync-hscroll").css("left", -event.target.scrollLeft);
      }

    },
    onResize: function() {
      var self = this;
      var container = $("#drill-punchcard-container");
      var table = $("#drill-punchcard-table");

      if (container.width() < table.width()) {
        $("#drill-punchcard-table-sticky-cols")
          .addClass("table-shadow")
          .addClass("scrolling")
          .removeClass("not-scrolling");
        container.addClass("scrolling").removeClass("not-scrolling");
      } else {
        $("#drill-punchcard-table-sticky-cols")
          .removeClass("table-shadow")
          .addClass("not-scrolling")
          .removeClass("scrolling");
        container.addClass("not-scrolling").removeClass("scrolling");
      }
      self.updateStickyHeader();

    },
    updateStickyHeader:function(){
      var element = document.getElementById("table-area")
      if(!element){
        return;
      }
      var bound = element.getBoundingClientRect()
      $("#sticky-header-wrapper").css({
        width:bound.width,
        left: bound.left
      })

    },
    initializeEventListeners: function(){
      var self = this;

      if (self.eventsInitialized){
        return;
      }

      self.eventListenerDestroyers = [];

      var scrollFunction = function(event) {
        self.onScroll(event)
      }

      var resizeFunction = function(){
        self.onResize();
      }

      document.addEventListener('scroll', scrollFunction, true);
      $(document).resize(resizeFunction);
      $("#content-container").resize(resizeFunction);

      self.eventListenerDestroyers.push(function(){
        document.removeEventListener('scroll', scrollFunction, true);
      });

      self.eventListenerDestroyers.push(function(){
        $(document).off("resize", resizeFunction);
        $("#content-container").off("resize", resizeFunction);
      })

      self.eventsInitialized = true;

    },
    destroyEventListeners:function(){
      var self = this;
      if(self.eventListenerDestroyers){
        self.eventListenerDestroyers.forEach(function(d){
          d();
        })
        self.eventListenerDestroyers = [];
        self.eventsInitialized = false;
      }
    },
    destroy:function(){
      this.destroyEventListeners();
    },
    activateKeyboardNavigation: function(){
      if (self.keyboardNav === true){
        return;
      }
      self.keyboardNav = true;
      $("body").on("keydown", ".cly-select-keynav:not(.big-list) input", function(e) {
          var clySelect = $(this).parents(".cly-select-keynav");
          clySelect.find(".hidden.navigating").removeClass("navigating");
          clySelect.find(".selected.navigating").removeClass("navigating");
          var navigating = clySelect.find(".item.navigating:not(.hidden):not(.selected)");
          if (e.keyCode === 40) {
            var nextItem = navigating.removeClass("navigating").nextAll(':not(.group):not(.hidden):not(.selected):first');
            if(nextItem.length === 0) {
              nextItem = clySelect.find('.item:not(.hidden):not(.selected):first');
            }
            nextItem.addClass("navigating");
          } else if (e.keyCode === 38) {
            var prevItem = navigating.removeClass("navigating").prevAll(":not(.group):not(.hidden):not(.selected):first");
            if(prevItem.length === 0) {
              prevItem = clySelect.find('.item:not(.hidden):not(.selected):last');
            }
            prevItem.addClass("navigating");
          } else if (e.keyCode === 13) {
            if (clySelect.hasClass("cly-multi-select")) {
              var nextItem = navigating.trigger("click").removeClass("navigating").nextAll(':not(.group):not(.hidden):not(.selected):first');
              if(nextItem.length === 0) {
                nextItem = clySelect.find('.item:not(.hidden):not(.selected):first');
              }
              nextItem.addClass("navigating");
            }else{
              navigating.trigger("click").removeClass("navigating");
            }
          } else if (e.keyCode === 27) {
            clySelect.find(".right.combo").trigger("click");
            navigating.removeClass("navigating");
          } else if (e.keyCode === 8){
            if (clySelect.hasClass("cly-multi-select") && $(this).val() === ""){
              clySelect.find(".selection:last .remove").trigger("click");
            }
          }
          navigating = clySelect.find(".item.navigating:not(.hidden):not(.selected)");
          if (navigating.length !== 0) {
            var navAbsoluteTop = navigating.get(0).getBoundingClientRect().top;
            var scrollHead = clySelect.find(".scroll-list").get(0).getBoundingClientRect().top;
            var offset = navAbsoluteTop - scrollHead;
            var slist = clySelect.find(".scroll-list");
            var windowHeight = slist.height();
            var listHeight = 0;
            slist.children().each(function(){
              listHeight += $(this).get(0).getBoundingClientRect().height;
            });
            var barHeight =  clySelect.find(".slimScrollBar").height();
            var barMultiplier = (windowHeight-barHeight)/(listHeight-windowHeight);
            slist.get(0).scrollTop += offset;
            var scrollTop = Math.max(0, Math.min(parseInt(clySelect.find(".slimScrollBar").css("top").replace("px","")) + barMultiplier*offset, windowHeight-barHeight));
            clySelect.find(".slimScrollBar").css("top", scrollTop + "px");
          }
      });
    },
    pageScript:function () {
        var self = this;
        $(document).ready(function() {

            self.initDrill();
            self.activateKeyboardNavigation();
            var currEvent = "[CLY]_session",
                drillClone,
                $segmentation = $("#segmentation"),
                $drillTabs= $("#drill-tabs"),
                $graphSettings = $(".graph-settings");


            $("#bookmark-table-for").find(".item").on("click", function() {
                self.bookmarkMode = $(this).data("value");
                self.fillBookmarks();
            });

            var setSelectorStatus = function(clyWideboxSelect, status){
                var _square = clyWideboxSelect.find(".main-square");
                var _toggler = clyWideboxSelect.find(".select-toggler");
                var _arrow = _toggler.find(".arrow");

                var show = function(){
                  _toggler.addClass('active');
                  _square.show();
                  _arrow.addClass("ion-chevron-up").removeClass("ion-chevron-down");
                  if ($("#drill-type-events").hasClass("active")){
                     $(".event-select input").focus();
                  }
                }

                var hide = function(){
                  _toggler.removeClass('active');
                  _square.hide();
                  _arrow.removeClass("ion-chevron-up").addClass("ion-chevron-down");
                  $(".event-select input").val("").trigger("input");
                }

                // toggle unless status is explicitly stated
                if(status === true){
                  show();
                } else if (status === false){
                  hide();
                } else if (_toggler.hasClass('active')) {
                  hide();
                } else {
                  show();
                }
            }

            var setSelectorContent = function(clyWideboxSelect, title){
                if(title!="" && title !== undefined && title!==null){
                  clyWideboxSelect.find(".select-toggler .text").text(title);
                }
            }

            $(".cly-widebox-select").on("click", ".select-button .item", function() {
              var _this = $(this);
              if(!_this.hasClass("two-phase-selector")){
                  setSelectorStatus(_this.closest(".cly-widebox-select"), false);
                  setSelectorContent(_this.closest(".cly-widebox-select"), _this.find(".text").text())
                  $("#selector-no-event").hide();
              }
            })

            var onDrillTypeSelector = false;

            var typeSelectInstance = $('#drill-type-select');

            typeSelectInstance.hover(function(){
                onDrillTypeSelector = true;
            }, function(){
                onDrillTypeSelector = false;
            });

            if (self.typeSelectBodyCallback) {
              $('body').unbind("mouseup", self.typeSelectBodyCallback);
            }

            self.typeSelectBodyCallback = function(){
                if(!onDrillTypeSelector) {
                  setSelectorStatus(typeSelectInstance, false);
                }
            }

            $('body').mouseup(self.typeSelectBodyCallback);

            $(".select-toggler").on("click", function() {
                setSelectorStatus($(this).parent())
            });

            $("#drill-type-sessions").on("click", function() {
                if ($(this).hasClass("active")) {
                    return true;
                }

                $("#drill-types").find(".item").removeClass("active");
                $(this).addClass("active");
                $("#event-selector").hide();

                $("#drill-no-event").fadeOut();

                currEvent = "[CLY]_session";

                self.graphType = "line";
                self.graphVal = "times";
                self.filterObj = {};
                self.byVal = "";
                self.drillChartDP = {};
                self.drillChartData = {};
                self.activeSegmentForTable = "";
                countlySegmentation.reset();

                $.when(countlySegmentation.initialize(currEvent)).then(function () {
                    $("#drill").replaceWith(drillClone.clone(true));
                    self.adjustFilters();
                    self.draw(true, false);
                    $(".bucket").find(".button").removeClass("active");
                    $(".bucket").find(".button[data-bucket='" + countlySegmentation.getBucket() + "']").addClass("active");

                    setTimeout(function () {
                        if (countlyCommon.getPersistentSettings().drillMetricType)
                            $(".value").find(".button[data-value='" + countlyCommon.getPersistentSettings().drillMetricType + "']").trigger('click');

                        if (countlyCommon.getPersistentSettings().drillBucket)
                            $(".bucket").find(".button[data-bucket='" + countlyCommon.getPersistentSettings().drillBucket + "']").trigger('click');

                    }, 300);
                });
            });

            var afterEventSelect = function(){
              $("#drill-no-event").fadeOut();

              self.graphType = "line";
              self.graphVal = "times";
              self.filterObj = {};
              self.byVal = "";
              self.drillChartDP = {};
              self.drillChartData = {};
              self.activeSegmentForTable = "";
              countlySegmentation.reset();

              $.when(countlySegmentation.initialize(currEvent)).then(function () {
                  $("#drill").replaceWith(drillClone.clone(true));
                  self.adjustFilters();
                  self.draw(true, false);
              });
              $(".event-select").data("value", currEvent);
              setSelectorContent($("#drill-type-select"), $("#drill-type-events").find(".text").text()+", "+currEvent)
            }

            var loadEventsMenu = function(element, initial, callAfterEvents){
              var allEvents = countlyEvent.getEvents(),
                  eventStr = "";

              if (allEvents.length === 0){
                $("#event-selector").hide();
                $("#selector-no-event").show();
                return;
              } else {
                $("#selector-no-event").hide();
              }

              for (var i = 0; i < allEvents.length; i++) {
                  var tmpItem = $("<div>");

                  tmpItem.addClass("item").addClass("searchable").addClass("in-subset");
                  tmpItem.attr("data-value", allEvents[i].key);
                  tmpItem.text(allEvents[i].name);

                  eventStr += tmpItem.prop('outerHTML');
              }

              element.find(".list").html(eventStr);
              if (initial !== undefined) {
                var matchingElement = element.find('[data-value="'+initial+'"]');
                if (matchingElement.length>0) {
                  matchingElement.addClass("active");
                  currEvent = matchingElement.data("value");
                  $(".event-select .item").hover(function(){
                    $(this).siblings().removeClass("navigating");
                  });

                  if (callAfterEvents !== false) {
                      afterEventSelect();
                  }
                }
              }
            }

            $(".event-select input").keydown(function(e) {
                var selector = ".event-select .item.in-subset.navigating";
                if (e.keyCode === 40) {
                  var nextItem = $(selector).removeClass("navigating").nextAll('.in-subset:first');
                  if(nextItem.length === 0) {
                    nextItem = $('.event-select .item.in-subset:first');
                  }
                  nextItem.addClass("navigating");
                } else if (e.keyCode === 38) {
                  var prevItem = $(selector).removeClass("navigating").prevAll(".in-subset:first");
                  if(prevItem.length === 0) {
                    prevItem = $('.event-select .item.in-subset:last');
                  }
                  prevItem.addClass("navigating");
                } else if (e.keyCode === 13) {
                  $(selector).trigger("click");
                }
                if ($(selector).length !== 0) {
                  var offset = $(selector).position().top - $(selector).parent().position().top;
                  $(selector).parent().scrollTop(offset);
                }
            });

            $('.event-search').on('input', "input", function(e) {
                var searchText = new RegExp($(this).val().toLowerCase().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')),
                    searchInside = $(this).parent().next().find(".searchable").addClass("in-subset");

                searchInside.filter(function() {
                    return !(searchText.test($(this).text().toLowerCase()));
                }).css('display', 'none').removeClass("in-subset").removeClass("navigating");

                searchInside.filter(function() {
                    return searchText.test($(this).text().toLowerCase());
                }).css('display', 'block');
            });

            $("#drill-type-events").on("click", function() {

                if ($(this).hasClass("active")) {
                    return true;
                }
                $("#drill-types").find(".item").removeClass("active");
                $(this).addClass("active");

                if ($("#event-selector").is(":visible")) {
                    $("#event-selector").hide();
                } else {
                    $("#event-selector").show();
                    $(".event-select input").focus();
                    loadEventsMenu($("#event-selector"));
                }

            });

            $(".event-select").on("click", ".item", function() {
                $(this).parent().find(".item").removeClass("active");
                $(this).addClass("active");
                currEvent = $(this).data("value");
                afterEventSelect();
                setSelectorStatus($(this).closest(".cly-widebox-select"), false);
            });



            $("#drill-filter-actions-button").off("click").on("click", function(event){
                $("#actions-popup").fadeToggle();
                event.stopPropagation();
            })
            $('#bookmark-widge-close').off("click").on("click", function () {
                $("#bookmark-widget-drawer").removeClass("open");
            });
            $("#action-add-bookmark").off("click").on("click", function(){
                $("#current_bookmark_id").text('');
                $("#bookmark-name-input").val('');
                $("#bookmark-desc-input").val('');
                $("#add-bookmark-title").css("display","block")
                $("#edit-bookmark-title").css("display","none")
                $("#bookmark-widget-drawer").addClass("open");
                app.recordEvent({
                    "key": "drill-action",
                    "count": 1,
                    "segmentation": {action: "bookmark"}
                });
            })

            $("#action-add-report").off("click").on("click", function(){
                $("#current_report_id").text('');
                $("#report-name-input").val('');
                $("#report-desc-input").val('');
                $("#report-widget-drawer").addClass("open");
                $("#create-report").addClass("disabled");
                app.recordEvent({
                    "key": "drill-action",
                    "count": 1,
                    "segmentation": {action: "report-manager"}
                });
            })



            $("#global-option").off("click").on("click", function(){
                $("#global-option").addClass("selected");
                $("#private-option").removeClass("selected");
            })
            $("#private-option").off("click").on("click", function(){
                $("#private-option").addClass("selected");
                $("#global-option").removeClass("selected");
            })

            $("#bookmark-name-input").off("keyup").on("keyup", function(){
                self.bookmarkInputValidator();
            })
            $("#bookmark-desc-input").off("keyup").on("keyup", function(){
                self.bookmarkInputValidator();
            })

            $("#create-bookmark").off("click").on("click", function(){
                var canSubmit = self.bookmarkInputValidator();
                if(!canSubmit){
                    return;
                }
                var bookmark_id =  $("#current_bookmark_id").text();
                var name = $("#bookmark-name-input").val();
                var desc = $("#bookmark-desc-input").val();
                var global = $("#global-option").hasClass("selected") || false;
                var filterData = self.getFilterObjAndByVal();
                if(!bookmark_id){
                    var data = {
                        "app_id":countlyCommon.ACTIVE_APP_ID,
                        "event_key":countlySegmentation.getActiveEvent(),
                        "query_obj":JSON.stringify(filterData.dbFilter),
                        "query_text":filterData.bookmarkText,
                        "by_val": countlySegmentation.getProjectionSignature(filterData.byVal),
                        "by_val_text":filterData.byValText,
                        "api_key":countlyGlobal["member"].api_key,
                        "name": name,
                        "desc": desc,
                        "global": global,
                        "creator": countlyGlobal.member._id
                    }
                    $.ajax({
                        type:"GET",
                        url:countlyGlobal["path"]+"/i/drill/add_bookmark",
                        data:data,
                        success:function (result) {
                            self.fillBookmarks();
                            $("#bookmark-widget-drawer").removeClass("open");
                            CountlyHelpers.notify({
                                title: jQuery.i18n.map["common.success"],
                                message: jQuery.i18n.map["drill.save-bookmark-remind"]
                            });
                        }
                    });
                }else{
                    var data = {
                        "bookmark_id" : bookmark_id,
                        "name": name,
                        "desc": desc,
                        "global": global,
                    }
                    $.ajax({
                        type:"GET",
                        url:countlyGlobal["path"]+"/i/drill/edit_bookmark",
                        data:data,
                        success:function (result) {
                            $("#drill-navigation").find(".fa-bookmark-o").animate({"zoom":'1.3'},200).animate({"zoom":'1'},200);
                            self.fillBookmarks();
                            $("#bookmark-widget-drawer").removeClass("open");
                        }
                    });
                }
            })

            ///////////report drawer
            $('#report-widge-close').off("click").on("click", function () {
                $("#report-widget-drawer").removeClass("open");
            });


            $("#report-global-option").off("click").on("click", function(){
                $("#report-global-option").addClass("selected");
                $("#report-private-option").removeClass("selected");
                self.reporInputValidator();
            })
            $("#report-private-option").off("click").on("click", function(){
                $("#report-private-option").addClass("selected");
                $("#report-global-option").removeClass("selected");
                self.reporInputValidator();
            })

            $("#report-onetime-option").off("click").on("click", function(){
                $("#report-onetime-option").addClass("selected");
                $("#report-refresh-option").removeClass("selected");
                $("#report-period-block").css("display", "none");
                self.reporInputValidator();
            })
            $("#report-refresh-option").off("click").on("click", function(){
                $("#report-refresh-option").addClass("selected");
                $("#report-onetime-option").removeClass("selected");
                $("#report-period-block").css("display", "block");
                self.reporInputValidator();
            })

            $("#single-period-dropdown").clySelectSetItems([
                { value: 'today', name: jQuery.i18n.map["drill.today"] },
                { value: '7days', name: jQuery.i18n.map["drill.last_7_days"] },
                { value: '30days', name: jQuery.i18n.map["drill.last_30_days"] },
            ]);
            $("#single-period-dropdown").clySelectSetSelection("", jQuery.i18n.map["drill.select_a_period"] );

            $("#report-name-input").off("keyup").on("keyup", function(){
                self.reporInputValidator();
            })
            $("#report-desc-input").off("keyup").on("keyup", function(){
                self.reporInputValidator();
            })
            $("#single-period-dropdown").off("cly-select-change").on("cly-select-change", function (e, selected) {
                self.reporInputValidator();
            })

            $("#create-report").off("click").on("click", function(){
                // var report_id =  $("#current_report_id").text();
                var canSubmit = self.reporInputValidator();
                if(!canSubmit){
                    return;
                }
                var report_name = $("#report-name-input").val();
                var report_desc = $("#report-desc-input").val();
                var global = $("#report-global-option").hasClass("selected") || false;
                var autoRefresh = $("#report-refresh-option").hasClass("selected");
                var period = $("#single-period-dropdown").clySelectGetSelection();
                if(autoRefresh && !period)
                    return CountlyHelpers.alert(jQuery.i18n.map["drill.report_fileds_remind"],
							"green",
							function (result) { });

                var filterData = self.getFilterObjAndByVal();
                var data = {
                    "report_name": report_name,
                    "report_desc": report_desc,
                    "global": global,
                    "autoRefresh": autoRefresh,
                    "period_desc": autoRefresh ?  period : null
                }
                return countlySegmentation.saveReportTask(data,function(){
                    $("#report-widget-drawer").removeClass("open");
                    CountlyHelpers.notify({
                        title: jQuery.i18n.map["common.success"],
                        message: autoRefresh ? jQuery.i18n.map["drill.auto-refresh-report-remind"] : jQuery.i18n.map["drill.one-time-report-remind"]
                    });
                });
            })

            $("#create-report").addClass("disabled")

            $segmentation.on("click", "#bookmark-filter:not(.disabled)", function() {
                var filterData = self.getFilterObjAndByVal();

                $.ajax({
                    type:"GET",
                    url:countlyGlobal["path"]+"/i/drill/add_bookmark",
                    data:{
                        "app_id":countlyCommon.ACTIVE_APP_ID,
                        "event_key":countlySegmentation.getActiveEvent(),
                        "query_obj":JSON.stringify(filterData.dbFilter),
                        "query_text":filterData.bookmarkText,
                        "by_val": countlySegmentation.getProjectionSignature(filterData.byVal),
                        "by_val_text":filterData.byValText,
                        "api_key":countlyGlobal["member"].api_key
                    },
                    success:function (result) {
                        $("#drill-navigation").find(".fa-bookmark-o").animate({"zoom":'1.3'},200).animate({"zoom":'1'},200);
                        self.fillBookmarks();
                    }
                });
            });

            $graphSettings.on("click", ".button", function(e) {
                if (!$(this).hasClass("active")) {
                    $(this).parents(".button-selector").find(".button").removeClass("active");
                    $(this).addClass("active");
                }
            });

            $graphSettings.find(".type .button").on("click", function() {
                if (!$(this).hasClass("active")) {
                    $("#drill").find("#dashboard-graph").html("");
                    var previous = self.graphType;
                    self.graphType = $(this).data("type");
                    var needData = (previous === "punchcard" || self.graphType === "punchcard") && previous !==  self.graphType;
                    self.draw(needData, false);
                }
            });

            $graphSettings.find(".value .button").on("click", function() {
                if (!$(this).hasClass("active")) {
                    self.graphVal = $(this).data("value");
                    self.draw(false, false);
                    countlyCommon.setPersistentSettings({ drillMetricType: self.graphVal });
                }
            });

            $graphSettings.find(".bucket .button").on("click", function() {
                if (!$(this).hasClass("active")) {
                    if(self._task){
                        self._task = null;
                        self.taskReportRemind();
                        self.loadAndRefresh(true)
                    }
                    countlySegmentation.setBucket($(this).data("bucket"));
                    self.draw(true, false);
                    countlyCommon.setPersistentSettings({ drillBucket : $(this).data("bucket")});
                }
            });

            $drillTabs.on("click", ".menu", function() {
                $("#drill-tabs").find(".menu").removeClass("active");
                $(this).addClass("active");

                $(".navigation-menu").hide();
                $("#" + $(this).data("open")).show();

                if ($(this).data("open") == "table-view") {
                    self.setTempPeriodForTask()
                    self.fillTable();
                } else if ($(this).data("open") == "bookmark-view") {
                    self.fillBookmarks();
                }
                // self.initFilterView()
            });

            $("#bookmark-view").on("click", ".bookmark-action.delete", function() {
                var bookmarkId = $(this).data("id");

                CountlyHelpers.confirm(jQuery.i18n.map["drill.bookmark-delete-remind"], "popStyleGreen", function (result) {
                    if (!result) {
                        return true;
                    }

                    $.ajax({
                        type:"GET",
                        url:countlyGlobal["path"]+"/i/drill/delete_bookmark",
                        data:{
                            "bookmark_id": bookmarkId,
                            "app_id": countlyCommon.ACTIVE_APP_ID,
                            "api_key":countlyGlobal["member"].api_key
                        },
                        success:function(res) {
                            if (res == false) {
                                CountlyHelpers.alert(jQuery.i18n.map["drill.bookmark-error"], "red");
                            }

                            self.fillBookmarks();
                        }
                    });
                },[jQuery.i18n.map["common.no-dont-delete"],jQuery.i18n.map["drill.bookmark-delete-confirm"]],{title:jQuery.i18n.map["drill.bookmark-delete-confirm-title"] ||jQuery.i18n.map["errorlogs.confirm-delete-title"],image:"delete-bookmark"});
            });

            $("#bookmark-view").on("click", ".bookmark-action.apply", function() {
                var query = self.bookmarkList[$(this).data("id")];

                try{
                    query.query_obj = JSON.parse(query.query_obj);
                }
                catch(ex){
                    query.query_obj = {};
                }

                var url = "/drill/"+JSON.stringify({event:query.event_key || "[CLY]_session", dbFilter:query.query_obj || {}, byVal:query.by_val || ""});
                if(decodeURIComponent(location.href).indexOf(url)){  // with the same query as current
                    $(($("#drill-navigation .menu"))[0]).trigger("click")
                }
                app.navigate("/drill/"+JSON.stringify({event:query.event_key || "[CLY]_session", dbFilter:query.query_obj || {}, byVal:query.by_val || ""}), true);
            });

            setTimeout(function() {
                drillClone = $("#drill").clone(true);
                if(self._task){
                    self._filter = JSON.parse(countlyTaskManager.getResult(self._task).meta);
                }
                if (self._filter) {
                    currEvent = self._filter.event || "[CLY]_session";

                    if (currEvent == "[CLY]_session") {
                        if (!$("#drill-type-sessions").hasClass("active")) {
                            $("#drill-types").find(".item").removeClass("active");
                            $("#drill-type-sessions").addClass("active");
                            $("#event-selector").hide();
                            setSelectorContent($("#drill-type-select"), $("#drill-type-sessions").find(".text").text());
                        }
                    } else if (currEvent == "[CLY]_crash") {
                        if (!$("#drill-type-crashes").hasClass("active")) {
                            $("#drill-types").find(".item").removeClass("active");
                            $("#drill-type-crashes").addClass("active");
                            $("#event-selector").hide();
                            setSelectorContent($("#drill-type-select"), $("#drill-type-crashes").find(".text").text());
                        }
                     } else if (currEvent == "[CLY]_view") {
                        if (!$("#drill-type-views").hasClass("active")) {
                            $("#drill-types").find(".item").removeClass("active");
                            $("#drill-type-views").addClass("active");
                            $("#event-selector").hide();
                            setSelectorContent($("#drill-type-select"), $("#drill-type-views").find(".text").text());
                        }
                    } else {
                        if (!$("#drill-type-events").hasClass("active")) {
                            $("#drill-types").find(".item").removeClass("active");
                            $("#drill-type-events").addClass("active");
                            $("#event-selector").show();
                            setSelectorContent($("#drill-type-select"), $("#drill-type-events").find(".text").text()+", "+currEvent);
                            loadEventsMenu($("#event-selector"), currEvent, false);
                        }
                    }
                    self.initFilterView = function () {
                        var filter = self._filter.dbFilter;

                        try {
                            byVal = JSON.parse(self._filter.byVal);
                            if (typeof byVal === 'string' && byVal !== "") {
                              byVal = [byVal];
                            }
                        } catch (e) {
                          if (Array.isArray(self._filter.byVal)) {
                            if (self._filter.byVal.length>0){
                                byVal = self._filter.byVal;
                            } else {
                                byVal = "";
                            }
                          } else if (typeof self._filter.byVal === 'string' && self._filter.byVal !== "") {
                            byVal = [self._filter.byVal];
                          } else {
                            byVal = "";
                          }
                        }

                        countlySegmentation.setQueryObject(filter, byVal);

                        self.filterObj = filter;
                        self.byVal = byVal;
                        self.activeSegmentForTable = "";
                        self.adjustFilters();
                        $("#drill .button-selector").find(".button").removeClass("active");
                        $("#drill .button-selector .button[data-type='"+self.graphType+"']").addClass("active");
                        self.draw(true, false, self._task);

                        var inputs = [];
                        var subs = {};

                        for (var i in filter) {
                            inputs.push(i);
                            subs[i] = [];
                            for(var j in filter[i]){
                                if(filter[i][j].length){
                                    for(var k = 0; k < filter[i][j].length; k++){
                                        subs[i].push([j, filter[i][j][k]]);
                                    }
                                }
                                else{
                                    subs[i].push([j, filter[i][j]]);
                                }
                            }
                        }

                        function setInput(cur, sub, total){
                            sub = sub || 0;
                            if(inputs[cur]){
                                var filterType = subs[inputs[cur]][sub][0];
                                if(filterType == "$in")
                                    filterType = "=";
                                else if(filterType == "$nin")
                                    filterType = "!=";

                                var val = subs[inputs[cur]][sub][1];
                                var el = $(".query:nth-child("+(total)+")");
                                $(el).data("query_value",val+""); //saves value as attribute for selected query
                                el.find(".filter-name").trigger("click");
                                el.find(".filter-type").trigger("click");
                                if(inputs[cur].indexOf("chr.") === 0){
                                    el.find(".filter-name").find(".select-items .item[data-value='chr']").trigger("click");
                                    if(val === "t")
                                        el.find(".filter-type").find(".select-items .item[data-value='=']").trigger("click");
                                    else
                                        el.find(".filter-type").find(".select-items .item[data-value='!=']").trigger("click");
                                    val = inputs[cur].split(".")[1];
                                    subs[inputs[cur]] = ["true"];
                                }
                                else{
                                    el.find(".filter-name").find(".select-items .item[data-value='" + inputs[cur] + "']").trigger("click");
                                    el.find(".filter-type").find(".select-items .item[data-value='" + filterType + "']").trigger("click");
                                }
                                setTimeout(function() {
                                    el.find(".filter-value").not(".hidden").trigger("click");
                                    if(el.find(".filter-value").not(".hidden").find(".select-items .item[data-value='" + val + "']").length)
                                        el.find(".filter-value").not(".hidden").find(".select-items .item[data-value='" + val + "']").trigger("click");
                                    else if(el.find(".filter-value").not(".hidden").hasClass("date") && _.isNumber(val) && (val + "").length == 10){
                                        el.find(".filter-value.date").find("input").val(countlyCommon.formatDate(moment(val*1000),"DD MMMM, YYYY"));
                                        el.find(".filter-value.date").find("input").data("timestamp", val);
                                    }
                                    else
                                        el.find(".filter-value").not(".hidden").find("input").val(val);

                                    if(subs[inputs[cur]].length == sub+1){
                                        cur++;
                                        sub = 0;
                                    }
                                    else
                                        sub++;
                                    total++;
                                    if(inputs[cur]){
                                        $("#filter-add-container").trigger("click");
                                        if(sub > 0)
                                            setTimeout(function() {
                                                var el = $(".query:nth-child("+(total)+")");
                                                el.find(".and-or").find(".select-items .item[data-value='OR']").trigger("click");
                                                setInput(cur, sub, total);
                                            }, 500);
                                        else
                                            setInput(cur, sub, total);
                                    }
                                    else{
                                        if(byVal){
                                            $("#filter-add-container").trigger("click");
                                            setTimeout(function() {
                                                var el = $(".query:nth-child("+(total)+")");
                                                el.find(".and-or").find(".select-items .item[data-value='BY']").trigger("click");
                                                byVal.forEach(function(val){
                                                  el.find(".filter-multi-values").find(".select-items .item[data-value='"+val+"']").trigger("click");
                                                });
                                            }, 500);
                                        }
                                    }
                                }, 500);
                            }
                            else if(byVal){
                                $("#filter-add-container").trigger("click");
                                setTimeout(function() {
                                    var el = $("#filter-blocks").find(".query:visible");
                                    el.find(".and-or").find(".select-items .item[data-value='BY']").trigger("click");
                                    byVal.forEach(function(val){
                                      el.find(".filter-multi-values").find(".select-items .item[data-value='"+val+"']").trigger("click");
                                    });
                                }, 500);
                            }
                        }
                        setInput(0, 0, 1);

                        setTimeout(function() {
                           $("#drill-actions").addClass("visible");
                           $("#defalt-filter-block .filter-type .text").text(jQuery.i18n.map[$("#defalt-filter-block .filter-type .text").attr("data-localize")])
                        }, 500);
                    }

                    $.when(countlySegmentation.initialize(currEvent)).then(self.initFilterView);
                } else {
                    $("#drill-type-sessions").trigger("click");
                    $("#drill-type-select").trigger("click");
                }
            }, 0);

        });
    },
    renderCommon:function (isRefresh) {
        if (!isRefresh) {
            $(this.el).html(this.template(this.templateData));
            this.pageScript();
        }

    },
    taskReportRemind: function() {
        if(this._task){
            setTimeout(function(){
                $(".date-selector").removeClass("selected").removeClass("active");
            },0)
            var task = countlyTaskManager.getResult(this._task)
            var periodObj = countlyCommon.periodObj

            if(periodObj.currentPeriodArr && periodObj.currentPeriodArr.length === 1){ //daily: today, yesterday
                $(".remind-context").text( jQuery.i18n.map['drill.task-period-remind'] + ' ' + periodObj.currentPeriodArr[0]+" 00:00" + " - " + "23:59")
                $(".remind-row").show()
            } else { // N days: 7days, 30days, 90days, or date from datepicker
                var periodList = periodObj.currentPeriodArr
                var start = new moment(periodList[0], 'YYYY.MM.DD')
                var end =  new moment(periodList[periodList.length - 1], 'YYYY.MM.DD')
                var endString = end.locale(countlyCommon.BROWSER_LANG_SHORT).format('DD MMMM YYYY')
                var startStringFormat = ''
                if(start.year() !== end.year()){
                    startStringFormat = 'YYYY'
                }
                if(start.month() !== end.month()){
                    startStringFormat = 'MMMM ' + startStringFormat
                }
                startStringFormat = 'DD ' + startStringFormat;
                var startString = start.locale(countlyCommon.BROWSER_LANG_SHORT).format(startStringFormat)
                var remindString = periodObj.currentPeriodArr.length > 0 ?
                    jQuery.i18n.map['drill.task-period-remind'] + ' '+startString  + ' - ' + endString :
                    jQuery.i18n.map['drill.task-none-period-remind'] + ' ' + endString;

                $(".remind-context").text(remindString)
                $(".remind-row").show()
            }
        } else {
            $(".remind-row").hide()
            CountlyHelpers.setUpDateSelectors(this);
        }
    },
    refresh:function () {
    }
});

function extendViewWithFilter(view){
    if(typeof view.initDrill !== "function"){
        view.initDrill = function() {
            var self = this;
            var $segmentation = $("#segmentation");
            var currEvent = "";
            this.filterObj = {};
            var closeFilters;
            var openFilters;
            if($("#view-filter").length){
                if($("#apply-filter-cbox").length) {
                    $(".on-off-switch").click(function(e){
                        e.preventDefault();
                    });
                }

                var locked = false;

                var unlock=function(){
                  locked=false;
                }

                var lock=function(){
                  locked=true;
                }

                closeFilters = function(callback){
                  if(locked){
                    return;
                  }
                  lock();
                  $("#apply-filter-cbox").prop("checked", false)
                  $("#filter-view").animate({'opacity': 0}, 400)
                  $(".filter-view-container").slideUp(400, function(){
                    unlock();
                    if(callback){
                      callback();
                    }
                  });
                }

                openFilters = function(callback){
                  if(locked){
                    return;
                  }
                  lock();
                  $("#apply-filter-cbox").prop("checked", true)
                  $(".filter-view-container").slideDown(400)
                  $("#filter-view").animate({'opacity': 1}, 400, function(){
                    self.adjustFilters();
                    unlock();
                    if(callback){
                      callback();
                    }
                  })
                }

                $("#view-filter").on("click", "#toggle-filter", function(e) {
                    if ($(".filter-view-container").is(":visible")) {
                      closeFilters();
                    } else {
                      openFilters();
                    };
                });
            }
            else{
                self.adjustFilters();
            }

            $segmentation.on("click", ".filter-connector", function() {
                var byUsed = false;
                $(".query:visible").each(function (index) {
                    byUsed = byUsed || ($(this).find(".filter-connector .text").data("value") == "BY");
                });

                if (byUsed) {
                    $(this).find(".item.by").hide();
                } else {
                    $(this).find(".item.by").show();
                }
            });

            $segmentation.on("click", ".filter-type .item", function() {
              var self = this;
              $(this).parents(".filters").find(".open-date-picker").val("");
              $(this).parents(".filters").find(".open-date-picker").data("timestamp","");
              setTimeout(function() { view.initApply(); }, 0);
              setTimeout(function(){
                var currentQuery = $(self).parents(".query");
                var operator = currentQuery.find(".filter-type .text").data("value");
                var type = currentQuery.find(".filter-name .text").data("type");
                var stringInput = currentQuery.find(".filter-name").siblings(".filter-value.string");
                var listInput = currentQuery.find(".filter-name").siblings(".filter-value.list");
                var dateInput = currentQuery.find(".filter-name").siblings(".filter-value.date");
                var numInput = currentQuery.find(".filter-name").siblings(".filter-value.num");
                var staticListInput = currentQuery.find(".filter-name").siblings(".filter-value.static-list");
                if (operator.startsWith("rgx")) {
                    if (stringInput.hasClass("hidden")) {
                        listInput.addClass("hidden").addClass("hidden-by-regex");
                        stringInput.removeClass("hidden");
                        listInput.find(".text").text("");
                        listInput.find(".text").data("value","");
                    }
                } else if (operator === "pseset") {
                    stringInput.addClass("hidden");
                    stringInput.find("input").val("");
                    dateInput.addClass("hidden");
                    dateInput.find("input").val("");
                    numInput.addClass("hidden");
                    numInput.find("input").val("");
                    staticListInput.removeClass("hidden");
                    staticListInput.find(".text").text("");
                    staticListInput.find(".text").data("value", "");
                    listInput.addClass("hidden");
                    listInput.find(".text").text("");
                    listInput.find(".text").data("value","");
                    view.setUpFilterValues(currentQuery.find(".filter-value.static-list .select-items>div"), [true, false], [jQuery.i18n.map["drill.opr.is-set-true"], jQuery.i18n.map["drill.opr.is-set-false"]]);
                } else {
                  if (listInput.hasClass("hidden-by-regex")){
                    listInput.removeClass("hidden").removeClass("hidden-by-regex");
                    stringInput.addClass("hidden");
                    stringInput.find("input").val("");
                  }
                  staticListInput.addClass("hidden");
                  if (type === "l" || type === "bl"){
                    listInput.removeClass("hidden");
                  }
                  if (type === "n"){
                    numInput.removeClass("hidden");
                  }
                  if (type === "d"){
                    dateInput.removeClass("hidden");
                  }
                  if (type === "s"){
                    stringInput.removeClass("hidden");
                  }
                }
              },0);

            });

            $segmentation.on("click", ".filter-name", function() {
                if ($(this).parents(".query").find(".filter-connector .text").data("value") == "OR") {
                    var existingFilters = [],
                        orFilters = [],
                        orFilterStr = "",
                        includeCohorts = true;

                    $(".query:visible:not(.by)").each(function (index) {
                        if ($(this).find(".filter-name .text").text() == jQuery.i18n.map["drill.select-filter"]) {
                            return false;
                        }

                        if(index > 0 && $(this).find(".filter-connector .text").data("value") === "AND" && $(this).find(".filter-name .text").data("value") === "chr"){
                            includeCohorts = false;
                        }

                        var isRegex = $(this).find(".filter-type .text").data("value").startsWith("rgx");

                        if (!isRegex && existingFilters.indexOf($(this).find(".filter-name .text").data("value")) == -1) {
                            orFilters.push({
                                type: $(this).find(".filter-name .text").data("type"),
                                id: $(this).find(".filter-name .text").data("value"),
                                name: $(this).find(".filter-name .text").text()
                            });

                            existingFilters.push($(this).find(".filter-name .text").data("value"));
                        }
                    });

                    if(!includeCohorts){
                        var index = existingFilters.indexOf("chr");
                        if(index !== -1){
                            orFilters.splice(index, 1);
                        }
                    }

                    for (var i = 0; i < orFilters.length; i++) {
                        var tmpItem = $("<div>");

                        tmpItem.addClass("item");
                        tmpItem.attr("data-type", orFilters[i].type);
                        tmpItem.attr("data-value", orFilters[i].id);
                        tmpItem.text(orFilters[i].name);

                        orFilterStr += tmpItem.prop('outerHTML');
                    }

                    $(this).find(".select-items>div").html(orFilterStr);
                } else if ($(this).parents(".query").find(".filter-connector .text").data("value") == "BY") {
                    $(this).find(".select-items>div").html(self.getFilters(currEvent));
                    $(this).find(".select-items>div .item[data-value=\"chr\"]").remove();
                } else {
                    var includeCohorts = true;
                    $(".query:visible:not(.by)").each(function (index) {
                        if(index > 0 && $(this).find(".filter-connector .text").data("value") === "OR" && $(this).find(".filter-name .text").data("value") === "chr"){
                            includeCohorts = false;
                        }
                    });
                    $(this).find(".select-items>div").html(self.getFilters(currEvent));
                    if(!includeCohorts)
                        $(this).find(".select-items>div .item[data-value=\"chr\"]").remove();
                }

                self.initApply();
            });

            $segmentation.on("click", ".filter-name, .filter-value, .filter-multi-values", function(e) {
              var clickedOn = $(e.target);
              if(clickedOn.hasClass("text") || clickedOn.hasClass("default-text") || clickedOn.hasClass("right") || clickedOn.hasClass("select-inner")){
                $(".query .search").remove();
                $(".query .cly-select, .query .cly-multi-select").removeClass("active");
              }
            });

            $segmentation.on("click", ".cly-multi-select .selection .remove", function(e) {
              setTimeout(function(){
                self.initApply();
              },0);
            })

            $segmentation.on("click", ".filter-name .item", function() {
                if ($(this).parents(".query").find(".filter-connector .text").data("value") != "BY") {
                    $(this).parents(".filter-name").siblings(".filter-type").replaceWith($("#defalt-filter-block").clone(true).find(".filter-type"));
                    $(this).parents(".filter-name").siblings(".filter-type").removeClass("disabled");

                    $(this).parents(".filter-name").siblings(".filter-value").addClass("hidden");
                    $(this).parents(".filter-name").siblings(".filter-value.list").removeClass("hidden-by-regex");
                    if ($(this).data("type") == "l") {
                        $(this).parents(".filter-name").siblings(".filter-value.list").removeClass("hidden");
                        $(this).parents(".filter-name").siblings(".filter-value.list").removeClass("big-list");
                        $(this).parents(".filter-name").siblings(".filter-value").find(".text").text("");
                        $(this).parents(".filter-name").siblings(".filter-value").find(".text").data("value","");
                        $(this).parents(".filter-name").siblings(".filter-value").removeClass("disabled");
                        $(this).parents(".filter-name").siblings(".filter-type").find(".item.num").hide();
                        $(this).parents(".filter-name").siblings(".filter-type").find(".item.eq").trigger("click");
                    } else if ($(this).data("type") == "bl") {
                        $(this).parents(".filter-name").siblings(".filter-value.list").removeClass("hidden");
                        $(this).parents(".filter-name").siblings(".filter-value.list").addClass("big-list");
                        $(this).parents(".filter-name").siblings(".filter-value").find(".text").text("");
                        $(this).parents(".filter-name").siblings(".filter-value").find(".text").data("value","");
                        $(this).parents(".filter-name").siblings(".filter-value").removeClass("disabled");
                        $(this).parents(".filter-name").siblings(".filter-type").find(".item.num").hide();
                        $(this).parents(".filter-name").siblings(".filter-type").find(".item.eq").trigger("click");
                    } else if ($(this).data("type") == "n") {
                        $(this).parents(".filter-name").siblings(".filter-value.num").removeClass("hidden");
                        $(this).parents(".filter-name").siblings(".filter-type").find(".item.num").show();
                        $(this).parents(".filter-name").siblings(".filter-type").find(".item.list, .item.str").hide();
                    }  else if ($(this).data("type") == "s") {
                        $(this).parents(".filter-name").siblings(".filter-value.string").removeClass("hidden");
                        $(this).parents(".filter-name").siblings(".filter-type").find(".item.num").hide();
                        $(this).parents(".filter-name").siblings(".filter-type").find(".item.str").show();
                    }  else if ($(this).data("type") == "d") {
                        $(this).parents(".filter-name").siblings(".filter-value.date").removeClass("hidden");
                        $(this).parents(".filter-name").siblings(".filter-type").find(".item.eq").hide();
                        $(this).parents(".filter-name").siblings(".filter-type").find(".item.neq").hide();
                        $(this).parents(".filter-name").siblings(".filter-type").find(".item.num").hide();
                        $(this).parents(".filter-name").siblings(".filter-type").find(".item.lt").show();
                        $(this).parents(".filter-name").siblings(".filter-type").find(".item.lte").hide();
                        $(this).parents(".filter-name").siblings(".filter-type").find(".item.gte").show();
                        $(this).parents(".filter-name").siblings(".filter-type").find(".item.gte").trigger("click");
                        $(this).parents(".filter-name").siblings(".filter-value.date").find(".open-date-picker").trigger("click");
                        $(this).parents(".filter-name").siblings(".filter-type").find(".item.list, .item.str").hide();
                    }
                    if (countlySegmentation.isFieldRegexable($(this).data("value"), $(this).data("type"))) {
                      $(this).parents(".filter-name").siblings(".filter-type").find(".item.rgx").show();
                    } else {
                      $(this).parents(".filter-name").siblings(".filter-type").find(".item.rgx").hide();
                    }
                    var existingFilters = []; 
                    $(".query:visible:not(.by)").each(function (index) {
                        existingFilters.push({
                            property : $(this).find(".filter-name .text").data("value"),
                            operator : $(this).find(".filter-type .text").data("value")
                        });
                    });
                    var property = $(this).data("value");
                    var doesOperatorRepeat = existingFilters.map(function(filter) {
                        return filter.property == property && filter.operator == "pseset";
                    }).reduce(function (acc, val) {
                        return acc || val;
                    }, false);
                    if (countlySegmentation.isFieldCompatibleWith("pseset", $(this).data("value"), $(this).data("type")) && !doesOperatorRepeat) {
                        $(this).parents(".filter-name").siblings(".filter-type").find(".item.pseset").show();
                    } else {
                        $(this).parents(".filter-name").siblings(".filter-type").find(".item.pseset").hide();
                    }
                }

                $(this).parents(".query").find(".filter-value.num input").val("");
                $(this).parents(".query").find(".filter-value.date input").val("");
                $(this).parents(".query").find(".filter-value.date input").data("timestamp", null)
                $(this).parents(".query").find(".filter-value.string input").val("");

                var rootHTML = $(this).parents(".query").find(".filter-value .select-items>div");
                rootHTML.html("<div></div>");

                if($(this).data("type") == "bl"){
                    var prop = $(this).data("value");
                    $(this).parents(".query").find(".filter-value").addClass("loading");

                    countlySegmentation.getBigListMetaData(prop, null, function(values, names){
                        var propvalue = rootHTML.parents(".query").data("query_value");
                        var list_limit = countlyGlobal["list_limit"];
                        if (countlyGlobal.apps && countlyGlobal.apps[countlyCommon.ACTIVE_APP_ID] && countlyGlobal.apps[countlyCommon.ACTIVE_APP_ID].plugins && countlyGlobal.apps[countlyCommon.ACTIVE_APP_ID].plugins.drill && typeof countlyGlobal.apps[countlyCommon.ACTIVE_APP_ID].plugins.drill.list_limit !== "undefined") {
                            list_limit = countlyGlobal.apps[countlyCommon.ACTIVE_APP_ID].plugins.drill.list_limit;
                        }
                        if(propvalue && propvalue!="" && values.indexOf(propvalue)==-1)//is passed and not in current list
                        {
                            rootHTML.parents(".query").data("query_value","");//removes attribute
                            countlySegmentation.getBigListMetaData(prop, propvalue, function(values2, names2){
                                rootHTML.parents(".query").find(".filter-value").removeClass("loading");

                                for(var z=0; z<values2.length; z++)
                                {
                                    values.push(values2[z]);
                                    if(values.length!=names.length && names.indexOf(names2[z]==-1))//because sometimes it is the same array
                                        names.push(names2[z]);
                                }
                                self.setUpFilterValues(rootHTML, values, names,  names.length >= list_limit);//adds from select to list
                                var timeout = null;

                            });
                        }
                        else
                        {
                            rootHTML.parents(".query").find(".filter-value").removeClass("loading");
                            self.setUpFilterValues(rootHTML, values, names,  names.length >= list_limit);
                            var timeout = null;
                        }
                        rootHTML.parents(".query").find(".filter-value").on("keyup", ".search input", function(e) {
                            e.stopPropagation();
                            var search = $(this).val();
                            var parent = $(this).parents(".filter-value").find(".select-items");
                            if(!parent.find(".table-loader").length)
                                parent.prepend("<div class='table-loader'></div>");
                            if(timeout)
                            {
                                clearTimeout(timeout);
                                timeout = null;
                            }
                            timeout = setTimeout(function(){
                                countlySegmentation.getBigListMetaData(prop, search, function(values, names){
                                    parent.find(".table-loader").remove();
                                    self.setUpFilterValues(rootHTML, values, names, names.length >= list_limit);
                                });
                            }, 1000);
                        });
                    });
                }
                else{
                    self.setUpFilters(this);
                }

                var selectedItem = $(this).parents(".cly-select").find(".text");
                selectedItem.text($(this).text());
                selectedItem.data("value", $(this).data("value"));
                selectedItem.data("type", $(this).data("type"));
                var field = $(this).parents(".filter-name").find(".text").data("value");
                var hasSameFieldRegex = $(".filter-name .text[data-field='"+field+"']").length > 0;
                if (hasSameFieldRegex){
                  $(this).parents(".filter-name").siblings(".filter-type").find(".item.rgx").hide();
                }
                selectedItem.attr("data-field", $(this).data("value"));
            });

            $segmentation.on("click", ".filter-value .item", function() {
                setTimeout(function() { self.initApply(); }, 0);
            });

            $segmentation.on("click", ".filter-multi-values .item", function() {
                setTimeout(function() { self.initApply(); }, 0);
            });

            $segmentation.on("keyup", ".filter-value input",function(event) {
                self.initApply();
            });

            $segmentation.on("change", ".filter-value input", function(event) {
                self.initApply();
            });

            $segmentation.on("keydown", ".filter-value.date input",function(event) {
                event.preventDefault();
            });

            $segmentation.on("click", ".filter-connector .item", function() {
                $(this).parents(".query").find(".filters").replaceWith($("#defalt-filter-block").clone(true).find(".filters"));

                $(".query:visible:not(:last)").find(".filter-name").addClass("disabled");
                $(".query:visible:not(:last)").find(".filter-type").addClass("disabled");
                self.adjustFilters();

                $(this).parents(".query").removeClass("by");

                if ($(this).data("value") == "BY") {
                    $(this).parents(".query").addClass("by");
                    $(this).parents(".query").find(".filter-type").hide();
                    $(this).parents(".query").find(".filter-value").hide();
                    $(this).parents(".query").find(".filter-name").hide();
                    $(this).parents(".query").find(".filter-multi-values").show();
                    $(this).parents(".query").find(".filter-connector").addClass("disabled");
                    $(this).parents(".query").find(".filter-multi-values").find(".select-items").html(self.getFilters(currEvent, true));
                    $(this).parents(".query").find(".filter-multi-values").find(".select-items .item[data-value=\"chr\"]").remove();
                } else if ($(this).data("value") == "AND") {
                  $(this).parents(".query").find(".filter-name").show();
                  $(this).parents(".query").find(".filter-multi-values").hide();
                } else if ($(this).data("value") == "OR") {
                  $(this).parents(".query").find(".filter-name").show();
                  $(this).parents(".query").find(".filter-multi-values").hide();
                }

                self.initApply();
            });

            $segmentation.on("click", ".query .delete", function() {
                self._task = null;
                self.taskReportRemind && self.taskReportRemind();
                var forceDraw = false;
                if ($(this).parent(".query").hasClass("by")){
                  $(this).find(".filter-multi-values").clyMultiSelectClearSelection();
                  forceDraw = true;
                }
                $(this).parent(".query").remove();
                $(".query:visible:last-child").find(".filter-name").removeClass("disabled");
                $(".query:visible:last-child").find(".filter-type").removeClass("disabled");
                self.adjustFilters();
                self.initApply();

                var filterData = self.getFilterObjAndByVal();
                var needData = false;
                if (!_.isEqual(self.filterObj, filterData.dbFilter) || (self.byVal != filterData.byVal)) {
                    // If the query is not changed we don't need to get data
                    needData = true;
                }
                self.filterObj = filterData.dbFilter;
                self.byVal = filterData.byVal;

                if (_.isEmpty(filterData.dbFilter)) {
                    $("#no-filter").show();
                    $("#current-filter").hide().find(".text").text("");
                } else {
                    $("#no-filter").hide();
                    $("#current-filter").show().find(".text").text(filterData.bookmarkText);
                }

                self.loadAndRefresh(needData, forceDraw);
            });

            $segmentation.on("click", ".open-date-picker", function(e) {

                var queryType = $(this).parents(".filters").find(".filter-type .text").data("value");
                var maxDate = (queryType == "$gte")? moment().subtract(1, 'days').toDate() : moment().add(1, 'days').toDate();

                $(".date-picker").hide();
                $(this).next(".date-picker").show();
                $(this).next(".date-picker").find(".calendar").datepicker({
                    numberOfMonths:1,
                    showOtherMonths:true,
                    onSelect:function (selectedDate) {
                        var instance = $(this).data("datepicker"),
                            date = $.datepicker.parseDate(instance.settings.dateFormat || $.datepicker._defaults.dateFormat, selectedDate, instance.settings),
                            currMoment = moment(date);

                        $(this).parents(".date-picker").prev(".open-date-picker").val(countlyCommon.formatDate(currMoment, "DD MMMM, YYYY"));

                        var selectedTimestamp = moment(currMoment.format("DD MMMM, YYYY"), "DD MMMM, YYYY").unix();
                        var tzCorr = countlyCommon.getOffsetCorrectionForTimestamp(selectedTimestamp);

                        $(this).parents(".date-picker").prev(".open-date-picker").data("timestamp", selectedTimestamp - tzCorr);
                        $(".date-picker").hide();
                        self.initApply();
                    }
                });

                $(this).next(".date-picker").find(".calendar").datepicker('option', 'maxDate', maxDate);

                $.datepicker.setDefaults($.datepicker.regional[""]);
                $(this).next(".date-picker").find(".calendar").datepicker("option", $.datepicker.regional[countlyCommon.BROWSER_LANG]);

                $(this).next(".date-picker").click(function(e) {
                    e.stopPropagation();
                });

                e.stopPropagation();

                $segmentation.on("click", ".cly-select", function() {
                    $(".date-picker").hide();
                });
            });

            $("#filter-add-container").on("click", function() {
                if ($(".query:visible:not(.by):last").find(".filter-name .text").text() == jQuery.i18n.map["drill.select-filter"]) {
                    $(".query:visible:not(.by):last").find(".filter-name").addClass("req");
                    return false;
                }

                var filterBlocks = $("#filter-blocks"),
                    defaultFilters = $("#defalt-filter-block").html();

                if ($("#filter-blocks").find(".query.by").length>0){
                  var lastAdded = $(defaultFilters).insertBefore($("#filter-blocks").find(".query.by"))
                }else{
                  var lastAdded = filterBlocks.append(defaultFilters);
                }

                var hideOrList = true;

                $(".query:visible:not(.by)").each(function (index) {
                    if (!hideOrList){
                      return; // no need for additional search, list will be shown. continue
                    }
                    if ($(this).find(".filter-name .text").text() == jQuery.i18n.map["drill.select-filter"]) {
                        return false;
                    }
                    hideOrList = $(this).find(".filter-type .text").data("value").startsWith("rgx");
                    // only 1 item with a non-regex operator is sufficient
                });

                if (hideOrList){
                  lastAdded.find(".filter-connector .item[data-value='OR']").hide();
                }

                $(".query:visible:not(:last)").find(".filter-name").addClass("disabled");
                $(".query:visible:not(:last)").find(".filter-type").addClass("disabled");

                self.adjustFilters();
            });

            if(self.bookmarkList)
                    $("#drill-actions").addClass("visible");

            $segmentation.on("click", "#apply-filter:not(.disabled)", function() {
                if ($(this).hasClass("disabled")) {
                    return true;
                }

                // if(self.bookmarkList)
                //     $("#drill-actions").addClass("visible");

                var filterData = self.getFilterObjAndByVal();

                var needData = false;
                if (!_.isEqual(self.filterObj, filterData.dbFilter) || (self.byVal != filterData.byVal)) {
                    // If the query is not changed we don't need to get data
                    needData = true;
                }

                self.filterObj = filterData.dbFilter;
                self.byVal = filterData.byVal;

                var statsSegmentation = {}
                if (app && app.activeView && app.activeView.viewName) {
                    statsSegmentation.source = app.activeView.viewName;
                }

                if (statsSegmentation.source === "drill") {
                    if (self.byVal && Array.isArray(self.byVal)) {
                        statsSegmentation.by_count = self.byVal.length;
                    } else {
                        statsSegmentation.by_count = 0;
                    }
                    switch (countlySegmentation.getActiveEvent()) {
                        case "[CLY]_session":
                            statsSegmentation.data_type = "session";
                            break;
                        case "[CLY]_crash":
                            statsSegmentation.data_type = "crash";
                            break;
                        case "[CLY]_view":
                            statsSegmentation.data_type = "view";
                            break;
                        default:
                            statsSegmentation.data_type = "event";
                            break;
                    }
                }

                app.recordEvent({
                    "key": "drill-query-apply",
                    "count": 1,
                    segmentation: statsSegmentation
                });

                self._task = null;
                self.taskReportRemind && self.taskReportRemind();
                if (needData) {
                    self.loadAndRefresh(needData);
                }

                $("#no-filter").hide();
                $("#current-filter").show().find(".text").text(filterData.bookmarkText);
            });

            $("#remove-filter").on("click", function(e) {
                self.filterObj = {};
                var wasFilterVisible = $("#filter-view").is(":visible");

                $("#filter-view").replaceWith(self.filterBlockClone.clone(true));
                if (wasFilterVisible) {
                    $("#filter-view").show();
                    $("#apply-filter-cbox").prop("checked", true)
                    self.adjustFilters();
                }

                $("#current-filter").hide();
                $("#no-filter").show();

                self.loadAndRefresh();

                e.stopPropagation();
            });

            $(window).click(function() {
                $(".date-picker").hide();
                $("#actions-popup").fadeOut();
                $(".edit-menu").fadeOut();
            });
        };
    }
    if(typeof view.setUpFilters !== "function"){
        view.setUpFilters = function(elem){
            var rootHTML = $(elem).parents(".query").find(".filter-value .select-items>div");
            this.setUpFilterValues(rootHTML, countlySegmentation.getFilterValues($(elem).data("value")), countlySegmentation.getFilterNames($(elem).data("value")));
        }
    }
    if(typeof view.setUpFilterValues !== "function"){
        view.setUpFilterValues = function(rootHTML, filterValues, filterNames, biglist){

            var filterValStr = "";

            if(biglist){
                var tmpItem = $("<div>");
                tmpItem.addClass("warning");
                tmpItem.text(jQuery.i18n.map["drill.big-list-warning"]);
                filterValStr += tmpItem.prop('outerHTML');
            }
            var isNumber = true;
            if (jQuery.isArray(filterValues)) {
                for (var i = 0; i < filterValues.length; i++) {
                    var tmpItem = $("<div>");

                    tmpItem.addClass("item");
                    tmpItem.attr("data-value", filterValues[i]);
                    tmpItem.text(_.unescape(filterNames[i]));

                    filterValStr += tmpItem.prop('outerHTML');
                    if(!$.isNumeric((filterValues[i]+"").replace(":","."))) {
                        isNumber = false;
                    }
                }
            } else {
                for (var p in filterValues) {
                    var tmpItem = $("<div>");
                    tmpItem.addClass("group");
                    tmpItem.text(p);

                    filterValStr += tmpItem.prop('outerHTML');
                    for (var i = 0; i < filterValues[p].length; i++) {
                        var tmpItem = $("<div>");

                        tmpItem.addClass("item");
                        tmpItem.attr("data-value", filterValues[p][i]);
                        tmpItem.text(_.unescape(countlyCommon.decode(filterValues[p][i])));

                        filterValStr += tmpItem.prop('outerHTML');
                        if(!$.isNumeric((filterValues[p][i]+"").replace(":","."))) {
                            isNumber = false;
                        }
                    }
                }
            }

            isNumber = isNumber && rootHTML.parents(".query").find(".filter-value.string").hasClass("hidden");

            if(isNumber){
                rootHTML.parents(".query").find(".filter-type .item.num").show();
            }

            rootHTML.html(filterValStr);
        }
    }
    if(typeof view.initApply !== "function"){
        view.initApply = function() {
            var filterData = this.getFilterObjAndByVal();

            if (_.isEmpty(filterData.dbFilter) && filterData.byVal == "") {
                // $("#drill-actions").removeClass("visible");
                $("#apply-filter").addClass("disabled");
            } else {
                $("#apply-filter").removeClass("disabled");
            }
        }
    }
    if(typeof view.getFilters !== "function"){
        view.getFilters = function(currEvent, addUsedToo) {
            var usedFilters = {};

            if (addUsedToo !== true) {
              $(".query:visible").each(function (index) {
                  var filterType = $(this).find(".filter-name .text").data("type");

                  // number and date types can be used multiple times for range queries
                  if (filterType != "n" && filterType != "d" && $(this).find(".filter-name .text").data("value") !== "chr") {
                      usedFilters[$(this).find(".filter-name .text").data("value")] = true;
                  }

              });
            }

            var filters = countlySegmentation.getFilters(currEvent),
                allFilters = "";

            if (filters.length == 0) {
                CountlyHelpers.alert(jQuery.i18n.map["drill.no-filters"], "black");
            }

            for (var i = 0; i < filters.length; i++) {
                if(typeof filters[i].id != "undefined"){
                    if (usedFilters[filters[i].id] == true) {
                        continue;
                    }

                    var tmpItem = $("<div>");

                    tmpItem.addClass("item");
                    tmpItem.attr("data-type", filters[i].type);
                    tmpItem.attr("data-value", filters[i].id);
                    tmpItem.text(filters[i].name);

                    allFilters += tmpItem.prop('outerHTML');
                }
                else{
                    var tmpItem = $("<div>");

                    tmpItem.addClass("group");
                    tmpItem.text(filters[i].name);

                    allFilters += tmpItem.prop('outerHTML');
                }
            }

            return allFilters;
        }
    }
    if(typeof view.getFilterObjAndByVal !== "function"){
        view.getFilterObjAndByVal = function(){
            var filterObj = {},
                filterObjTypes = {},
                filterObjConnects = {},
                byVal = "",
                byValText = "",
                bookmarkText = "";
            var operators = {'$gte':'>=', '$lte':'<=', '$gt':'>', '$lt':'<', '=':'=', '!=':'!=', 'rgxcn': 'contains', 'pseset': 'isset'};
            $("#filter-blocks").find(".query").each(function (index) {
                var tmpConnector = $(this).find(".filter-connector .text").data("value"),
                    tmpText = $(this).find(".filter-name .text").text(),
                    tmpTypeText = $(this).find(".filter-type .text").text(),
                    tmpValText = $(this).find(".filter-value.num input").val() ||
                        $(this).find(".filter-value.date input").val() ||
                        $(this).find(".filter-value.string input").val() ||
                        $(this).find(".filter-value.list .text").text() ||
                        $(this).find(".filter-value.static-list .text").text(),
                    tmpName = $(this).find(".filter-name .text").data("value"),
                    tmpType = $(this).find(".filter-type .text").data("value"),
                    tmpVal = $(this).find(".filter-value.num input").val() ||
                        $(this).find(".filter-value.date input").data("timestamp") ||
                        $(this).find(".filter-value.string input").val() ||
                        $(this).find(".filter-value.list .text").data("value") ||
                        $(this).find(".filter-value.static-list .text").data("value"),
                    tmpDataType = $(this).find(".filter-name .text").data("type");

                if(typeof tmpVal == "boolean")
                    tmpVal = tmpVal+"";
                if (tmpConnector != "BY") {
                    if (typeof tmpVal !== "number" && !tmpVal) {
                        return true;
                    }

                    if (tmpConnector && index != 0) {
                        bookmarkText += " [" + tmpConnector + "] ";
                    }

                    if (tmpType && operators[tmpType]){
                      bookmarkText += tmpText + " " + operators[tmpType] + " " + tmpValText;
                    } else {
                      bookmarkText += tmpText + " " + tmpTypeText + " " + tmpValText;
                    }

                    if (!filterObj[tmpName]) {
                        filterObj[tmpName] = [];
                    }

                    if (!filterObjTypes[tmpName]) {
                        filterObjTypes[tmpName] = [];
                    }

                    if (!filterObjConnects[tmpName]) {
                        filterObjConnects[tmpName] = [];
                    }

                    if ($.isNumeric(tmpVal) && (tmpDataType == "d" || tmpDataType == "n" || (tmpName && tmpName.indexOf("custom.") === 0))) {
                        tmpVal = parseInt(tmpVal, 10);
                    }

                    var exp = {};

                    if (tmpType == "=" || tmpType == "!=") {
                        exp = tmpVal;
                    } else if (tmpType.startsWith("rgx") || tmpType.startsWith("pse")){
                        exp[tmpType] = [tmpVal];
                    } else {
                        exp[tmpType] = tmpVal;
                    }

                    filterObj[tmpName].push(exp);
                    filterObjTypes[tmpName].push(tmpType);
                    filterObjConnects[tmpName].push(tmpConnector);
                } else {
                    var pairs = [];

                    $(this).find(".filter-multi-values").find(".text .selection").each(function() {
                        pairs.push([$(this).data("value"), $(this).text()]);
                    });

                    if (pairs.length>0) {
                        byVal = pairs.map(function(item){
                          return item[0];
                        });
                        byValText = pairs.map(function(item){
                          return item[1];
                        }).join(", ");
                    }

                }
            });

            return {
                bookmarkText: bookmarkText,
                dbFilter: this.generateFilter(filterObj, filterObjTypes, filterObjConnects),
                byVal: byVal,
                byValText: byValText
            };
        };
    }
    if(typeof view.generateFilter !== "function"){
        view.generateFilter = function(filterObj, filterObjTypes, filterObjConnects) {
            var dbFilter = {};
            for (var filter in filterObj) {
                dbFilter[filter] = {};
                for (var i = 0; i < filterObj[filter].length; i++) {
                    if(_.isObject(filterObj[filter][i])) {
                        for (var tmpFilter in filterObj[filter][i]) {
                            dbFilter[filter][tmpFilter] = filterObj[filter][i][tmpFilter];
                        }
                    } else if (filter === "chr" && filterObjConnects[filter] && filterObjConnects[filter].indexOf("OR") === -1) {
                        if (filterObjTypes[filter][i] == "!="){
                            dbFilter["chr."+filterObj[filter][i]] = "false";
                        }
                        else{
                            dbFilter["chr."+filterObj[filter][i]] = "true";
                        }
                        delete dbFilter[filter];
                    } else if (filterObjTypes[filter][i] == "!=") {
                        if (!dbFilter[filter]["$nin"]) {
                            dbFilter[filter]["$nin"] = [];
                        }

                        dbFilter[filter]["$nin"].push(filterObj[filter][i]);
                    } else {
                        if (!dbFilter[filter]["$in"]) {
                            dbFilter[filter]["$in"] = [];
                        }

                        dbFilter[filter]["$in"].push(filterObj[filter][i]);
                    }
                }
            }
            return dbFilter;
        }
    }

    if(typeof view.adjustFilters !== "function"){
        view.adjustFilters = function() {
            var self = this;
            if (!$("#filter-view").is(":visible")) {
                return;
            }

            var queryCount = $("#filter-blocks").find(".query:visible").length;

            if (queryCount == 0) {
                $("#filter-add-container").trigger("click");
            }

            $(".query:visible").each(function (index) {
                $(this).find(".connector div").hide();

                if (queryCount > 1) {
                    $(this).find(".and-or").show();
                    $(this).find(".connector").css("background-color", "transparent");
                    if (index == 0) {
                        $(this).find(".and-or").hide();
                        $(this).find(".connector .middle-bottom").show();
                    } else if (index == (queryCount - 1)) {
                        $(this).find(".connector .middle-top").show();
                    } else {
                        $(this).find(".connector .top").show();
                        $(this).find(".connector .middle-bottom").show();
                    }

                    if (index == (queryCount - 1)) {
                        $(this).find(".filter-connector").removeClass("disabled");
                    } else {
                        $(this).find(".filter-connector").addClass("disabled");
                    }
                } else {
                    if(self.byDisabled){
                        $(this).find(".and-or").hide();
                    }
                    else{
                        $(this).find(".and-or").show();
                        $(this).find(".connector").css("background-color", "#f9f9f9");
                    }
                }

                if ($(this).find(".filter-connector .text").data("value") == "BY") {
                    $(this).find(".cly-select").removeClass("disabled");
                    $(this).find(".filter-connector").addClass("disabled");
                    $(this).prev(".query").find(".filter-connector").removeClass("disabled");
                    $(this).prev(".query").find(".filter-name").removeClass("disabled");

                    if ($(this).prev(".query").find(".filter-name .text").text() != jQuery.i18n.map["drill.select-filter"]) {
                        $(this).prev(".query").find(".filter-type").removeClass("disabled");
                    }
                }
            });

            setTimeout(function() { $("#filter-blocks").removeClass("empty"); }, 1000);
        };
    }
    if(typeof view.loadAndRefresh !== "function"){
        view.loadAndRefresh = function(needData, forceDraw) {
            var filterData = this.getFilterObjAndByVal();
            countlySegmentation.setQueryObject(filterData.dbFilter, filterData.byVal);

            this.activeSegmentForTable = "";
            this._filter = filterData;

            if (this.byVal.length !== 2 && this.graphType === "punchcard") {
              this.graphType = "bar";
              $("#drill .button-selector").find(".button").removeClass("active");
              $("#drill .button-selector .button[data-type='"+this.graphType+"']").addClass("active");
              $("#drill").find("#dashboard-graph").html("");
            }

            // Call draw only if our filters are not empty, if they are empty initApply already called draw
            if (!(_.isEmpty(filterData.dbFilter) && filterData.byVal == "") || forceDraw) {
                this.draw(needData, false);
            }
            countlyCommon =  this.previousCommonObject ||  new CommonConstructor();
            if(JSON.stringify(this._filter.dbFilter) == "{}" && this._filter.byVal == "")
                app.navigate("/drill", false);
            else
                app.navigate("/drill/"+JSON.stringify({event:countlySegmentation.getActiveEvent() || "[CLY]_session", dbFilter:this._filter.dbFilter, byVal:this._filter.byVal || ""}), false);
        };
    }
}
//register views
app.drillView = new DrillView();
extendViewWithFilter(app.drillView);
app.route('/drill/*query', 'drill', function (query) {
    if(query.substring(0, 5) === "task/"){
        this.drillView._task = query.replace("task/", "");
    }
    else{
        try{
            query = JSON.parse(query);
        }
        catch(ex){
            query = null;
        }
        this.drillView._task = null;
        this.drillView._filter = query;
    }
    this.renderWhenReady(this.drillView);
});

app.route("/drill", "drill", function () {
    this.drillView._filter = null;
    this.drillView._task = null;
    this.renderWhenReady(this.drillView);
});

app.addPageScript("#", function(){
    $("#drill-down-for-view").on("click", function() {
        app.navigate("/drill/"+JSON.stringify($(this).data("drill-query")), true);
    });
});

function addDrill(drillId, drillVal, drillSection){
    drillSection = drillSection || "[CLY]_session";
    drillId = drillId || "";
    var query = {"event":drillSection};
    if(drillVal){
        query["dbFilter"] = {};
        query["dbFilter"][drillId] = {"$in":[drillVal]};
        query["byVal"] = "";
    }
    else{
        query["dbFilter"] = {};
        query["byVal"] = drillId;
    }
    // predefined cases for analytics/users and analytics/sessions
    if (drillId === "u") {
        query["setFilter"] = "users";
    }
    else if (drillId === "s") {
        query["setFilter"] = "times";
    }
    drillVal = drillVal || {};
    var str = '<div title="Drill down this data with Countly Drill" id="drill-down-for-view" data-drill-query=\''+JSON.stringify(query)+'\' ';
    str += 'class="icon-button light">'+
        '<span class="ion-android-funnel" style="color:#86BB64;"></span>'+
    '</div>';
    return str;
}

app.addPageScript("/analytics/sessions", function(){
    $(".widget-header .left .title").first().after(addDrill("s"));
});

app.addPageScript("/analytics/users", function(){
    $(".widget-header .left .title").first().after(addDrill("u"));
});

app.addPageScript("/analytics/countries", function(){
    $(".widget-header .left .title").first().after(addDrill("up.cc"));
});

app.addPageScript("/analytics/devices", function(){
    $(".widget-header .left .title").first().after(addDrill("up.d"));
});

app.addPageScript("/analytics/platforms", function(){
    $(".widget-header .left .title").first().after(addDrill("up.p"));
});

app.addPageScript("/analytics/versions", function(){
    $(".widget-header .left .title").first().after(addDrill("up.av"));
});

app.addPageScript("/analytics/carriers", function(){
    $(".widget-header .left .title").first().after(addDrill("up.c"));
});

app.addPageScript("/analytics/resolutions", function(){
    $(".widget-header .left .title").first().after(addDrill("up.r"));
});

app.addPageScript("/attribution", function(){
    $(".widget:nth-child(1) .widget-header .left .title").first().after(addDrill("cmp.c"));
});

app.addPageScript("/crashes", function(){
    $(".widget:nth-child(1) .widget-header .left .title").first().after(addDrill("sg.crash", null, "[CLY]_crash"));
});

app.addPageScript("/custom#", function () {
    addWidgetType();
    addSettingsSection();
    countlySegmentation.clearDrillReportCache();

    function addWidgetType() {
        var drillWidget = '<div data-widget-type="drill" class="opt dashboard-widget-item">' +
            '    <div class="inner">' +
            '        <span class="icon drill"></span>' + jQuery.i18n.prop("drill.drill") +
            '    </div>' +
            '</div>';

        $("#widget-drawer .details #widget-types .opts").append(drillWidget);
    }

    function addSettingsSection() {
        var setting =   '<div id="widget-section-single-drill" class="settings section">' +
                        '    <div class="label">' + jQuery.i18n.prop("drill.drill-report") + '</div>' +
                        '    <div id="single-drill-dropdown" class="cly-select" style="width: 100%; box-sizing: border-box;">' +
                        '        <div class="select-inner">' +
                        '            <div class="text-container">' +
                        '                <div class="text">' +
                        '                    <div class="default-text">' + jQuery.i18n.prop("drill.select") + '</div>' +
                        '                </div>' +
                        '            </div>' +
                        '            <div class="right combo"></div>' +
                        '        </div>' +
                        '        <div class="select-items square" style="width: 100%;"></div>' +
                        '    </div>' +
                        '   <div class="description">' + jQuery.i18n.prop("drill.report-description") + '</div>' +
                        '</div>';

        var visualization = '<div id="widget-section-single-visualization" class="settings section">' +
                            '    <div class="label">' + jQuery.i18n.prop("drill.visualization") + '</div>' +
                            '    <div id="single-visualization-dropdown" class="cly-select" style="width: 100%; box-sizing: border-box;">' +
                            '        <div class="select-inner">' +
                            '            <div class="text-container">' +
                            '                <div class="text">' +
                            '                    <div class="default-text">' + jQuery.i18n.prop("drill.select-visualization") + '</div>' +
                            '                </div>' +
                            '            </div>' +
                            '            <div class="right combo"></div>' +
                            '        </div>' +
                            '        <div class="select-items square" style="width: 100%;"></div>' +
                            '    </div>' +
                            '</div>';

        var singleDrillMetricDropdown = '<div id="widget-section-single-drill-metric" class="settings section">' +
                                        '    <div class="label">' + jQuery.i18n.prop("drill.metric") + '</div>' +
                                        '    <div id="single-drill-metric-dropdown" class="cly-select" style="width: 100%; box-sizing: border-box;">' +
                                        '        <div class="select-inner">' +
                                        '            <div class="text-container">' +
                                        '                <div class="text">' +
                                        '                    <div class="default-text">' + jQuery.i18n.prop("drill.select-metric") + '</div>' +
                                        '                </div>' +
                                        '            </div>' +
                                        '            <div class="right combo"></div>' +
                                        '        </div>' +
                                        '        <div class="select-items square" style="width: 100%;"></div>' +
                                        '    </div>' +
                                        '</div>';

        var multiDrillMetricDropdown = '<div id="widget-section-multi-drill-metric" class="settings section">' +
                                        '    <div class="label">' + jQuery.i18n.prop("drill.metrics") + '</div>' +
                                        '    <div id="multi-drill-metric-dropdown" class="cly-multi-select" data-max="3" style="width: 100%; box-sizing: border-box;">' +
                                        '        <div class="select-inner">' +
                                        '            <div class="text-container">' +
                                        '                <div class="text">' +
                                        '                    <div class="default-text">' + jQuery.i18n.prop("drill.select-metrics") + '</div>' +
                                        '                </div>' +
                                        '            </div>' +
                                        '            <div class="right combo"></div>' +
                                        '        </div>' +
                                        '        <div class="select-items square" style="width: 100%;"></div>' +
                                        '    </div>' +
                                        '</div>';

        $(setting).insertAfter(".cly-drawer .details .settings:last");
        $(singleDrillMetricDropdown).insertAfter(".cly-drawer .details .settings:last");
        $(multiDrillMetricDropdown).insertAfter(".cly-drawer .details .settings:last");
        $(visualization).insertAfter(".cly-drawer .details .settings:last");
        var $barColors = $("#widget-section-bar-color").clone(true);
        $("#widget-section-bar-color").remove();
        $($barColors).insertAfter(".cly-drawer .details .settings:last");
    }

    $("#single-app-dropdown").on("cly-select-change", function (e, selected) {
        $("#single-drill-dropdown").clySelectSetSelection("", jQuery.i18n.prop("drill.select"));

        if (selected) {
            var drillReports = {};
            $.when.apply(null, [countlySegmentation.getDrillReportsForApps(selected, drillReports)]).done(function () {
                var reportsData = drillReports.data;
                var setItems = [];
                for(var i = 0; i < reportsData.length; i++){
                    setItems.push({
                        'name': reportsData[i].report_name,
                        'value': reportsData[i]._id + "***" + JSON.parse(reportsData[i].meta).byVal
                    });
                }
                $("#single-drill-dropdown").clySelectSetItems(setItems);
            });
        }
    });

    $("#single-drill-dropdown").on("cly-select-change", function (e, selected) {
        if($("#widget-types").find(".opt.selected").data("widget-type") != "drill"){
            return;
        }

        $("#widget-section-single-visualization").hide();
        $("#single-visualization-dropdown").clySelectSetSelection("", jQuery.i18n.prop("drill.select-visualization"));

        $("#widget-section-single-drill-metric").hide();
        $("#widget-section-multi-drill-metric").hide();
        $("#single-drill-metric-dropdown").clySelectSetSelection("", jQuery.i18n.prop("drill.select-metric"));
        $("#multi-drill-metric-dropdown").clyMultiSelectClearSelection();

        if(selected){
            var drillValues = selected.split("***");
            var byVal = drillValues[1];

            if(byVal){
                $("#widget-section-single-visualization").show();
                $("#widget-section-single-drill-metric").show();
            }else{
                $("#widget-section-multi-drill-metric").show();
            }
        }

        $("#widget-drawer").trigger("cly-widget-section-complete");
    });

    $("#single-visualization-dropdown").on("cly-select-change", function (e, selected) {
        $("#widget-section-bar-color").hide();
        $("#bar-colors").find(".color").removeClass("selected");
        $("#bar-colors").find(".color[data-color=1]").addClass("selected");

        if(selected == "bar"){
            $("#widget-section-bar-color").show();
        }

        $("#widget-drawer").trigger("cly-widget-section-complete");
    });

    $("#single-drill-metric-dropdown").on("cly-select-change", function () {
        $("#widget-drawer").trigger("cly-widget-section-complete");
    });

    $("#multi-drill-metric-dropdown").on("cly-multi-select-change", function() {
        $("#widget-drawer").trigger("cly-widget-section-complete");
    });

    $("#dashboards #date-selector").on("click", ".date-selector", function(){
        countlySegmentation.clearDrillReportCache();
    })
});

$( document ).ready(function() {
    app.addMenu("explore", {code:"drill", url:"#/drill", text:"drill.drill", icon:'<div class="logo ion-android-funnel"></div>', priority:30});

    //check if configuration view exists
    if(app.configurationsView){
        app.configurationsView.registerLabel("drill", "drill.drill");
        app.configurationsView.registerLabel("drill.list_limit", "drill.item-limit");
        app.configurationsView.registerLabel("drill.big_list_limit", "drill.big_list_limit");
        app.configurationsView.registerLabel("drill.custom_property_limit", "drill.max-custom-properties");
        app.configurationsView.registerLabel("drill.projection_limit", "drill.projection_limit");
        app.configurationsView.registerLabel("drill.record_sessions", "drill.record_sessions");
        app.configurationsView.registerLabel("drill.record_views", "drill.record_views");
        app.configurationsView.registerLabel("drill.record_actions", "drill.record_actions");
        app.configurationsView.registerLabel("drill.record_pushes", "drill.record_pushes");
        app.configurationsView.registerLabel("drill.record_crashes", "drill.record_crashes");
        app.configurationsView.registerLabel("drill.record_star_rating", "drill.record_star_rating");
    }

    initializeDrillWidget();
});

function initializeDrillWidget() {

    if (countlyGlobal["plugins"].indexOf("dashboards") < 0) {
        return;
    }

    var drillWidgetTemplate;
    var visualizations = [
        {
            name: "Time series",
            value: "line"
        },
        {
            name: "Bar chart",
            value: "bar"
        }
    ];

    var drillMetrics = [
        {
            name: jQuery.i18n.prop("drill.users"),
            value: "users"
        },
        {
            name: jQuery.i18n.prop("drill.times"),
            value: "times"
        },
        {
            name: jQuery.i18n.prop("drill.times-users"),
            value: "average"
        },
        {
            name: jQuery.i18n.prop("drill.sum"),
            value: "sum"
        },
        {
            name: jQuery.i18n.prop("drill.sum-users"),
            value: "sum_average"
        },
        {
            name: jQuery.i18n.prop("drill.dur"),
            value: "dur"
        },
        {
            name: jQuery.i18n.prop("drill.dur-users"),
            value: "dur_average"
        }
    ];

    var reportPeriods = [
        { value: 'today', name: jQuery.i18n.map["drill.today"] },
        { value: '7days', name: jQuery.i18n.map["drill.last_7_days"] },
        { value: '30days', name: jQuery.i18n.map["drill.last_30_days"] },
    ];

    $.when(
        $.get(countlyGlobal["path"] + '/drill/templates/widget.html', function (src) {
            drillWidgetTemplate = Handlebars.compile(src);
        })
    ).then(function () {

        var widgetOptions = {
            init: initWidgetSections,
            settings: widgetSettings,
            placeholder: addPlaceholder,
            create: createWidgetView,
            reset: resetWidget,
            set: setWidget,
            refresh: refreshWidget
        };

        app.addWidgetCallbacks("drill", widgetOptions);
    });

    function initWidgetSections() {
        var selWidgetType = $("#widget-types").find(".opt.selected").data("widget-type");

        if (selWidgetType != "drill") {
            return;
        }

        $("#single-visualization-dropdown").clySelectSetItems(visualizations);
        $("#single-drill-metric-dropdown").clySelectSetItems(drillMetrics);
        $("#multi-drill-metric-dropdown").clySelectSetItems(drillMetrics);
        $("#widget-drawer .details #data-types").parent(".section").hide();
        $("#widget-section-single-app").show();
        $("#widget-section-single-drill").show();

        var visualization = $("#single-visualization-dropdown").clySelectGetSelection();
        var selectedSingleDrillMetric = $("#single-drill-metric-dropdown").clySelectGetSelection();
        var selectedMultiDrillMetric = $("#multi-drill-metric-dropdown").clyMultiSelectGetSelection();

        if(visualization){
            $("#widget-section-single-visualization").show();

            if(visualization == "bar"){
                $("#widget-section-bar-color").show();
            }
        }

        if(selectedMultiDrillMetric.length){
            $("#widget-section-multi-drill-metric").show();
        }

        if(selectedSingleDrillMetric){
            $("#widget-section-single-drill-metric").show();
        }
    }

    function widgetSettings() {
        var $singleAppDrop = $("#single-app-dropdown"),
            $singledrillDrop = $("#single-drill-dropdown"),
            $singleVisualizationDrop = $("#single-visualization-dropdown"),
            $barColor = $("#bar-colors"),
            $multiDrillMetricDrop = $("#multi-drill-metric-dropdown"),
            $singleDrillMetricDrop = $("#single-drill-metric-dropdown");

        var selectedApp = $singleAppDrop.clySelectGetSelection(),
            selectedDrill = $singledrillDrop.clySelectGetSelection(),
            selectedVisualization = $singleVisualizationDrop.clySelectGetSelection(),
            selectedSingleDrillMetric = $singleDrillMetricDrop.clySelectGetSelection();

        var drillReport,
            selectedDrillMetric,
            visualization = visualizations[0].value;

        if(selectedDrill){
            var drillValues = selectedDrill.split("***");
            var byVal = drillValues[1];
            drillReport = drillValues[0];

            if(byVal){
                visualization = selectedVisualization;
                selectedDrillMetric = (selectedSingleDrillMetric) ? [selectedSingleDrillMetric] : [];
            }else{
                selectedDrillMetric = $multiDrillMetricDrop.clyMultiSelectGetSelection();
            }
        }

        var barColor = $barColor.find(".color.selected").data("color");

        var settings = {
            apps: (selectedApp) ? [selectedApp] : [],
            drill_report: (drillReport) ? [drillReport] : [],
            visualization: visualization,
            metric: selectedDrillMetric
        };

        if(visualization == "bar"){
            settings.bar_color = barColor;
        }

        return settings;
    }

    function addPlaceholder(dimensions) {
        dimensions.min_height = 2;
        dimensions.min_width = 6;
        dimensions.width = 6;
        dimensions.height = 3;
    }

    function createWidgetView(widgetData) {
        var placeHolder = widgetData.placeholder;

        formatData(widgetData);
        render();

        function render() {
            var title = widgetData.title;

            var $widget = $(drillWidgetTemplate({
                title: title,
                apps: []
            }));

            placeHolder.find("#loader").fadeOut();
            placeHolder.find(".cly-widget").html($widget.html());

            var graphData = prepareDrillGraph(widgetData, placeHolder);

            var $widget = $(drillWidgetTemplate({
                title: "",
                apps: graphData.appData
            }));

            placeHolder.find(".apps").replaceWith($widget.find(".apps"));

            if (!title) {
                var appId = widgetData.apps[0];
                var drillReports = {};
                var drillReport = widgetData.drill_report;
                var widgetName = "";
                $.when.apply(null, [countlySegmentation.getDrillReportsForApps(appId, drillReports)]).done(function () {
                    var reportsData = drillReports.data;
                    for(var i = 0; i < reportsData.length; i++){
                        if(reportsData[i]._id == drillReport[0]){
                            widgetName = reportsData[i].report_name;
                            break;
                        }
                    }
                    if(graphData.title.titleInfo){
                        widgetName += " (" + graphData.title.titleInfo + ")";
                    }

                    placeHolder.find(".cly-widget .drill > .title .name").text(widgetName);
                    placeHolder.find(".cly-widget .drill > .title .name span").remove();
                    placeHolder.find(".cly-widget .drill > .title .name").append($(graphData.title.updatedAt));
                })
            }
        }
    }

    function formatData(widgetData) {
        var json = widgetData.dashData.data;

        if(json.data)
            json.data = JSON.parse(countlyCommon.decodeHtml(json.data));
        if(json.meta)
            json.meta = JSON.parse(countlyCommon.decodeHtml(json.meta));
        if(json.request)
            json.request = JSON.parse(countlyCommon.decodeHtml(json.request));

        var data = json;

        widgetData.formattedData = data;
    }

    function resetWidget() {
        $("#single-drill-dropdown").clySelectSetSelection("", jQuery.i18n.prop("drill.select"));
        $("#single-visualization-dropdown").clySelectSetSelection("", jQuery.i18n.prop("drill.select-visualization"));
        $("#single-drill-metric-dropdown").clySelectSetSelection("", jQuery.i18n.prop("drill.select-metric"));
        $("#multi-drill-metric-dropdown").clyMultiSelectClearSelection();
        $("#bar-colors").find(".color").removeClass("selected");
        $("#bar-colors").find(".color[data-color=1]").addClass("selected");
    }

    function setWidget(widgetData) {
        var apps = widgetData.apps,
            drillReport = widgetData.drill_report,
            visualization = widgetData.visualization,
            barColor = widgetData.bar_color,
            metrics = widgetData.metric;

        var $singleAppDrop = $("#single-app-dropdown"),
            $singledrillDrop = $("#single-drill-dropdown"),
            $singleVisualizationDrop = $("#single-visualization-dropdown"),
            $barColors = $("#bar-colors"),
            $multiDrillMetricDrop = $("#multi-drill-metric-dropdown"),
            $singleDrillMetricDrop = $("#single-drill-metric-dropdown");;

        $singleAppDrop.clySelectSetSelection(apps[0], countlyDashboards.getAppName(apps[0]));

        var byVal = false;

        if (drillReport) {

            var drillReports = {};

            $.when.apply(null, [countlySegmentation.getDrillReportsForApps(apps[0], drillReports)]).done(function () {
                var reportsData = drillReports.data;
                var setItem;
                for(var i = 0; i < reportsData.length; i++){
                    if(reportsData[i]._id == drillReport[0]){
                        setItem = {
                            'name': reportsData[i].report_name,
                            'value': reportsData[i]._id + "***" + JSON.parse(reportsData[i].meta).byVal
                        }

                        byVal = JSON.parse(reportsData[i].meta).byVal ? true : false;
                        break;
                    }
                }
                $singledrillDrop.clySelectSetSelection(setItem.value, setItem.name);

                if(byVal){
                    var visualizationArray = visualizations.filter(function(obj){
                        return obj.value == visualization;
                    });

                    if(visualizationArray.length){
                        $singleVisualizationDrop.clySelectSetSelection(visualizationArray[0].value, visualizationArray[0].name);
                    }

                    if(barColor && visualizationArray[0].value == "bar"){
                        $barColors.find(".color").removeClass("selected");
                        $barColors.find(".color[data-color=" + barColor + "]").addClass("selected");
                    }

                    if(metrics.length){
                        var metricArray = drillMetrics.filter(function(obj){
                            return obj.value == metrics[0];
                        });

                        if(metricArray.length){
                            $singleDrillMetricDrop.clySelectSetSelection(metricArray[0].value, metricArray[0].name);
                        }
                    }
                }else{
                    if(metrics.length){
                        var metricNameValues = [];
                        for (var i = 0; i < metrics.length; i++) {
                            metricNameValues.push({
                                name: drillMetrics.filter(function(obj){ return obj.value == metrics[i]; })[0].name,
                                value: metrics[i]
                            });
                        }

                        $multiDrillMetricDrop.clyMultiSelectSetSelection(metricNameValues);
                    }
                }
            });
        }
    }

    function refreshWidget(widgetEl, widgetData) {
        formatData(widgetData);

        var graphData = prepareDrillGraph(widgetData, widgetEl);

        var $widget = $(drillWidgetTemplate({
            title: "",
            apps: graphData.appData
        }));

        widgetEl.find(".apps").replaceWith($widget.find(".apps"));
    }

    function prepareDrillGraph(widgetData, jQueryEl){
        var data = widgetData.dashData.data;
        var graphType = widgetData.visualization;
        var currEvent = data.meta.event;
        var metrics = widgetData.metric;
        var barColor = widgetData.bar_color;
        try {
            var byVal = JSON.parse(data.meta.byVal);
        } catch (ex) {
            var byVal = data.meta.byVal;
        }
        var graphBucket = data.request.json.bucket;
        var period = data.request.json.period;
        var periodDesc = data.period_desc;
        var drillChartDP = {};
        var filter = data.meta.dbFilter;
        var countlyCommonInstance = new CommonConstructor();

        var periodRang = [];
        if (Object.prototype.toString.call(period) === '[object Array]' && period.length == 2) {
            periodRang = period;
            countlyCommonInstance.setPeriod(periodRang, undefined, true);
        }else{
            if(period != 'hour'){
                var periodObj = countlyCommonInstance.calcSpecificPeriodObj(period, data.end)
                var currentPeriodArray = periodObj.currentPeriodArr;

                if(currentPeriodArray.length > 0) {
                    var start = moment(currentPeriodArray[0], 'YYYY.MM.DD').toDate().getTime()
                    var end = moment(currentPeriodArray[currentPeriodArray.length - 1], 'YYYY.MM.DD').add(1,'day').toDate().getTime() - 1
                    periodRang = [start,end];
                }
                countlyCommonInstance.setPeriod(periodRang, undefined, true);
            }else {
                countlyCommonInstance.setPeriod(period, data.end, true);
            }
        }

        countlySegmentation.setSegmentationData(data.data);
        countlySegmentation.setBucket(graphBucket);
        countlySegmentation.setQueryObject(filter, byVal);
        countlySegmentation.setCommonInstance(countlyCommonInstance);

        if(byVal == ""){
            drillChartDP = countlySegmentation.getSegmentationDP().chartDP;
        }else {
            drillChartDP = countlySegmentation.getSegmentationDPWithProjection().chartDP;
        }

        if(drillChartDP["dur"] && drillChartDP["dur_average"]){
            countlyCommonInstance.formatSecondForDP(drillChartDP["dur_average"], jQuery.i18n.map["drill.dur-users"]);
            countlyCommonInstance.formatSecondForDP(drillChartDP["dur"], jQuery.i18n.map["drill.dur"]);
        }

        var graphData = [];

        if (byVal == "") {
            for(var i = 0; i < metrics.length; i++){
                graphData.push(drillChartDP[metrics[i]][0]);
            }
            countlyCommonInstance.drawTimeGraph(graphData, jQueryEl.find(".graph"), graphBucket);
        } else {
            graphData = drillChartDP[graphType][metrics[0]];
            if (graphType == "line") {
                graphData = graphData.slice(0,5);
                countlyCommonInstance.drawTimeGraph(graphData, jQueryEl.find(".graph"), graphBucket);
            } else {
                var barColors = ["#6fa3ef", "#55bdb9", "#ef8800", "#ae83d2"];

                graphData.dp[0].color = barColors[barColor - 1 || 0];
                countlyCommonInstance.drawGraph(graphData, jQueryEl.find(".graph"), graphType);
            }
        }

        var app = widgetData.apps;
        var appName = countlyDashboards.getAppName(app[0]);
        var appId = app[0];
        var seriesLabelsForApp = [];
        var addMetricToTitle = undefined;
        var addPeriodToTitle = undefined;

        if(graphType == "line"){
            var labels = _.pluck(graphData, "label");

            for(var i = 0; i < labels.length; i++){
                seriesLabelsForApp.push({
                    label: labels[i],
                    color: countlyCommonInstance.GRAPH_COLORS[i]
                });
            }
        }else{
            seriesLabelsForApp.push({
                label: drillMetrics.filter(function(obj){ return obj.value == metrics[0]; })[0].name,
                color: barColors[barColor - 1 || 0]
            });

            addPeriodToTitle = reportPeriods.filter(function(obj){ return obj.value == periodDesc; })[0].name;
        }

        var appData = [
            {
                id: appId,
                name: appName,
                labels: seriesLabelsForApp
            }
        ];

        if(graphType == "line" && byVal != ""){
            addMetricToTitle = drillMetrics.filter(function(obj){ return obj.value == metrics[0]; })[0].name;
        }

        formatSegmentationText(appId, filter, currEvent, byVal, graphBucket, function(text){
            var segmentationText = text || data.name;
            jQueryEl.find(".cly-widget .drill > .title .desc").text(" " + segmentationText);
        });

        var updatedAt = data.start;
        var elem = countlyCommonInstance.formatTimeAgo(updatedAt);
        jQueryEl.find(".cly-widget .drill > .title .name span").remove();
        jQueryEl.find(".cly-widget .drill > .title .name").append(elem);

        return {
            appData: appData,
            title: {
                updatedAt: elem,
                titleInfo: addMetricToTitle || addPeriodToTitle
            }
        };

        function formatSegmentationText(appId, filter, event, byVal, bucket, cb){
            $.when(countlySegmentation.fetchAppSegmentationMeta(appId, event, bucket)).then(function () {
                var filters = countlySegmentation.getFilters();
                var text = "";

                try{
                    text = queryToName(filter, event, byVal);
                }catch(e){
                    console.log(e.message);
                }

                return cb(text);

                function queryToName(filter, event, byVal){
                    var str = "";
                    if(event){
                        str += processEventName(event) + " ";
                    }

                    if(filter){
                        var parts = [];
                        for(var i in filter){
                            arrayToName(filter[i].$in, i, "=", parts);
                            arrayToName(filter[i].$nin, i, "!=", parts);
                            arrayToName(filter[i].$gt, i, ">", parts);
                            arrayToName(filter[i].$gte, i, ">=", parts);
                            arrayToName(filter[i].$lt, i, "<", parts);
                            arrayToName(filter[i].$lte, i, "<=", parts);
                            arrayToName(filter[i].rgxcn, i, "contains", parts);
                            arrayToName(filter[i].pseset, i, "isset", parts);
                        }

                        if(parts.length){
                            str += "(" + parts.join(" AND ") + ")";
                        }
                    }

                    if(byVal){
                        var by = "";
                        if(typeof byVal === "string"){
                            by = filters.filter(function(obj){ return obj.id == byVal })[0].name;
                        }else{
                            var arr = [];
                            for(var i = 0; i < byVal.length; i++){
                                arr.push(filters.filter(function(obj){ return obj.id == byVal[i] })[0].name);
                            }
                            by = arr.join(" and ");
                        }
                    }

                    str += by ? " by "+ by : '';
                    return str;
                }

                function processEventName(event){
                    if(event.indexOf("[CLY]_") === 0){
                        event = event.replace("[CLY]_", "").replace("_", " ");
                        event = event.charAt(0).toUpperCase() + event.slice(1);
                    }else{
                        event = "Event: "+event;
                    }
                    return event;
                }

                function arrayToName(arr, key, sign, parts){
                    if(arr){
                        var ret = [];
                        var filterName = filters.filter(function(obj){ return obj.id == key });
                        for(var j = 0; j < arr.length; j++){
                            ret.push(filterName[0].name + " " + sign + " " + arr[j]);
                        }

                        if(ret.length){
                            if(ret.length == 1)
                                parts.push(ret[0]);
                            else
                                parts.push(ret.join(" OR "));
                        }
                    }
                }
            });
        }
    }
}
