/*global countlySession*/
window.CohortsView = countlyView.extend({
    selectedMetric: "i",
    initialize: function () {
    },
    getProperties: function (metric) {
        return {
            "i": jQuery.i18n.map["cohorts.entered-users"],
            "o": jQuery.i18n.map["cohorts.exited-users"]
        }
    },
    beforeRender: function () {
        if (this.formPartial)
            return $.when(countlyCohorts.initialize()).then(function () { });
        else {
            var self = this;
            return $.when($.get(countlyGlobal["path"] + '/cohorts/templates/cohorts.html', function (src) {
                self.template = Handlebars.compile(src);
            }), $.get(countlyGlobal["path"] + '/cohorts/templates/drawer.html', function (src) {
                self.formPartial = src;
            }), countlyCohorts.initialize()).then(function () { });
        }
    },
    onCohortSave: function (res) {
        this.closeDrawer();
        if (res.duplicate) {
            CountlyHelpers.alert(jQuery.i18n.prop("cohorts.exist", countlyCohorts.getName(res.result)), "red");
        }
        else {
            this.refresh();
        }
    },
    renderCommon: function (isRefresh) {
        var props = this.getProperties();
        var usage = [];

        for (var i in props) {
            usage.push({
                "title": props[i],
                "id": "cohort-metric-" + i
            });
        }

        var res = countlyCohorts.getResults();
        var selectText = jQuery.i18n.prop("cohorts.limit", countlyCommon.GRAPH_COLORS.length, jQuery.i18n.map["cohorts.cohorts"].toLowerCase());
        if (!res.length) {
            if (countlyGlobal["member"].global_admin || countlyGlobal["admin_apps"][countlyCommon.ACTIVE_APP_ID]) {
                selectText = jQuery.i18n.map["cohorts.create-cohort-compare"];
            }
            else {
                selectText = jQuery.i18n.map["cohorts.no-cohort-compare"];
            }
        }
        this.templateData = {
            "page-title": jQuery.i18n.map["cohorts.cohorts"],
            "usage": usage,
            "max-alternatives": countlyCommon.GRAPH_COLORS.length,
            "multi-select-text": selectText,
            "alternatives": countlyCohorts.getNames()
        };

        var self = this;
        if (!isRefresh) {
            $(this.el).html(this.template(this.templateData));

            var drawerViewDom = Handlebars.compile(self.formPartial)({
                "title": jQuery.i18n.map["cohorts.create-cohort"],
                "btn-cohort": jQuery.i18n.map["cohorts.create-cohort"]
            })
            $(".widget").after(drawerViewDom);
            app.localize();
            this.dtable = $('#dataTableOne').dataTable($.extend({}, $.fn.dataTable.defaults, {
                "aaData": countlyCohorts.getResults(),
                "fnRowCallback": function (nRow, aData, iDisplayIndex, iDisplayIndexFull) {
                    $(nRow).attr("data-id", aData._id);
                    $(nRow).data("name", aData.name);
                    $(nRow).data("steps", aData.steps);
                    $(nRow).data("user_segmentation", aData.user_segmentation);

                    if (aData.type === "auto")
                        $(nRow).attr("id", (aData._id + "").replace(/ /g, "_"));
                },
                "aoColumns": [
                    CountlyHelpers.expandRowIconColumn(),
                    { "mData": function (row, type) { if (type == "display") { 
                        return row.name + "<div class='color'></div>"; 
                    } else return row.name; }, "sType": "string", "sTitle": jQuery.i18n.map["cohorts.name"], "bSortable": true, "sClass": "break" },
                    {
                        "mData": function (row, type) {
                            if (type == "display") {
                                return (row.last_generated) ? countlyCommon.formatTimeAgo(row.last_generated) : jQuery.i18n.map["common.never"];
                            } else return row.last_generated || 0;
                        }, "sType": "string", "sTitle": jQuery.i18n.map["cohorts.generated"]
                    },
                    { "mData": function (row, type) { return jQuery.i18n.map["cohorts." + row.type]; }, "sType": "string", "sTitle": jQuery.i18n.map["common.type"] },
                    { "mData": function (row, type) { return row.result || 0; }, "sType": "numeric", "sTitle": jQuery.i18n.map["cohorts.users"] },
                    {
                        "mData": function (row, type) {
                            return '<a class="cly-list-options"></a>';
                        }, "sType": "string", "sTitle": "", "sClass": "shrink center", bSortable: false
                    },
                ]
            }));

            this.dtable.stickyTableHeaders();
            this.dtable.fnSort([[1, 'asc']]);

            CountlyHelpers.initializeTableOptions();

            $(".cly-button-menu").on("cly-list.click", function (event, data) {
                var id = $(data.target).parents("tr").data("id");
                if (id) {
                    if (countlyGlobal["member"].global_admin || countlyGlobal["admin_apps"][countlyCommon.ACTIVE_APP_ID]) {
                        $(".cohorts-menu").find(".delete-cohort").data("id", id);
                        $(".cohorts-menu").find(".delete-cohort").data("name", $(data.target).parents("tr").data("name"));
                        $(".cohorts-menu").find(".edit-cohort").data("id", id);
                        $(".cohorts-menu").find(".edit-cohort").data("name", $(data.target).parents("tr").data("name"));
                        $(".cohorts-menu").find(".edit-cohort").data("steps", $(data.target).parents("tr").data("steps"));
                        $(".cohorts-menu").find(".edit-cohort").data("user_segmentation", $(data.target).parents("tr").data("user_segmentation") || null);
                    }
                    else {
                        $(".cohorts-menu").find(".delete-cohort").hide();
                        $(".cohorts-menu").find(".edit-cohort").hide();
                    }
                    $(".cohorts-menu").find(".view-cohort").attr("href", "#/users/qfilter/{\"chr\":{\"$in\":[\"" + id + "\"]}}");
                }
            });

            $("#compare-button").on("click", function () {
                if ($(this).hasClass("disabled")) {
                    return;
                }

                $(this).addClass("disabled");

                var forAlternatives = $("#alternative-selector").data("value");
                countlyCohorts.unselectAll();
                self.dtable.find(".color").css("background-color", "transparent");
                for (var i = 0; i < forAlternatives.length; i++) {
                    countlyCohorts.select(forAlternatives[i]);
                }

                var persisteData = {};
                persisteData["cohort_" + countlyCommon.ACTIVE_APP_ID] = forAlternatives;
                countlyCommon.setPersistentSettings(persisteData);
                self.drawGraph();
            });

            $("#alternative-selector").on("cly-multi-select-change", function () {
                var selected = $("#alternative-selector").data("value");

                if (selected.length > 0) {
                    $("#compare-button").removeClass("disabled");
                } else {
                    $("#compare-button").addClass("disabled");
                }
            });

            $("#alternative-selector").trigger("click");

            var selectedData = countlyCommon.getPersistentSettings()["cohort_" + countlyCommon.ACTIVE_APP_ID] || countlyCohorts.getAllSelected();
            selectedData.forEach(function (id) {
                $("#alternative-selector .select-items [data-value=\"" + id + "\"]").trigger("click");
            });
            $(".alternative-selection #compare-button").trigger("click");

            CountlyHelpers.expandRows(this.dtable, this.formatCohort);

            $(".cly-button-menu").on("cly-list.item", function (event, data) {
                var id = $(data.target).data("id");
                var name = $(data.target).data("name");
                if ($(data.target).hasClass("delete-cohort") && id) {
                    CountlyHelpers.confirm(jQuery.i18n.prop("cohorts.confirm-delete", "<b>" + name + "</b>"), "popStyleGreen", function (result) {
                        if (!result) {
                            return true;
                        }
                        countlyCohorts.del(id, 0, function (json) {
                            var goAhead = function () {
                                $('#alternative-selector')
                                    .find('.select-inner')
                                    .find('[data-value="' + id + '"]')
                                    .find('.remove').trigger('click');
                                countlyCohorts.unselect(id);
                                countlyCohorts.removeName(id);
                                self.refresh();
                            };
                            if (json && json.ack) {
                                CountlyHelpers.confirm(jQuery.i18n.prop("cohorts.confirm-delete-push", json.ack), "popStyleGreen", function (result) {
                                    if (result) {
                                        countlyCohorts.del(id, json.ack, goAhead);
                                    }
                                }, [jQuery.i18n.map["common.no-dont-delete"], jQuery.i18n.map["cohorts.yes-delete-cohort"]], { title: jQuery.i18n.map["cohorts.confirm-delete-title"], image: "delete-cohort" });
                            } else {
                                goAhead();
                            }
                        });
                    }, [jQuery.i18n.map["common.no-dont-delete"], jQuery.i18n.map["cohorts.yes-delete-cohort"]], { title: jQuery.i18n.map["cohorts.confirm-delete-title"], image: "delete-cohort" });
                } else if ($(data.target).hasClass("edit-cohort") && id) {
                    var cohortData = $(data.target).data();
                    self.openDrawer(cohortData);
                }
            });

            $("#cohort-metric-" + this.selectedMetric).parents(".big-numbers").addClass("active");

            $(".widget-content .inner").click(function () {
                $(".big-numbers").removeClass("active");
                $(".big-numbers .select").removeClass("selected");
                $(this).parent(".big-numbers").addClass("active");
                $(this).find('.select').addClass("selected");
            });

            $(".big-numbers .inner").click(function () {
                var elID = $(this).find('.select').attr("id").replace("cohort-metric-", "");

                if (self.selectedMetric == elID) {
                    return true;
                }

                self.selectedMetric = elID;
                self.redrawGraph();
            });

            if (countlyGlobal["member"].global_admin || countlyGlobal["admin_apps"][countlyCommon.ACTIVE_APP_ID]) {
                $(".widget .widget-header #date-selector").after('<a style="float: left; margin-top: 6px; margin-left:20px;" class="icon-button green" id="create-cohort" data-localize="cohorts.create-cohort">Create Cohort</a>');
            }

            CohortsDrawerModule.init(this.onCohortSave.bind(this));
            $("#create-cohort").on("click", function () {
                self.openDrawer();
            });
        }
    },
    drawGraph: function () {
        var self = this;
        $.when(countlyCohorts.loadData(null, true)).then(function () {
            self.redrawGraph();
        });
    },
    redrawGraph: function () {
        var dp = [];
        var cohorts = countlyCohorts.getAllSelected();
        for (var i = 0; i < cohorts.length; i++) {
            var color = countlyCommon.GRAPH_COLORS[i];
            var data = countlyCohorts.getChartData(cohorts[i], this.selectedMetric, countlyCohorts.getName(cohorts[i])).chartDP;
            data[1].color = color;
            $("*[data-id=\"" + cohorts[i] + "\"] .color").css("background-color", color);
            var elem = $("#alternative-selector [data-value=\"" + cohorts[i] + "\"]");
            elem.find(".color").remove();
            elem.prepend("<div class='color'></div>");
            elem.find(".color").css("background-color", color);
            if (cohorts.length == 1) {
                var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
                data[0].color = "rgba(" + parseInt(result[1], 16) + "," + parseInt(result[2], 16) + "," + parseInt(result[3], 16) + ",0.5" + ")";
                dp.push(data[0])
            }
            dp.push(data[1]);
        }
        countlyCommon.drawTimeGraph(dp, "#dashboard-graph");
    },
    refresh: function () {
        var self = this;
        $.when(countlyCohorts.refresh(true)).then(function () {
            if (app.activeView != self) {
                return false;
            }
            self.renderCommon(true);
            newPage = $("<div>" + self.template(self.templateData) + "</div>");
            $(self.el).find(".alternative-selection .select-items").html(newPage.find(".alternative-selection .select-items").html());
            $(self.el).find(".alternative-selection .selection").each(function () {
                $(this).html(countlyCohorts.getName($(this).data("value")) + '<div class="remove"><i class="ion-android-close"></i></div>');
                $(self.el).find(".alternative-selection .select-items .item[data-value=\"" + $(this).data("value") + "\"]").addClass("selected");
            });
            var data = countlyCohorts.getResults();
            CountlyHelpers.refreshTable(self.dtable, data);
            CountlyHelpers.reopenRows(self.dtable, self.formatCohort);
            self.redrawGraph();
            app.localize();
        });
    },
    formatCohort: function (d) {
        // `d` is the original data object for the row
        var str = '';

        var formatQueryText = function(queryAsText) {
            var queryTextList = queryAsText.split('|');

            var textList = queryTextList.map(function (queryText) {
                return queryText.replace('drill.or', jQuery.i18n.map['drill.or']).replace('drill.and', jQuery.i18n.map['drill.and']);
            });

            return textList.join(" ");
        };

        if (d && d.steps && d.steps.length) {
            str += '<div class="datatablesubrow">' +
                '<table cellpadding="5" cellspacing="0" border="0" class="subtable">' +
                '<tr>' +
                '<th>' + jQuery.i18n.map["cohorts.behavior-type"] + '</th>' +
                '<th>' + jQuery.i18n.map["sidebar.events"] + '</th>' +
                '<th>' + jQuery.i18n.map["cohorts.period"] + '</th>' +
                '<th>' + jQuery.i18n.map["cohorts.frequency"] + '</th>' +
                '<th>' + jQuery.i18n.map["cohorts.query"] + '</th>' +
                '</tr>';
            for (var i = 0, l = d.steps.length; i < l; i++) {
                str += '<tr>';

                if (d.steps[i].type === "did")
                    str += '<td>' + jQuery.i18n.map["cohorts.performed-event"] + '</td>';
                else if (d.steps[i].type === "didnot")
                    str += '<td>' + jQuery.i18n.map["cohorts.not-perform-event"] + '</td>';
                else
                    str += '<td>' + d.steps[i].type + '</td>';

                if (d.steps[i].event === "[CLY]_session")
                    str += '<td>' + jQuery.i18n.map["cohorts.sessions"] + '</td>';
                else if (d.steps[i].event === "[CLY]_crash")
                    str += '<td>' + jQuery.i18n.map["cohorts.crash"] + '</td>';
                else if (d.steps[i].event === "[CLY]_view")
                    str += '<td>' + jQuery.i18n.map["cohorts.view"] + '</td>';
                else
                    str += '<td>' + d.steps[i].event + '</td>';

                if (d.steps[i].period === "0days")
                    str += '<td>' + jQuery.i18n.map["cohorts.all-time"] + '</td>';
                else
                    str += '<td>' + d.steps[i].period + '</td>';

                str += '<td>' + (d.steps[i].times || "{\"$gte\":1}") + '</td>';

                var queryText = "";
                if(d.steps[i] && d.steps[i].queryText){
                    queryText = formatQueryText(d.steps[i].queryText);
                }else if(d.steps[i] && d.steps[i].query){
                    queryText = d.steps[i].query;
                }

                str += '<td>' + queryText + '</td>';
                str += '</tr>';
            }
            str += '</table>' +
                '</div>';
        }
        
        if(d && d.user_segmentation){
            var marginTop = (d.steps && d.steps.length) ? "20px" : "0px";
            str += '<div class="datatablesubrow" style="margin-top:' + marginTop + '">' +
                '<table cellpadding="5" cellspacing="0" border="0" class="subtable">' +
                '<tr>' +
                '<th>USER SEGMENTATION</th>' +
                '</tr>';
            var queryText = (d.user_segmentation && d.user_segmentation.queryText) ? formatQueryText(d.user_segmentation.queryText) : "";
            str += '<tr><td>' + queryText + '</td></tr>'
            str += '</table>' +
                '</div>';
        }
        return str;
    },
    openDrawer: function (selectedCohort) {
        CohortsDrawerModule.open(selectedCohort);
    },
    closeDrawer: function () {
        CohortsDrawerModule.hide();
    }
});

