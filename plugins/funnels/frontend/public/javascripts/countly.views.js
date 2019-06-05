window.FunnelView = countlyView.extend({
    previousPeriod: null,
    viewName: "funnels",
    beforeRender: function () {
        if (!_.isEmpty(this.filterObj)) {
            this.filterObj = {};
            countlyFunnel.setFilter(this.filterObj);
        }

        if (this.template)
            return $.when(countlyFunnel.initialize(this._task, countlyCommon.getPersistentSettings()["activeFunnel_" + countlyCommon.ACTIVE_APP_ID])).then(function () {
            });
        else {
            var self = this;
            return $.when($.get(countlyGlobal["path"] + '/funnels/templates/funnels.html', function (src) {
                self.template = Handlebars.compile(src);
            }), $.get(countlyGlobal["path"] + '/funnels/templates/drawer.html', function (src) {
                self.drawerView = Handlebars.compile(src);
            }), countlyFunnel.initialize(this._task, countlyCommon.getPersistentSettings()["activeFunnel_" + countlyCommon.ACTIVE_APP_ID])).then(function () {
            });
        }
    },
    initialize: function () { },
    onFunnelSave: function (err, result, isEdit, funnelMap, funnelId) {
        if (err) {
            if (err.responseText) {
                try {
                    err = JSON.parse(err.responseText);
                }
                catch (ex) { }
            }
            if (err.result)
                CountlyHelpers.alert(err.result);
        } else {
            if (isEdit) {
                funnelMap[funnelId].name = funnelMap[funnelId].funnel_name;
                funnelMap[funnelId].description = funnelMap[funnelId].funnel_desc;
                countlyFunnel.setFunnels(funnelMap);
                this.hideDrawer();
                this.loadAndDraw(true);
                $('#funnel-edit-view').hide();
                $('#funnel-common-view').show();
            } else {
                if (!result.result) {
                    CountlyHelpers.alert(jQuery.i18n.map['funnels.funnel-duplicate-message']);
                    return;
                }

                this.hideDrawer();
                if (result && result.result && countlyFunnel.getFunnels().length) {
                    countlyFunnel.setActiveFunnel(result.result);
                    countlyFunnel.initFunnels();
                    this.loadAndDraw(true);
                } else {
                    var self = this;
                    $.when(countlyFunnel.initialize()).then(function () {
                        self.loadAndDraw(true);
                    });
                }
            }
        }
    },
    hideDrawer: function () {
        FunnelDrawerModule.hide();
    },
    openDrawer: function (selectedFunnel) {
        FunnelDrawerModule.open(selectedFunnel);
    },
    initFunnelView: function () {
        var self = this;
        $("#create-funnel-button").on("click", function () {
            self.openDrawer();
        });
        this.drawFunnelView();
    },
    initNewFunnelView: function () {
        $("#funnel-edit-view").after(this.drawerView);
        FunnelDrawerModule.init(this.onFunnelSave.bind(this));
    },
    setFilterInfoTooltip: function (tmpFunnelStepInfo, step) {
        // filter icon
        if (!step.queryText) {
            tmpFunnelStepInfo.find(".segment-icon").show();
            tmpFunnelStepInfo.find(".segment-icon").tooltipster({
                animation: 'fade',
                animationDuration: 100,
                delay: 100,
                theme: 'tooltipster-borderless',
                trigger: 'custom',
                triggerOpen: { mouseenter: true, touchstart: true },
                triggerClose: {
                    mouseleave: true, touchleave: true
                },
                interactive: true,
                contentAsHTML: true,
                functionInit: function (instance, helper) {
                    instance.content(jQuery.i18n.map["funnels.segmentation-applied"] + "<br/>" + JSON.stringify(step.query));
                }
            });
            return;
        }
        // funnel query description;
        var queryTextList = step.queryText.split('|');
        var viewList = queryTextList.length > 1 ? [queryTextList[0], queryTextList[1]] : queryTextList;

        var shortDomList = viewList.map(function (queryText) {
            return "<div>" + queryText.replace('drill.or', '<span>' + jQuery.i18n.map['drill.or'] + '</span>').replace('drill.and', '<span>' + jQuery.i18n.map['drill.and'] + '</span>') + "</div>"
        });

        var diffDomList = queryTextList.reduce(function (prev, current) {
            if (viewList.indexOf(current) >= 0) return prev;
            prev += "<div>" + current + "</div>";
            return prev;
        }, "");

        tmpFunnelStepInfo.find('.step-queryText').html(shortDomList);

        if (queryTextList.length > 2) {
            var differance = queryTextList.length - viewList.length;
            var tooltipText = differance > 1 ? jQuery.i18n.prop('funnels.query-text-more-plural', differance) : jQuery.i18n.prop('funnels.query-text-more', differance);
            tmpFunnelStepInfo.find('.step-queryText-all').html(tooltipText);

            tmpFunnelStepInfo.find('.step-queryText-all').show();
            tmpFunnelStepInfo.find('.step-queryText-all').tooltipster({
                position: "right",
                animation: 'fade',
                animationDuration: 100,
                delay: 100,
                theme: 'tooltipster-borderless',
                trigger: 'custom',
                triggerOpen: { mouseenter: true, touchstart: true },
                triggerClose: {
                    mouseleave: true, touchleave: true
                },
                interactive: true,
                contentAsHTML: true,
                functionInit: function (instance, helper) {
                    instance.content(diffDomList);
                }
            })
        }

    },
    drawFunnelView: function () {
        $("#view-funnel").find(".funnel-name-title").text(countlyFunnel.getActiveFunnelName());
        $("#view-funnel").find(".funnel-name-title").attr('title', countlyFunnel.getActiveFunnelName());

        if (countlyFunnel.getActiveFunnelDesc().length > 0) {
            $("#view-funnel").find(".funnel-description").show();
            $("#view-funnel").find(".funnel-description").text(countlyFunnel.getActiveFunnelDesc());
        }
        else
            $("#view-funnel").find(".funnel-description").hide();

        var funnelData = countlyFunnel.getFunnelData();

        this.setTempPeriodForTask()
        if (funnelData.steps && funnelData.steps.length) {
            if ($("#view-funnel").is(":hidden")) {
                $("#view-funnel").show();
                $("#new-funnel").hide();
                $("#funnel-save").find(".text").text(jQuery.i18n.map["common.save"]);
            }

            $("#view-funnel").find(".total-users").data("target", funnelData.total_users);
            $("#view-funnel").find(".users-in-first-step").data("target", funnelData.users_in_first_step);
            $("#view-funnel").find(".success_users").data("target", funnelData.success_users);

            var userEnteredPercentage = funnelData.users_in_first_step/funnelData.total_users*100;
            var userCompletedPercentage = funnelData.success_users/funnelData.total_users*100;
            var userCompletedPercentageByEntered = funnelData.success_users/funnelData.users_in_first_step*100;

            userEnteredPercentage = jQuery.i18n.prop('funnels.user-enter-percentage', isNaN(userEnteredPercentage) ? 0 : countlyCommon.formatNumber(userEnteredPercentage));
            userCompletedPercentage = jQuery.i18n.prop('funnels.user-completed-percentage', isNaN(userCompletedPercentage) ? 0 : countlyCommon.formatNumber(userCompletedPercentage));
            
            userCompletedPercentageByEntered = jQuery.i18n.prop('funnels.user-completed-percentage-by-entered', isNaN(userCompletedPercentageByEntered) ? 0 : countlyCommon.formatNumber(userCompletedPercentageByEntered));

            $("#view-funnel").find(".user-entered-percent").html(userEnteredPercentage);
            $("#view-funnel").find('.user-completed-percentage').html(userCompletedPercentage);
            $("#view-funnel").find('.user-completed-percentage-by-entered').html(userCompletedPercentageByEntered);
            // $("#view-funnel").find(".success_rate").data("target", funnelData.success_rate);

            var funnelStepInfo = $("#view-funnel").find(".funnel-step-info").clone(),
                funnelStepData = $("#view-funnel").find(".funnel-step-data").clone();

            funnelStepInfo.removeClass("funnel-step-info");
            funnelStepData.removeClass("funnel-step-data");

            $("#view-funnel").find(".funnel-events").empty();
            $("#view-funnel").find(".funnel-step-data-container").empty();

            var verticalLine = $('<div class="vertical-line"></div>');
            $("#view-funnel").find(".funnel-step-data-container").append(verticalLine);


            for (var i = 0; i < funnelData.steps.length; i++) {
                var tmpFunnelStepInfo = funnelStepInfo.clone(),
                    tmpFunnelStepData = funnelStepData.clone();
                tmpFunnelStepInfo.find(".step-name").text(funnelData.steps[i].step === "[CLY]_view" ? jQuery.i18n.map['funnels.view'] : funnelData.steps[i].step);
                if (funnelData.steps[i].query && Object.keys(funnelData.steps[i].query).length > 0) {
                    this.setFilterInfoTooltip(tmpFunnelStepInfo, funnelData.steps[i]);
                }

                var stepUsers = funnelData.steps[i].users;
                var stepLeftUsers = (i===0 && countlyFunnel.funnelViewType === 1) ? 0: funnelData.steps[i].leftUsers;
                var stepTimes = funnelData.steps[i].times;

                var stepPercent = countlyFunnel.funnelViewType === 0 ? funnelData.steps[i].percent : funnelData.steps[i].percentUserEntered;
                var stepPercentLeft = countlyFunnel.funnelViewType === 0 ? funnelData.steps[i].percentLeft : funnelData.steps[i].percentLeftUserEntered;

                if(i===0 && countlyFunnel.funnelViewType === 1){
                    tmpFunnelStepData.find('.step-users-percent-left-bar').hide();
                    tmpFunnelStepData.find('.step-users-percent-left').hide();
                    tmpFunnelStepData.find('.users-left').hide();
                }else{
                    tmpFunnelStepData.find('.step-users-percent-left-bar').show();
                    tmpFunnelStepData.find('.step-users-percent-left').show();
                    tmpFunnelStepData.find('.users-left').show();
                }
                
                tmpFunnelStepData.find(".connector span").text(i + 1);
                tmpFunnelStepData.find(".step-users").data("target", stepUsers);
                tmpFunnelStepData.find(".step-users-left").data("target", stepLeftUsers);
                tmpFunnelStepData.find(".step-times").data("target", stepTimes);
                tmpFunnelStepData.find(".step-users-percent").data("percent", stepPercent);
                tmpFunnelStepData.find(".step-users-percent-left").data("percent", stepPercentLeft);
                tmpFunnelStepData.find(".step-users-percent-bar").data("percent", stepPercent);
                tmpFunnelStepData.find(".step-users-percent-info").data("percent", stepPercent);
                tmpFunnelStepData.find(".step-users-percent-left-bar").data("percent", stepPercentLeft);
                tmpFunnelStepData.addClass("funnel-step-" + i);

                if (typeof countlyUserdata != "undefined" && stepUsers > 0) {
                    var request = countlyFunnel.getRequestData();
                    request.users_for_step = i;
                    tmpFunnelStepData.find(".users").wrap("<a href='#/users/request/" + JSON.stringify(request) + "' class='funnel-user-list'></a>");
                }

                if (typeof countlyUserdata != "undefined" && stepLeftUsers > 0) {
                    var request = countlyFunnel.getRequestData();
                    request.users_between_steps = i - 1 + "|" + i;
                    tmpFunnelStepData.find(".users-left").wrap("<a href='#/users/request/" + JSON.stringify(request) + "' class='funnel-user-list'></a>");
                }

                $("#view-funnel").find(".funnel-events").append(tmpFunnelStepInfo.show());
                $("#view-funnel").find(".funnel-step-data-container").append(tmpFunnelStepData.show());
            }

            verticalLine.css({
                height: ($('.funnel-events').height() - 120) + "px",
                top: "50px"
            });

            this.animateNumbers(2000);

            $("#view-funnel").find(".funnel-events>div").hide();

            $("#view-funnel").find(".funnel-events>div").each(function (i) {
                if (!$(this).hasClass("funnel-step-info")) {
                    var el = $(this);
                    setTimeout(function () { el.fadeIn(); }, (i * 300));
                }
            });
            $('#empty-funnel').hide();
        } else {
            $("#view-funnel").hide();
            $('#empty-funnel').show();
        }
        this.clearTempPeriodForTask();
        this.taskReportRemind();
    },
    refreshFunnelView: _.debounce(function () {
        var funnelData = countlyFunnel.getFunnelData();

        if (funnelData.steps && funnelData.steps.length) {
            $("#view-funnel").find(".total-users").data("target", funnelData.total_users);
            $("#view-funnel").find(".users-in-first-step").data("target", funnelData.users_in_first_step);
            $("#view-funnel").find(".success_users").data("target", funnelData.success_users);
            $("#view-funnel").find(".success_rate").data("target", funnelData.success_rate);
            for (var i = 0; i < funnelData.steps.length; i++) {
                var tmpFunnelStepData = $($("#view-funnel").find(".funnel-step-data-container>div")[i + 1]);

                var stepUsers = funnelData.steps[i].users;
                var stepLeftUsers = (i===0 && countlyFunnel.funnelViewType === 1) ? 0: funnelData.steps[i].leftUsers;
                var stepTimes = funnelData.steps[i].times;

                var stepPercent = countlyFunnel.funnelViewType === 0 ? funnelData.steps[i].percent : funnelData.steps[i].percentUserEntered;
                var stepPercentLeft = countlyFunnel.funnelViewType === 0 ? funnelData.steps[i].percentLeft : funnelData.steps[i].percentLeftUserEntered;

                if(i===0 && countlyFunnel.funnelViewType === 1){
                    tmpFunnelStepData.find('.step-users-percent-left-bar').hide();
                    tmpFunnelStepData.find('.step-users-percent-left').hide();
                    tmpFunnelStepData.find('.users-left').hide();
                }else{
                    tmpFunnelStepData.find('.step-users-percent-left-bar').show();
                    tmpFunnelStepData.find('.step-users-percent-left').show();
                    tmpFunnelStepData.find('.users-left').show();
                }


                tmpFunnelStepData.find(".step-users").data("target", stepUsers);
                tmpFunnelStepData.find(".step-users-left").data("target", stepLeftUsers);
                tmpFunnelStepData.find(".step-times").data("target", stepTimes);
                tmpFunnelStepData.find(".step-users-percent").data("percent", stepPercent);
                tmpFunnelStepData.find(".step-users-percent-left").data("percent", stepPercentLeft);
                tmpFunnelStepData.find(".step-users-percent-bar").data("percent", stepPercent);
                tmpFunnelStepData.find(".step-users-percent-info").data("percent", stepPercent);
                tmpFunnelStepData.find(".step-users-percent-left-bar").data("percent", stepPercentLeft);

                var request = countlyFunnel.getRequestData();

                // We can't filter users based on event segments so if
                // filter contains an event segment we don't attach a user profile link
                if ((request.filter + "").indexOf("sg.") == -1) {

                    if (typeof countlyUserdata != "undefined" && stepUsers > 0) {
                        var request = countlyFunnel.getRequestData();

                        request.users_for_step = i;
                        tmpFunnelStepData.find(".users").parent("a").attr("href", "#/users/request/" + JSON.stringify(request));
                    }

                    if (typeof countlyUserdata != "undefined" && stepLeftUsers > 0) {
                        var request = countlyFunnel.getRequestData();

                        request.users_between_steps = i - 1 + "|" + i;
                        tmpFunnelStepData.find(".users-left").parent("a").attr("href", "#/users/request/" + JSON.stringify(request));
                    }
                } else {
                    tmpFunnelStepData.find(".users").parent("a").attr("href", "");
                }
            }

            this.animateNumbers(1000);
        }
    }, 500),
    loadAndDraw: function (refreshFunnelList) {
        var self = this;

        $.when(countlyFunnel.initCurrentFunnel()).then(function () {
            self.drawFunnelView();

            if (refreshFunnelList) {
                self.refreshFunnelList();
            }
        });
    },
    loadAndRefresh: function () {
        var self = this;
        countlyFunnel.setFilter(self.filterObj);
        $.when(countlyFunnel.initCurrentFunnel()).then(function () {
            self.refreshFunnelView();
        });
    },
    animateNumbers: function (duration) {
        var animDur = (duration) ? duration : 2000;

        $(".moving-bar").each(function (i) {
            var target = $(this).data("percent");
            // target *= 0.75;
            target *= 0.90;
            target = (target == 0) ? 1 : target;

            var self = $(this);
            setTimeout(function () {
                self.css({
                    transition: "width " + ((animDur == 2000) ? 1.8 : 0.8) + "s",
                    width: target + "%"
                });
            }, 0);
        });

        $('.moving-number').each(function (i) {
            var el = $(this),
                currVal = el.text().replace("%", "") || 0,
                target = el.data("percent");

            jQuery({ someValue: currVal, currEl: el }).animate({ someValue: target }, {
                duration: animDur,
                easing: 'easeInOutQuint',
                step: function () {
                    this.currEl.text(Math.round(this.someValue) + "%");
                }
            });
        });

        $('.num-animation').each(function (i) {
            var el = $(this),
                currVal = el.text() || 0,
                target = el.data("target");

            jQuery({ someValue: currVal, currEl: el }).animate({ someValue: target }, {
                duration: animDur,
                easing: 'easeInOutQuint',
                step: function () {
                    this.currEl.text(Math.round(this.someValue));
                }
            });
        });
    },
    pageScript: function () {
        var self = this;
        $(document).off("click", "#funnel-configure-button");
        $(document).on("click", "#funnel-configure-button", function () {
            $('#funnel-common-view').hide();
            $('#funnel-edit-view').show();
            self.hideDrawer();
        });

        $(document).off("click", "#back-to-funnels");
        $(document).on("click", "#back-to-funnels", function () {
            $('#funnel-edit-view').hide();
            $('#funnel-common-view').show();
            self.hideDrawer();
        });
        $(document).off("click", ".funnel-container");
        $(document).on("click", ".funnel-container", function () {
            if ($(this).hasClass("active")) {
                return;
            }
            $(".funnel-container").removeClass("active");
            $(this).addClass("active");
            self.resetFilter();

            countlyFunnel.setFilter(self.filterObj);
            countlyFunnel.setActiveFunnel($(this).data("id"));
            self.loadAndDraw();
            self._task = null;
            app.navigate("/funnels");
        });

        app.localize();
    },
    initFilterView: function () {
        var self = this;
        var filter = countlyFunnel.getFilter()
        self.filterObj = filter;
        self.activeSegmentForTable = "";

        self.adjustFilters();

        var inputs = [];
        var subs = {};

        for (var i in filter) {
            inputs.push(i);
            subs[i] = [];
            for (var j in filter[i]) {
                if (filter[i][j].length) {
                    for (var k = 0; k < filter[i][j].length; k++) {
                        subs[i].push([j, filter[i][j][k]]);
                    }
                }
                else {
                    subs[i].push([j, filter[i][j]]);
                }
            }
        }

        function setInput(cur, sub, total) {
            sub = sub || 0;
            if (inputs[cur]) {
                var filterType = subs[inputs[cur]][sub][0];
                if (filterType == "$in")
                    filterType = "=";
                else if (filterType == "$nin")
                    filterType = "!=";

                var val = subs[inputs[cur]][sub][1];
                var el = $(".query:nth-child(" + (total) + ")");
                $(el).data("query_value", val + ""); //saves value as attribute for selected query
                el.find(".filter-name").trigger("click");
                el.find(".filter-type").trigger("click");
                if (inputs[cur].indexOf("chr.") === 0) {
                    el.find(".filter-name").find(".select-items .item[data-value='chr']").trigger("click");
                    if (val === "t")
                        el.find(".filter-type").find(".select-items .item[data-value='=']").trigger("click");
                    else
                        el.find(".filter-type").find(".select-items .item[data-value='!=']").trigger("click");
                    val = inputs[cur].split(".")[1];
                    subs[inputs[cur]] = ["true"];
                }
                else {
                    el.find(".filter-name").find(".select-items .item[data-value='" + inputs[cur] + "']").trigger("click");
                    el.find(".filter-type").find(".select-items .item[data-value='" + filterType + "']").trigger("click");
                }
                setTimeout(function () {
                    el.find(".filter-value").not(".hidden").trigger("click");
                    if (el.find(".filter-value").not(".hidden").find(".select-items .item[data-value='" + val + "']").length)
                        el.find(".filter-value").not(".hidden").find(".select-items .item[data-value='" + val + "']").trigger("click");
                    else if (el.find(".filter-value").not(".hidden").hasClass("date") && _.isNumber(val) && (val + "").length == 10) {
                        el.find(".filter-value.date").find("input").val(countlyCommon.formatDate(moment(val * 1000), "DD MMMM, YYYY"));
                        el.find(".filter-value.date").find("input").data("timestamp", val);
                    }
                    else
                        el.find(".filter-value").not(".hidden").find("input").val(val);

                    if (subs[inputs[cur]].length == sub + 1) {
                        cur++;
                        sub = 0;
                    }
                    else
                        sub++;
                    total++;
                    if (inputs[cur]) {
                        $("#filter-add-container").trigger("click");
                        if (sub > 0)
                            setTimeout(function () {
                                var el = $(".query:nth-child(" + (total) + ")");
                                el.find(".and-or").find(".select-items .item[data-value='OR']").trigger("click");
                                setInput(cur, sub, total);
                            }, 500);
                        else
                            setInput(cur, sub, total);
                    }
                }, 500);
            }
        }
        setTimeout(function () {
            setInput(0, 0, 1);
            if (Object.keys(filter).length > 0) {

                $("#toggle-filter").trigger("click");
            }
        }, 500);
    },
    renderCommon: function (isRefresh) {
        var self = this;

        if (!isRefresh) {

            if (countlyFunnel.getFunnels().length == 0 && !countlyGlobal['admin_apps'][countlyCommon.ACTIVE_APP_ID]) {
                window.location = "dashboard#/";
                CountlyHelpers.alert(jQuery.i18n.map["funnels.no-funnel"], "black");
                return true;
            }

            this.templateData = {
                "page-title": countlyFunnel.getActiveFunnelName(),
                "funnel-description": countlyFunnel.getActiveFunnelDesc(),
                "funnels": countlyFunnel.getFunnels()
            };
            $(this.el).html(this.template(this.templateData));

            this.initNewFunnelView();
            this.initFunnelView();
            this.pageScript();
            this.loadDataTable();

            if (typeof this.initDrill === "function") {
                self.byDisabled = true;
                this.initDrill();
            }

            setTimeout(function () {
                self.filterBlockClone = $("#filter-view").clone(true);
            }, 0);

            if (countlyGlobal['admin_apps'][countlyCommon.ACTIVE_APP_ID]) {
                $("#funnel-configure-button").show();
                $("#create-funnel-button").show();
            }
            else {
                $("#create-funnel-button").hide();
            }


            if (countlyEvent.getEvents().length == 0) {
                $('#funnel-common-view').hide();
                $('#empty-funnel-no-event').show();
            }
            self.initFilterView()
            $("#apply-filter").on('click', function () {
                self._task = null;
                app.navigate('/funnels');
            });

            $('#funnelTypeSelect').find('.item').on('click', function(e){
                countlyFunnel.funnelViewType = $(this).data('value');
                self.refreshFunnelView();
            })
        } else {
            $.when(this.beforeRender()).then(function () {
                self.initFunnelView();
                self.initNewFunnelView();
                self.refreshFunnelList();
            });
        }


    },
    dateChanged: function () {
        this._task = null;
        app.navigate("/funnels");
        this.loadAndRefresh();
        this.taskReportRemind();
    },
    resetFilter: function () {
        this.filterObj = {};
    },
    loadDataTable: function () {
        var self = this;
        this.dtable = $('#funnelsDataTable').dataTable($.extend({}, $.fn.dataTable.defaults, {
            "aaData": countlyFunnel.getFunnels(),
            "fnRowCallback": function (nRow, aData, iDisplayIndex, iDisplayIndexFull) {
                $(nRow).attr("data-id", aData._id);
            },
            "aoColumns": [
                {
                    "mData": function (row, type) {
                        return '<i class="fa fa-reorder event-order"></i>';
                    }, "sType": "string", "sTitle": "", "bSortable": false, "sClass": "center move-funnel"
                },
                { "mData": function (row, type) { return row.name }, "sType": "string", "sTitle": jQuery.i18n.map["funnels.funnel-name"], "bSortable": false },
                { "mData": function (row, type) { return row.description || "" }, "sType": "string", "sTitle": jQuery.i18n.map["funnels.funnel-description"], "bSortable": false },
                {
                    "mData": function (row, type) {
                        return '<a class="cly-list-options"></a>';
                    }, "sType": "string", "sTitle": "", "sClass": "shrink center", bSortable: false
                }
            ]
        }));

        this.dtable.stickyTableHeaders();
        CountlyHelpers.initializeTableOptions();

        $(".cly-button-menu").off('cly-list.click').on("cly-list.click", function (event, data) {
            var id = $(data.target).parents("tr").data("id");
            $(".funnels-options-menu").find(".delete-funnel").data("id", id);
            $(".funnels-options-menu").find(".edit-funnel").data("id", id);
        })

        $(".cly-button-menu").off('cly-list.item').on("cly-list.item", function (event, data) {
            var btype = $(data.target).hasClass('edit-funnel') ? 'edit' : 'delete';
            var id = $(data.target).data("id");

            if (btype === "edit") {
                var selectedFunnel = countlyFunnel.getFunnels().find(function (item) { return item._id === id });
                if (selectedFunnel) {
                    self.openDrawer(selectedFunnel);
                }
            } else if (btype === "delete") {
                var selectedFunnel = countlyFunnel.getFunnels().find(function (item) { return item._id === id });
                var funnelId = selectedFunnel._id,
                    funnelName = selectedFunnel.name;

                var dialog = $(this).parents(".dialog");

                if (funnelId) {
                    CountlyHelpers.confirm(jQuery.i18n.prop('funnel.delete-confirm', "<b>" + funnelName + "</b>"), "popStyleGreen", function (result) {
                        if (result) {
                            $.ajax({
                                type: "GET",
                                url: countlyGlobal["path"] + "/i/funnels/delete",
                                data: {
                                    "funnel_id": funnelId,
                                    "api_key": countlyGlobal.member.api_key,
                                    "app_id": countlyCommon.ACTIVE_APP_ID
                                },
                                dataType: "json",
                                success: function (result) {
                                    // Reset view only if we are deleting active funnel
                                    if (funnelId == countlyFunnel.getActiveFunnel()) {
                                        countlyFunnel.reset();
                                        self.renderCommon(true);
                                    } else {
                                        countlyFunnel.deleteFunnel(funnelId);
                                        self.refreshFunnelList();
                                    }
                                },
                                error: function (result) {
                                    if (result.responseText) {
                                        try {
                                            result = JSON.parse(result.responseText);
                                        }
                                        catch (ex) { }
                                    }
                                    if (result.result)
                                        CountlyHelpers.alert(result.result);
                                }
                            });
                        }
                    }, [jQuery.i18n.map["common.no-dont-delete"], jQuery.i18n.map["funnel.yes-delete-funnel"]], { title: jQuery.i18n.map["funnel.delete-confirm-title"], image: "delete-funnel" });
                }
            }
        });

        var saveOrder = function () {
            var funnelMap = {};

            $("#funnelsDataTable tbody tr").each(function (index) {
                var $currFunnel = $(this),
                    funnelID = $currFunnel.data("id"),
                    newName = $currFunnel.find(".funnel-name").val();

                if (!funnelMap[funnelID]) {
                    funnelMap[funnelID] = {}
                }

                if (newName) {
                    funnelMap[funnelID]["name"] = newName;
                }

                funnelMap[funnelID]["order"] = index + 1;
            });
            $.ajax({
                type: "GET",
                url: countlyGlobal["path"] + "/i/funnels/edit",
                data: {
                    "app_id": countlyCommon.ACTIVE_APP_ID,
                    "api_key": countlyGlobal.member.api_key,
                    "funnel_map": JSON.stringify(funnelMap)
                },
                dataType: "json",
                success: function (result) {
                    countlyFunnel.setFunnels(funnelMap);
                    self.refreshFunnelList();
                },
                error: function (result) {
                    if (result.responseText) {
                        try {
                            result = JSON.parse(result.responseText);
                        }
                        catch (ex) { }
                    }
                    if (result.result)
                        CountlyHelpers.alert(result.result);
                }
            });
        }

        $("#funnelsDataTable").sortable({
            items: "tr",
            revert: true,
            handle: "td:first-child",
            helper: function (e, elem) {
                elem.children().each(function () {
                    $(this).width($(this).width());
                });

                elem.addClass("moving");
                return elem;
            },
            cursor: "move",
            containment: "parent",
            tolerance: "pointer",
            stop: function (e, elem) {
                elem.item.removeClass("moving");
                saveOrder();
            }
        });
    },
    refresh: function () { },
    refreshFunnelList: function () {
        var editIsVisible = $('#funnel-edit-view').is(":visible");
        var self = this;
        this.templateData.funnels = countlyFunnel.getFunnels();


        var newPage = $("<div>" + self.template(self.templateData) + "</div>");

        $(self.el).find("#event-nav .scrollable").html(function () {
            return newPage.find("#event-nav .scrollable").html();
        });

        $(self.el).find("#funnel-edit-view").replaceWith(newPage.find("#funnel-edit-view"));
        if (editIsVisible)
            $(self.el).find("#funnel-edit-view").show();
        this.loadDataTable();
        app.localize();
    },
    setTempPeriodForTask: function () {
        if (this._task) {
            self.previousPeriod = countlyCommon.getPeriod()
            var task = countlyTaskManager.getResult(this._task)
            var period = task.request.json.period
            var periodRang = [];
            if (Object.prototype.toString.call(period) === '[object Array]' && period.length == 2) {
                periodRang = period;
            } else {
                var periodObj = countlyCommon.calcSpecificPeriodObj(period, task.end)
                var currentPeriodArray = periodObj.currentPeriodArr;

                if (currentPeriodArray.length > 0) {
                    var start = moment(currentPeriodArray[0]).valueOf()
                    var end = moment(currentPeriodArray[currentPeriodArray.length - 1]).add(1, 'day').valueOf() - 1
                    periodRang = [start, end]
                }
            }
            countlyCommon.setPeriod(periodRang);
        }
    },
    clearTempPeriodForTask: function () {
        if (self.previousPeriod) {
            countlyCommon.setPeriod(self.previousPeriod);
            self.previousPeriod = null
        }
    },
    taskReportRemind: function () {
        if (this._task) {
            setTimeout(function () {
                $(".date-selector").removeClass("selected").removeClass("active");
            }, 0)
            this.setTempPeriodForTask()
            var task = countlyTaskManager.getResult(this._task)
            var periodObj = countlyCommon.periodObj
            var periodList = periodObj.currentPeriodArr
            var start = new moment(periodList[0])
            var end = new moment(periodList[periodList.length - 1])
            var endString = end.locale(countlyCommon.BROWSER_LANG_SHORT).format('DD MMMM YYYY')
            var startStringFormat = ''
            if (start.years() !== end.years()) {
                startStringFormat = 'YYYY'
            }
            if (start.month() !== end.month()) {
                startStringFormat = 'MMMM ' + startStringFormat
            }
            startStringFormat = 'DD ' + startStringFormat;
            var startString = start.locale(countlyCommon.BROWSER_LANG_SHORT).format(startStringFormat)
            var remindString = periodObj.currentPeriodArr.length > 0 ?
                jQuery.i18n.map['drill.task-period-remind'] + ' ' + startString + ' - ' + endString :
                jQuery.i18n.map['drill.task-none-period-remind'] + ' ' + endString;

            $(".remind-context").text(remindString)
            $(".remind-row").show()
            this.clearTempPeriodForTask()
        } else {
            $(".remind-row").hide()
            CountlyHelpers.setUpDateSelectors(this);
        }
    }
});