//register views
app.cohortsView = new CohortsView();
app.route("/cohorts", "cohorts", function () {
    this.renderWhenReady(this.cohortsView);
});

app.addPageScript("/custom#", function() {
    addWidgetType();
    addSettingsSection();

    function addWidgetType() {
        var cohortsWidget = '<div data-widget-type="cohorts" class="opt dashboard-widget-item">' +
        '<div class="inner">' +
        '<span class="icon dashboard-cohorts-widget-icon"></span>' + jQuery.i18n.prop("cohorts.cohorts") +
        '</div>' +
        '</div>';

        $("#widget-drawer .details #widget-types .opts").append(cohortsWidget);
    }


    function addSettingsSection() {
        var cohortSelection = '<div id="widget-section-cohort-select" class="settings section">' +
                        '    <div class="label">' + jQuery.i18n.prop("cohorts.cohort") + '</div>' +
                        '    <div id="cohort-select-dropdown" class="cly-select" style="width: 100%; box-sizing: border-box;">' +
                        '        <div class="select-inner">' +
                        '            <div class="text-container">' +
                        '                <div class="text">' +
                        '                    <div class="default-text">' + jQuery.i18n.prop("cohorts.select-a-cohort") + '</div>' +
                        '                </div>' +
                        '            </div>' +
                        '            <div class="right combo"></div>' +
                        '        </div>' +
                        '        <div class="select-items square" style="width: 100%;"></div>' +
                        '    </div>' +
                        '</div>';

        $(cohortSelection).insertAfter(".cly-drawer .details .settings:last");
    }

    $("#single-app-dropdown").on("cly-select-change", function(e, selected) {
        $("#cohort-select-dropdown").clySelectSetSelection("", jQuery.i18n.prop("cohorts.select-a-cohort"));
        if (selected) {
            $.when(
                countlyCohorts.loadList(selected)
            ).done(function () {
                var cohorts = countlyCohorts.getNames();
                var cohortsArray = [];
                for (var c in cohorts) {
                    cohortsArray.push({ "name": cohorts[c], "value": c });
                }
                $('#cohort-select-dropdown').clySelectSetItems(cohortsArray);
            });
        }
    });

    $('#cohort-select-dropdown').on('cly-select-change', function(e, selected) {
        $("#widget-drawer").trigger("cly-widget-section-complete");
    })

    $("#fullscreen, #fullscreen-alt").on("click", function() {
        if (screenfull.enabled && !screenfull.isFullscreen) {
            $('.spark').css({'text-align': 'center', 'padding-left': '0px', 'margin-top': '20px'});
            $('.cohorts').css({'text-align':'center'});
            $('.cohorts .trend.normal').hide();
            $('.cohorts .trend.full-screen').show();
        } else {
            $('.spark').css({'text-align': 'left', 'padding-left': '10px', 'margin-top': '0px'});
            $('.cohorts').css({'text-align':'left'});
            $('.cohorts .trend.normal').show();
            $('.cohorts .trend.full-screen').hide();
        }
    });

    if (screenfull.enabled) {
        document.addEventListener(screenfull.raw.fullscreenchange, function() {
            if (!screenfull.isFullscreen) {
                $('.spark').css({'text-align': 'left', 'padding-left': '10px', 'margin-top': '0px'});
                $('.cohorts').css({'text-align':'left'});
                $('.cohorts .trend.normal').show();
                $('.cohorts .trend.full-screen').hide();
            }
        });
    }
});