//register views
app.funnelView = new FunnelView();

app.route('/funnels/task/*task', 'funnels', function (task_id) {
    this.funnelView._task = task_id;
    this.renderWhenReady(this.funnelView);
});

app.route("/funnels", "funnels", function () {
    this.funnelView._task = null;
    this.renderWhenReady(this.funnelView);
});

app.addPageScript("/custom#", function () {
    addWidgetType();
    addSettingsSection();
    countlyFunnel.clearFunnelsCache();

    function addWidgetType() {
        var funnelWidget = '<div data-widget-type="funnels" class="opt dashboard-widget-item">' +
            '    <div class="inner">' +
            '        <span class="icon funnel"></span>' + jQuery.i18n.prop("funnels.label") +
            '    </div>' +
            '</div>';

        $("#widget-drawer .details #widget-types .opts").append(funnelWidget);
    }

    function addSettingsSection() {
        var setting = '<div id="widget-section-single-funnel" class="settings section">' +
            '    <div class="label">' + jQuery.i18n.prop("funnels.label") + '</div>' +
            '    <div id="single-funnel-dropdown" class="cly-select" style="width: 100%; box-sizing: border-box;">' +
            '        <div class="select-inner">' +
            '            <div class="text-container">' +
            '                <div class="text">' +
            '                    <div class="default-text">' + jQuery.i18n.prop("funnels.select") + '</div>' +
            '                </div>' +
            '            </div>' +
            '            <div class="right combo"></div>' +
            '        </div>' +
            '        <div class="select-items square" style="width: 100%;"></div>' +
            '    </div>' +
            '</div>';

        var viewType = '<div id="widget-section-single-funnel-view" class="settings section">' +
            '    <div class="label">'+ jQuery.i18n.prop("funnels.display-type") +'</div>' +
            '    <div id="funnel-view" class="checks">' +
            '        <div data-type="1" class="check">' +
            '            <div class="box"></div>' +
            '            <div class="text">'+ jQuery.i18n.prop('funnels.relative-to-users')+" "+jQuery.i18n.prop('funnels.users-entered') +'</div>' +
            '        </div>' +
            '        <div data-type="0" class="check selected">' +
            '            <div class="box"></div>' +
            '            <div class="text">'+ jQuery.i18n.prop('funnels.relative-to-users')+" "+jQuery.i18n.prop('funnels.all-users') +'</div>' +
            '        </div>' +
            '    </div>' +
            '</div>';

        var barColors = '<div id="funnel-widget-section-bar-color" class="settings section" style="margin-bottom: 55px;">' +
            '    <div class="label">' + jQuery.i18n.prop("dashboards.bar-color") + '</div>' +
            '    <div id="funnel-bar-colors" class="colors">' +
            '        <div data-color="1" class="color alt1 selected"></div>' +
            '        <div data-color="2" class="color alt2"></div>' +
            '        <div data-color="3" class="color alt3"></div>' +
            '        <div data-color="4" class="color alt4"></div>' +
            '    </div>' +
            '</div>';

        $(setting).insertAfter(".cly-drawer .details .settings:last");
        $(viewType).insertAfter(".cly-drawer .details .settings:last");
        $(barColors).insertAfter(".cly-drawer .details .settings:last");
    }

    $("#single-app-dropdown").on("cly-select-change", function (e, selected) {
        $("#single-funnel-dropdown").clySelectSetSelection("", jQuery.i18n.prop("funnels.select"));
        $("#funnel-bar-colors").find(".color").removeClass("selected");
        $("#funnel-bar-colors").find(".color[data-color=1]").addClass("selected");

        if (selected) {
            countlyFunnel.getFunnelsForApps([selected], function (funnelData) {
                $("#single-funnel-dropdown").clySelectSetItems(funnelData);
            });
        }
    });

    $("#funnel-view").on("click", ".check", function() {
        $("#funnel-view").find(".check").removeClass("selected");
        $(this).addClass("selected");
        $("#widget-drawer").trigger("cly-widget-section-complete");
    });

    $("#single-funnel-dropdown").on("cly-select-change", function () {
        $("#widget-drawer").trigger("cly-widget-section-complete");
    });

    $("#funnel-bar-colors").off("click").on("click", ".color", function () {
        $("#funnel-bar-colors").find(".color").removeClass("selected");
        $(this).addClass("selected");

        $("#widget-drawer").trigger("cly-widget-section-complete");
    });
});

$(document).ready(function () {
    if (typeof extendViewWithFilter === "function")
        extendViewWithFilter(app.funnelView);
    var menu = '<a href="#/funnels" class="item analytics" id="sidebar-funnels">' +
        '<div class="logo ion-funnel"></div>' +
        '<div class="text" data-localize="sidebar.funnels"></div>' +
        '</a>';
    if ($('.sidebar-menu:not(#iot-type) #management-menu').length)
        $('.sidebar-menu:not(#iot-type) #management-menu').before(menu);
    else
        $('.sidebar-menu:not(#iot-type)').append(menu);
    //check if configuration view exists
    if (app.configurationsView) {
        app.configurationsView.registerLabel("funnels", "sidebar.funnels");
    }
    initializeFunnelsWidget();
});

function initializeFunnelsWidget() {

    if (countlyGlobal["plugins"].indexOf("dashboards") < 0) {
        return;
    }

    var funnelsWidgetTemplate;

    $.when(
        $.get(countlyGlobal["path"] + '/funnels/templates/widget.html', function (src) {
            funnelsWidgetTemplate = Handlebars.compile(src);
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

        app.addWidgetCallbacks("funnels", widgetOptions);
    });

    function initWidgetSections() {
        var selWidgetType = $("#widget-types").find(".opt.selected").data("widget-type");

        if (selWidgetType != "funnels") {
            return;
        }

        $("#widget-drawer .details #data-types").parent(".section").hide();
        $("#widget-section-single-app").show();
        $("#widget-section-single-funnel").show();
        $("#widget-section-single-funnel-view").show();
        $("#funnel-widget-section-bar-color").show();
    }

    function widgetSettings() {
        var $singleAppDrop = $("#single-app-dropdown"),
            $singleFunnelDrop = $("#single-funnel-dropdown"),
            $funnelView =$("#funnel-view"),
            $barColors = $("#funnel-bar-colors");

        var selectedApp = $singleAppDrop.clySelectGetSelection(),
            selectedFunnel = $singleFunnelDrop.clySelectGetSelection(),
            selectedFunnelView = $funnelView.find(".check.selected").data("type") + "";
            barColor = $barColors.find(".color.selected").data("color");

        var settings = {
            apps: (selectedApp) ? [selectedApp] : [],
            funnel_type: (selectedFunnel) ? [selectedFunnel] : [],
            funnel_view_type:selectedFunnelView,
            bar_color: barColor
        };

        return settings;
    }

    function addPlaceholder(dimensions) {
        dimensions.min_height = 3;
        dimensions.min_width = 4;
        dimensions.width = 4;
        dimensions.height = 3;
    }

    function createWidgetView(widgetData) {
        var placeHolder = widgetData.placeholder;

        formatData(widgetData);
        render();

        function render() {
            var title = widgetData.title,
                app = widgetData.apps,
                data = widgetData.formattedData,
                funnels = widgetData.funnel_type;

            var appName = countlyDashboards.getAppName(app[0]),
                appId = app[0];

            if (widgetData.funnel_view_type !== "1"){
                var relative = jQuery.i18n.map['funnels.relative-to-users']+" "+jQuery.i18n.map['funnels.all-users'];
            } else { 
                var relative = jQuery.i18n.map['funnels.relative-to-users']+" "+jQuery.i18n.map['funnels.users-entered'];
            }

            var $widget = $(funnelsWidgetTemplate({
                title: title,
                all_users: widgetData.funnel_view_type !== "1",
                relative: relative,
                app: {
                    id: appId,
                    name: appName
                },
                data: data
            }));

            placeHolder.find("#loader").fadeOut();
            placeHolder.find(".cly-widget").html($widget.html());

            if (!title) {
                var funnelNames = {};
                $.when.apply(null, [countlyFunnel.getFunnelNameDfd(funnels[0], funnelNames)]).done(function () {
                    var widgetTitle = funnelNames[funnels[0]] + " (Funnel)";
                    placeHolder.find(".cly-widget .funnels > .title > .name").text(widgetTitle);
                });
            }

            animate(placeHolder, data);

            addToolTip(placeHolder);

            $(".funnels table .tooltip").on({
                mouseenter: function () {
                    $(".funnels table .tooltip").removeClass("hover");
                    $(this).addClass("hover");
                },
                mouseleave: function () {
                    $(".funnels table .tooltip").removeClass("hover");
                }
            });
        }
    }

    function formatData(widgetData) {
        var data = widgetData.dashData.data;
        data.steps = data.steps || [];
        if (widgetData.funnel_view_type !== "1"){
            data.steps.forEach(function (obj) {
                obj.width = (obj.percent * .97) || 1;
                obj.widthLeft = (obj.percentLeft * .97) || 1;
                obj.percentEffective  = obj.percent;
                obj.percentLeftEffective  = obj.percentLeft;
            });
        }else{
            data.steps.forEach(function (obj) {
                obj.width = (obj.percentUserEntered * .97) || 1;
                obj.widthLeft = (obj.percentLeftUserEntered * .97) || 1;
                obj.percentEffective  = obj.percentUserEntered;
                obj.percentLeftEffective  = obj.percentLeftUserEntered;
                obj.usersEntered = true; 
            });
        }

        if(data.steps.length) {
            data.steps[0].firstStep = true;
        }

        data.steps.forEach(function (obj) {
            if (obj.percentEffective == 0){
                obj.usersClass = "hide-bar";
            } else if (obj.percentEffective == 100){
                obj.usersClass = "full-bar";
            } else {
                obj.usersClass = "";
            }
            if (obj.percentLeftEffective == 0){
                obj.leftUsersClass = "hide-bar";
            } else if (obj.percentLeftEffective == 100){
                obj.leftUsersClass = "full-bar";
            } else {
                obj.leftUsersClass = "";
            }
        });

        var barColors = ["rgba(111, 163, 239, 1)", "rgba(85, 189, 185, 1)", "rgba(239, 136, 0, 1)", "rgba(174, 131, 210, 1)"];
        var color = barColors[widgetData.bar_color - 1 || 0];

        data.barColor = color;
        data.barColorLeft = color.slice(0, (color.length - 2)) + ".1)"
        widgetData.formattedData = data;
    }

    function resetWidget() {
        $("#single-funnel-dropdown").clySelectSetSelection("", jQuery.i18n.prop("funnels.select"));
        $("#funnel-bar-colors").find(".color").removeClass("selected");
        $("#funnel-bar-colors").find(".color[data-color=1]").addClass("selected");
        $("#funnel-view").find(".check").removeClass("selected");
        $("#funnel-view").find(".check[data-type=1]").addClass("selected");
    }

    function setWidget(widgetData) {
        var apps = widgetData.apps,
            funnels = widgetData.funnel_type,
            barColor = widgetData.bar_color,
            funnelViewType= widgetData.funnel_view_type;

        var $singleAppDrop = $("#single-app-dropdown"),
            $singleFunnelDrop = $("#single-funnel-dropdown"),
            $funnelView = $("#funnel-view"),
            $barColors = $("#funnel-bar-colors");

        $singleAppDrop.clySelectSetSelection(apps[0], countlyDashboards.getAppName(apps[0]));
        $funnelView.find(".check").removeClass("selected");
        $funnelView.find(".check[data-type=" + funnelViewType + "]").addClass("selected");

        if (funnels) {
            var funnelNames = {},
                deferreds = [];

            for (var i = 0; i < funnels.length; i++) {
                deferreds.push(countlyFunnel.getFunnelNameDfd(funnels[i], funnelNames));
            }

            $.when.apply(null, deferreds).done(function () {
                $singleFunnelDrop.clySelectSetSelection(funnels[0], funnelNames[funnels[0]]);
            });
        }

        if (barColor) {
            $barColors.find(".color").removeClass("selected");
            $barColors.find(".color[data-color=" + barColor + "]").addClass("selected");
        }
    }

    function refreshWidget(widgetEl, widgetData) {
        formatData(widgetData);
        var data = widgetData.formattedData,
            funnels = widgetData.funnel_type;

        if (!widgetEl.find(".cly-widget .funnels > .title > .name").html()) {
            var funnelNames = {};
            $.when.apply(null, [countlyFunnel.getFunnelNameDfd(funnels[0], funnelNames)]).done(function () {
                var widgetTitle = funnelNames[funnels[0]] + " (Funnel)";
                widgetEl.find(".cly-widget .funnels > .title > .name").text(widgetTitle);
            });
        }
        
        if (widgetData.funnel_view_type !== "1"){
            var relative = jQuery.i18n.map['funnels.relative-to-users']+" "+jQuery.i18n.map['funnels.all-users'];
        } else { 
            var relative = jQuery.i18n.map['funnels.relative-to-users']+" "+jQuery.i18n.map['funnels.users-entered'];
        }

        var $widget = $(funnelsWidgetTemplate({
            title: '',
            all_users: widgetData.funnel_view_type !== "1",
            relative: relative,
            app: {
                id: "",
                name: ""
            },
            data: data
        }));

        widgetEl.find("table").replaceWith($widget.find("table"));

        animate(widgetEl, data);
        addToolTip(widgetEl);
    }

    function animate(placeHolder, data) {
        var totalSteps = data.steps.length;

        var margin = {
            max: 55,
            min: 0
        };
        var font = {
            max: 25,
            min: 13
        };
        var height = {
            max: 45,
            min: 17
        };
        var paddings = {
            max: 20,
            min: 9
        };

        var stepNormalized = (totalSteps - 2) / (8 - 2);
        stepNormalized = stepNormalized > 1 ? 1 : stepNormalized;
        var stepNegation = 1 - stepNormalized;

        if (stepNegation != 1 && stepNegation != 0) {
            stepNegation *= .7;
        }

        var marginTop = margin.min + (margin.max - margin.min) * stepNegation;
        var fontSize = font.min + (font.max - font.min) * stepNegation;
        var barHeight = height.min + (height.max - height.min) * stepNegation;
        var padding = paddings.min + (paddings.max - paddings.min) * stepNegation;
        var animDur = 2000;

        if (totalSteps < 8) {
            fontSize = 15;
        } else {
            fontSize = 13;
        }

        placeHolder.find(".cly-widget .funnels.table table").css({ "margin-top": marginTop, "font-size": fontSize });
        placeHolder.find(".cly-widget .funnels.table table .moving-bar.step-users-percent-bar").css({ height: barHeight });
        placeHolder.find(".cly-widget .funnels.table table .moving-bar.step-users-percent-left-bar").css({ height: barHeight });
        placeHolder.find(".cly-widget .funnels.table table td").css({ "padding-top": padding, "padding-bottom": padding });
    }

    function addToolTip(placeHolder) {
        placeHolder.find('.funnels table tr').tooltipster({
            animation: "fade",
            animationDuration: 100,
            delay: 100,
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
            functionInit: function (instance, helper) {
                instance.content(getTooltipText($(helper.origin)));
            }
        })

        function getTooltipText(jqueryEl) {
            var totalUsers = jqueryEl.data("total-users");
            var performedPercent = jqueryEl.find(".step-users-percent-bar").data("percent");
            var notPerformedPercent = jqueryEl.find(".step-users-percent-left-bar").data("percent");
            var users = jqueryEl.find(".step-users-percent-bar").data("users");
            var leftUsers = jqueryEl.find(".step-users-percent-left-bar").data("users");
            var stepName = jqueryEl.find("td:first-child").data("step-name");
            var usersEntered = jqueryEl.data("users-entered");
            var firstStep = jqueryEl.data("first-step");

            var tooltipStr = "<div id='funnel-tip'>";
            if (firstStep && usersEntered){
                tooltipStr += jQuery.i18n.prop("funnels.first-users-entered-tooltip-text", totalUsers, users, performedPercent, stepName, leftUsers, notPerformedPercent);
            } else {
                tooltipStr += jQuery.i18n.prop("funnels.tooltip-text", totalUsers, users, performedPercent, stepName, leftUsers, notPerformedPercent);
            }
            

            var segmentationText = jqueryEl.find(".funnel-icon").data("step-segmentation");

            if (segmentationText) {
                var queryTextList = segmentationText.split('|');

                var textList = queryTextList.map(function (queryText) {
                    return queryText.replace('drill.or', jQuery.i18n.map['drill.or']).replace('drill.and', jQuery.i18n.map['drill.and']);
                });

                segText = textList.join(" ");
                tooltipStr += "<br><br><span class='logo ion-funnel funnel-icon'></span> Filter applied to this step : <br> <span style='color:#2FA732'>" + segText + "</span>";
            }

            tooltipStr += "</div>";

            return tooltipStr;
        }
    }
}