$(document).ready(function () {
    app.addAppSwitchCallback(function (app_id) {
        if (app._isFirstLoad != true) {
            countlyCohorts.reset();
            if (countlyGlobal.member && countlyGlobal.member.api_key && countlyCommon.ACTIVE_APP_ID) {
                countlyCohorts.loadList(countlyCommon.ACTIVE_APP_ID);
            }
        }
    });
    app.addSubMenu("users", {code:"cohorts", url:"#/cohorts", text:"cohorts.cohorts", priority:20});
    initializeCohortWidget();
});

function initializeCohortWidget() {

    if (countlyGlobal["plugins"].indexOf("dashboards") < 0) {
        return;
    }

    var cohortWidgetTemplate;

    $.when(
        $.get(countlyGlobal["path"] + '/cohorts/templates/widget.html', function(src){
            cohortWidgetTemplate = Handlebars.compile(src);
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

        app.addWidgetCallbacks("cohorts", widgetOptions);
    });

    function initWidgetSections() {
        var selWidgetType = $("#widget-types").find(".opt.selected").data("widget-type");
        
        if(selWidgetType != "cohorts") {
            return;
        }

        var cohorts = countlyCohorts.getNames();
        var cohortsArray = [];
        for (var c in cohorts) {
            cohortsArray.push({ "name": cohorts[c], "value": c });
        }
        $('#cohort-select-dropdown').clySelectSetItems(cohortsArray);

        $("#widget-drawer .details #data-types").parent(".section").hide();
        $('#widget-section-cohort-select').show();
        $("#widget-section-single-app").show();
    }

    /**
     * Get Widget settings
     * @returns {object} | Settings object
     */
    function widgetSettings() {
       var $singleAppDrop = $("#single-app-dropdown"),
           $selectedCohort = $('#cohort-select-dropdown');

       var selectedApp = $singleAppDrop.clySelectGetSelection(),
           selectedCohort = $selectedCohort.clySelectGetSelection();
       
       var settings = {
           apps: (selectedApp) ? [ selectedApp ] : [],
           cohorts: (selectedCohort) ? [ selectedCohort ] : [],
           cohortName: $selectedCohort.find(".select-inner .text").text()
       };

       return settings;
    }

    function addPlaceholder(dimensions) {
        dimensions.min_height = 3;
        dimensions.min_width = 2;
        dimensions.width = 2;
        dimensions.height = 3;
    }

    function sumCohortUsers(data) {
        for (var year in data) {
            if (year !== 'meta') {
                for (var month in data[year]) {
                    for (var day in data[year][month]) {
                        for (var hour in data[year][month][day]) {
                            if (hour !== 'i' && hour !== 'o') {
                                if (data[year][month][day][hour].hasOwnProperty('i') && data[year][month][day][hour].hasOwnProperty('o')) {
                                    data[year][month][day][hour].tc = data[year][month][day][hour].i - data[year][month][day][hour].o;
                                } else if (data[year][month][day][hour].hasOwnProperty('i')) {
                                    data[year][month][day][hour].tc = data[year][month][day][hour].i;
                                } else if (data[year][month][day][hour].hasOwnProperty('o')) {
                                    data[year][month][day][hour].tc = -data[year][month][day][hour].o;
                                }
                            }
                        }
                        if (day !== 'i' && day !== 'o') {
                            if (data[year][month][day].hasOwnProperty('i') && data[year][month][day].hasOwnProperty('o')) {
                                data[year][month][day].tc = data[year][month][day].i - data[year][month][day].o;
                            } else if (data[year][month][day].hasOwnProperty('i')) {
                                data[year][month][day].tc = data[year][month][day].i;
                            } else if (data[year][month][day].hasOwnProperty('o')) {
                                data[year][month][day].tc = -data[year][month][day].o;
                            }
                        }
                    }
                    if (month !== 'i' && month !== 'o') {
                        if (data[year][month].hasOwnProperty('i') && data[year][month].hasOwnProperty('o')) {
                            data[year][month].tc = data[year][month].i - data[year][month].o;
                        } else if (data[year][month].hasOwnProperty('i')) {
                            data[year][month].tc = data[year][month].i;
                        } else if (data[year][month].hasOwnProperty('o')) {
                            data[year][month].tc = -data[year][month].o;
                        }    
                    }
                }
                if (data[year].hasOwnProperty('i') && data[year].hasOwnProperty('o')) {
                    data[year].tc = data[year].i - data[year].o;
                } else if (data[year].hasOwnProperty('i')) {
                    data[year].tc = data[year].i;
                } else if (data[year].hasOwnProperty('o')) {
                    data[year].tc = -data[year].o;
                }
            }
        }
        return data;
    }

    function clearObject(obj) {
        if (obj) {
            if (!obj.i) {
                obj.i = 0;
            }
            if (!obj.o) {
                obj.o = 0;
            }
            if (!obj.tc) {
                obj.tc = 0;
            }
        }
        else {
            obj = { "i": 0, "o": 0, "tc": 0 };
        }
        return obj;
    }
    function createWidgetView(widgetData){
        // format data and render widget
        formatData(widgetData);
        render();
        function render() {
            // define widget variables
            placeHolder = widgetData.placeholder,
            apps = widgetData.apps,
            cohort = widgetData.cohort,
            data = widgetData.formattedData;
            var appName = countlyDashboards.getAppName(apps[0]),
            appId = apps[0];
            // generate trend data and check exceptional cases
            var dataForTrend = sumCohortUsers(data.cohortTimeObj[0].data);
            var trendData = countlyCommon.getDashboardData(dataForTrend, ["tc"], [], {tc:"total-cohort"}, clearObject);
            if (typeof trendData.tc["prev-total"] === "undefined") {
                trendData.tc["prev-total"] = 0;
                trendData.tc["change"] = 'NA';
            }
            if (typeof trendData.tc["total"] === "undefined") {
                trendData.tc["total"] = 0;
                trendData.tc["change"] = 'NA';
            }
            // generate sparkline data
            var sparkData = countlyCommon.getSparklineData(data.cohortTimeObj[0].data, {"in-users":"i", "out-users":"o"}, clearObject);
            var inArray = sparkData["in-users"].split(","),
                outArray = sparkData["out-users"].split(",");
            var sparkline = [];
            for (var index = 0; index < inArray.length; index++) {
                sparkline.push(Math.max(inArray[index] - outArray[index], 0));
            }
            // create widget template
            var $widget = $(cohortWidgetTemplate({
                title: widgetData.title || widgetData.cohortName,
                cohortNumber: data.cohortUsersCount,
                totalNumber: data.totalUsersCount,
                cohort: cohort,
                percentage: ((data.cohortUsersCount / data.totalUsersCount) * 100).toFixed(0),
                sparkline: sparkline,
                trend: generateTrend(trendData.tc.change),
                trend_fullscreen: generateTrendForFullScreen(trendData.tc.change),
                app: {
                    id: appId,
                    name: appName
                }
            }));
            // draw sparkline
            drawSparkline(".spark");
            // render widget
            placeHolder.find("#loader").fadeOut();
            placeHolder.find(".cly-widget").html($widget.html());
            // localization
            app.localize(placeHolder);
            // full screen alignments
            if ($("html").hasClass("full-screen")) {
                $('.spark').css({'text-align': 'center', 'padding-left': '0px', 'margin-top': '20px'});
                $('.cohorts').css({'text-align':'center'});
                $('.cohorts .trend.normal').hide();
                $('.cohorts .trend.full-screen').show();
            }
        }
    }

    /**
     * Format widget data
     * @param {object} widgetData | Widget data
     */
    function formatData(widgetData) {
        widgetData.formattedData = {
            cohortUsersCount: widgetData.dashData.cohortUsersCount,
            cohortTimeObj: widgetData.dashData.cohortTimeObj,
            totalUsersCount: widgetData.dashData.totalUsers
        };
    }

    function resetWidget(){
        $("#cohort-select-dropdown").clySelectSetSelection("", jQuery.i18n.prop("cohorts.select-a-cohort"));
    }

    function setWidget(widgetData){
        var apps = widgetData.apps,
        cohort = widgetData.cohorts[0],
        cohortName = widgetData.cohortName;
        
        var $singleAppDrop = $("#single-app-dropdown"),
        $cohortDrop = $("#cohort-select-dropdown");

        $singleAppDrop.clySelectSetSelection(apps[0], countlyDashboards.getAppName(apps[0]));
        $cohortDrop.clySelectSetSelection(cohort, cohortName);
    }

    function refreshWidget(widgetEl, widgetData) {
        // format widget data
        formatData(widgetData);
        // define widget variables
        var title = widgetData.title,
            apps = widgetData.apps,
            cohort = widgetData.cohort,
            data = widgetData.formattedData;
        var appName = countlyDashboards.getAppName(apps[0]),
        appId = apps[0];
        // generate trend data and check exceptional cases
        var dataForTrend = sumCohortUsers(data.cohortTimeObj[0].data);
        var trendData = countlyCommon.getDashboardData(dataForTrend, ["tc"], [], {tc:"total-cohort"}, clearObject);
        if (typeof trendData.tc["prev-total"] === "undefined") {
            trendData.tc["prev-total"] = 0;
            trendData.tc["change"] = 'NA';
        }
        if (typeof trendData.tc["total"] === "undefined") {
            trendData.tc["total"] = 0;
            trendData.tc["change"] = 'NA';
        }
        var change = trendData.tc.change;
        // generate sparkline data
        var sparkData = countlyCommon.getSparklineData(data.cohortTimeObj[0].data, {"in-users":"i", "out-users":"o"}, clearObject);
        var inArray = sparkData["in-users"].split(","),
            outArray = sparkData["out-users"].split(",");
        var sparkline = [];
        for (var index = 0; index < inArray.length; index++) {
            sparkline.push(Math.max(inArray[index] - outArray[index]), 0);
        }
        // refresh values
        widgetEl.find(".spark").attr("values", sparkline);
        widgetEl.find(".trend .val").replaceWith(generateTrend(change));
        widgetEl.find(".trend.full-screen").html(generateTrendForFullScreen(change));
        drawSparkline(".spark");
        // number change animation
        var valueEl = widgetEl.find(".value"),
            currVal = parseFloat(valueEl.text()) || 0,
            targetVal = widgetData.formattedData.cohortUsersCount;
        if (targetVal != currVal) {
            jQuery({someValue: currVal, currEl: valueEl}).animate({someValue: targetVal}, {
                duration: 2000,
                easing: 'easeInOutQuint',
                step: function () {
                    if ((targetVal + "").indexOf(".") == -1) {
                        this.currEl.text(Math.round(this.someValue));
                    } else {
                        this.currEl.text(parseFloat((this.someValue).toFixed(1)));
                    }
                }
            });
        }
        // localization
        app.localize(widgetEl);
        // full screen changes
        if ($("html").hasClass("full-screen")) {
            $('.cohorts .spark').css({'text-align': 'center', 'padding-left': '0px', 'margin-top': '20px'});
            $('.cohorts').css({'text-align':'center'});
            $('.cohorts .trend.normal').hide();
            $('.cohorts .trend.full-screen').show();
        }
    }

    function generateTrend(changePercent) {
        var $toRet = $("<span class='val'>");

        if (changePercent.indexOf("-") !== -1) {
            $toRet.text(changePercent.replace("-","") + " lower");
            $toRet.addClass("down");
        } else if (changePercent.indexOf("âˆž") !== -1 || changePercent.indexOf("NA") !== -1) {
            $toRet.text("unknown");
            $toRet.addClass("unknown");
        } else {
            $toRet.text(changePercent + " higher");
            $toRet.addClass("up");
        }

        return $toRet[0].outerHTML;
    }

    function generateTrendForFullScreen(changePercent) {
        var $toRet = $("<span>");

        if (changePercent.indexOf("-") !== -1) {
            $toRet.text(changePercent);
            $toRet.addClass("down");
            $toRet.append('<i class="material-icons">trending_down</i>');
        } else if (changePercent.indexOf("âˆž") !== -1 || changePercent.indexOf("NA") !== -1) {
            $toRet.addClass("unknown");
            $toRet.append('<i class="material-icons">trending_flat</i>');
        } else {
            $toRet.text(changePercent);
            $toRet.addClass("up");
            $toRet.append('<i class="material-icons">trending_up</i>');
        }

        return $toRet[0].outerHTML;
    }

    function drawSparkline(selector) {
        $(selector).sparkline('html', {
            type: 'line',
            height: '40',
            width: '150',
            lineColor: '#49c1e9',
            fillColor: "transparent",
            lineWidth: 1.5,
            spotColor: '#49c1e9',
            minSpotColor: "transparent",
            maxSpotColor: "transparent",
            highlightSpotColor: "transparent",
            highlightLineColor: "transparent",
            spotRadius: 3,
            drawNormalOnTop: false,
            disableTooltips: true
        });
    }
}
$(document).ready(function() {
    if (app.configurationsView) {
        app.configurationsView.registerLabel("cohorts", "cohorts.cohorts");
        app.configurationsView.registerLabel("cohorts.regenerate_interval", "cohorts.regenerate_interval")
        app.configurationsView.registerInput("cohorts.regenerate_interval", function (value) {
            //5 minutes | 30 minutes | 1 hour | 3 hours | 12 hours | 24 hours
            var values = {
                300:jQuery.i18n.prop("common.every.minutes", 5), 
                1800:jQuery.i18n.prop("common.every.minutes", 30),
                3600:jQuery.i18n.prop("common.every.hour", 1),
                10800:jQuery.i18n.prop("common.every.hours", 3),
                43200:jQuery.i18n.prop("common.every.hours", 12),
                86400:jQuery.i18n.prop("common.every.hours", 24)
            };
            var select = '<div class="cly-select" id="cohorts.regenerate_interval">' +
                '<div class="select-inner">' +
                '<div class="text-container">';
            if (!values[value]) {
                select += '<div class="text"></div>';
            }
            else {
                select += '<div class="text">' + values[value] + '</div>';
            }

            select += '</div>' +
                '<div class="right combo"></div>' +
                '</div>' +
                '<div class="select-items square">' +
                '<div>';

            for (var i in values) {
                select += '<div data-value="' + i + '" class="segmentation-option item">' + values[i] + '</div>';
            }

            select += '</div>' +
                '</div>' +
                '</div>';
            return select;
        
        });
    }
});