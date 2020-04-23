(function (BehavioralQueryModule, $) {

    var onlyNumber = function (e) {
        if ($.inArray(e.keyCode, [46, 8, 9, 27, 13, 110, 190]) !== -1 ||
            (e.keyCode == 65 && (e.ctrlKey === true || e.metaKey === true)) ||
            (e.keyCode == 67 && (e.ctrlKey === true || e.metaKey === true)) ||
            (e.keyCode == 88 && (e.ctrlKey === true || e.metaKey === true)) ||
            (e.keyCode >= 35 && e.keyCode <= 39)) {
            return;
        }
        if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
            e.preventDefault();
        }
    }

    var switchEquationTextToVal = function (text) {
        switch (text) {
            case "=":
                return "$in";
            case "!=":
                return "$nin";
            case ">":
                return "$gt"
            case ">=":
                return "$gte";
            case "<":
                return "$lt";
            case "<=":
                return "$lte";
        }
    }

    var switchEquationValToText = function (val) {
        switch (val) {
            case "$in":
                return "=";
            case "$nin":
                return "!=";
            case "$gt":
                return ">"
            case "$gte":
                return ">=";
            case "$lt":
                return "<";
            case "$lte":
                return "<=";
        }
    }

    function SegmentationData(eventName, callback) {
        this.event = eventName;
        this.filterValues = {};
        this.filterNames = {};
        this.activeAppKey = countlyCommon.ACTIVE_APP_KEY;
        this.bucket = "daily";
        this.isFetching = true;
        this.weekDays = ["", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
        this.sortFilter = function (a, b) {
            if (typeof a == "string" && typeof b == "string") {
                a = a.toLowerCase();
                b = b.toLowerCase();
            }
            if (a == b) return 0;
            if (a > b) return 1;
            return -1;
        };
        var self = this;
        $.ajax({
            type: "GET",
            url: countlyCommon.API_PARTS.data.r,
            data: {
                "api_key": countlyGlobal.member.api_key,
                "app_id": countlyCommon.ACTIVE_APP_ID,
                "event": self.event,
                "method": "segmentation_meta"
            },
            dataType: "jsonp",
            success: function (json) {
                self.segmentationDbMeta = json;
                self.setMeta();
                self.isFetching = false;
                callback(self);

            }
        });
    };

    SegmentationData.prototype.setMeta = function () {
        if (this.segmentationDbMeta && this.segmentationDbMeta.up) {
            for (var property in this.segmentationDbMeta.up) {
                this.filterValues["up." + property] = this.segmentationDbMeta.up[property].values || [];
                this.filterValues["up." + property].sort(this.sortFilter);
                this.filterNames["up." + property] = this.getUserPropertyLongNames(property, this.segmentationDbMeta.up[property].values);
            }
        }

        if (this.segmentationDbMeta && this.segmentationDbMeta.custom) {
            for (var property in this.segmentationDbMeta.custom) {
                this.filterValues["custom." + property] = this.segmentationDbMeta.custom[property].values || [];
                this.filterValues["custom." + property].sort(this.sortFilter);
                this.filterNames["custom." + property] = this.segmentationDbMeta.custom[property].values || [];
            }
        }

        if (this.segmentationDbMeta && this.segmentationDbMeta.cmp) {
            for (var property in this.segmentationDbMeta.cmp) {
                this.filterValues["cmp." + property] = this.segmentationDbMeta.cmp[property].values || [];
                this.filterValues["cmp." + property].sort(this.sortFilter);

                var values = this.segmentationDbMeta.cmp[property].values || [];
                if (property == "c" && typeof countlyAttribution !== 'undefined') {
                    var newVals = [];
                    for (var i = 0; i < values.length; i++) {
                        newVals[i] = countlyAttribution.getCampaignName(values[i]);
                    }
                    values = newVals;
                }
                this.filterNames["cmp." + property] = values;
            }
        }

        if (this.segmentationDbMeta && this.segmentationDbMeta.sg) {
            for (var property in this.segmentationDbMeta.sg) {
                this.filterValues["sg." + property] = this.segmentationDbMeta.sg[property].values || [];
                this.filterValues["sg." + property].sort(this.sortFilter);
                this.filterNames["sg." + property] = this.segmentationDbMeta.sg[property].values || [];
            }
        }
    };

    SegmentationData.prototype.getUserPropertyLongNames = function (key, values) {
        var newValues = [];

        if (!values) {
            return newValues;
        }

        switch (key) {
            case "d":
            case "pv":
            case "cc":
            case "av":
            case "up.d":
            case "up.pv":
            case "up.cc":
            case "up.av":
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
                for (var i = 0; i < values.length; i++) {
                    newValues.push(countlySegmentation.getUserPropertyLongName(key, values[i]));
                }
                break;
            default:
                newValues = values;
                break;
        }

        return newValues;
    };

    SegmentationData.prototype.getFilters = function () {
        var segmentationDbMetaWithIds = [];

        if (this.segmentationDbMeta && this.segmentationDbMeta.sg) {
            if (this.segmentationDbMeta.e == "[CLY]_crash")
                segmentationDbMetaWithIds.push({ name: jQuery.i18n.map["drill.crash-segments"] });
            if (this.segmentationDbMeta.e == "[CLY]_view")
                segmentationDbMetaWithIds.push({ name: jQuery.i18n.map["drill.view-segments"] });
            else
                segmentationDbMetaWithIds.push({ name: jQuery.i18n.map["drill.event-segments"] });
            for (var segKey in this.segmentationDbMeta.sg) {
                if (this.segmentationDbMeta.e.indexOf("[CLY]_") == 0) {
                    var name = (segKey.charAt(0).toUpperCase() + segKey.slice(1)).replace(/_/g, " ");
                    if (this.segmentationDbMeta.e == "[CLY]_crash" && segKey == "crash") {
                        segmentationDbMetaWithIds.unshift({ id: "sg." + segKey, name: name, type: this.segmentationDbMeta.sg[segKey].type });
                        segmentationDbMetaWithIds.unshift({ name: jQuery.i18n.map["drill.crash"] });
                    }
                    else {
                        if (this.segmentationDbMeta.e == "[CLY]_view" && segKey == "name")
                            name = jQuery.i18n.map["drill.lv"];
                        if (this.segmentationDbMeta.e == "[CLY]_view" && (segKey == "visit" || segKey == "segment"))
                            continue;
                        if (this.segmentationDbMeta.e == "[CLY]_view" && (segKey == "start" || segKey == "exit" || segKey == "bounce"))
                            segmentationDbMetaWithIds.push({ id: "sg." + segKey, name: jQuery.i18n.map["drill.view." + segKey], type: "l" });
                        else
                            segmentationDbMetaWithIds.push({ id: "sg." + segKey, name: name, type: this.segmentationDbMeta.sg[segKey].type });
                    }
                }
                else
                    segmentationDbMetaWithIds.push({ id: "sg." + segKey, name: segKey, type: this.segmentationDbMeta.sg[segKey].type });
            }
        }

        if (this.segmentationDbMeta && this.segmentationDbMeta.e != "[CLY]_session" && this.segmentationDbMeta.e != "[CLY]_crash" && this.segmentationDbMeta.e != "[CLY]_view") {
            segmentationDbMetaWithIds.push({ name: jQuery.i18n.map["drill.event-props"] });
            segmentationDbMetaWithIds.push({ id: "s", name: jQuery.i18n.map["drill.sum"], type: "n" });
            segmentationDbMetaWithIds.push({ id: "dur", name: jQuery.i18n.map["drill.dur"], type: "n" });
        }

        if (this.segmentationDbMeta && this.segmentationDbMeta.up) {
            segmentationDbMetaWithIds.push({ name: jQuery.i18n.map["drill.user-props"] });
            segmentationDbMetaWithIds.push({ id: "did", name: "ID", type: "s" });
            for (var segKey in this.segmentationDbMeta.up) {
                var name = "";

                switch (segKey) {
                    default:
                        if (jQuery.i18n.map["drill." + segKey]) {
                            name = jQuery.i18n.map["drill." + segKey];
                            if (countlyGlobal["apps"][countlyCommon.ACTIVE_APP_ID].type == "iot" && segKey == "sc") {
                                name = "";
                            }
                        }
                        break;
                }
                if (name != "")
                    segmentationDbMetaWithIds.push({ id: "up." + segKey, name: name, type: this.segmentationDbMeta.up[segKey].type });
            }

            if (this.segmentationDbMeta && this.segmentationDbMeta.e == "[CLY]_session" && app.activeView == app.drillView) {
                segmentationDbMetaWithIds.push({ id: "sd", name: jQuery.i18n.map["drill.sd"], type: "n" });
            }
        }

        if (this.segmentationDbMeta && this.segmentationDbMeta.custom) {
            segmentationDbMetaWithIds.push({ name: jQuery.i18n.map["drill.user-custom"] });
            var limit = countlyGlobal.custom_property_limit || 20;
            for (var segKey in this.segmentationDbMeta.custom) {
                limit--;
                if (limit < 0)
                    break;
                segmentationDbMetaWithIds.push({ id: "custom." + segKey, name: segKey, type: this.segmentationDbMeta.custom[segKey].type });
            }
        }

        if (this.segmentationDbMeta && this.segmentationDbMeta.cmp && countlyGlobal["apps"][countlyCommon.ACTIVE_APP_ID].type != "iot") {
            segmentationDbMetaWithIds.push({ name: jQuery.i18n.map["drill.cmp-props"] });
            var limit = countlyGlobal.custom_property_limit || 20;
            var langs = {
                pl: jQuery.i18n.map["attribution.platform"],
                b: jQuery.i18n.map["attribution.browser"],
                cnty: jQuery.i18n.map["attribution.country"],
                l: jQuery.i18n.map["attribution.locale"],
                m: jQuery.i18n.map["attribution.mobile"]
            };
            segmentationDbMetaWithIds.push({ id: "cmp.c", name: jQuery.i18n.map["drill.cmp_c"], type: this.segmentationDbMeta.cmp["c"].type });
            for (var segKey in this.segmentationDbMeta.cmp) {
                limit--;
                if (limit < 0)
                    break;
                if (segKey != "n" && segKey != "c" && segKey != "_id" && segKey != "bv" && segKey != "ip" && segKey != "os" && segKey != "r" && segKey != "cty") {
                    segmentationDbMetaWithIds.push({ id: "cmp." + segKey, name: langs[segKey] || segKey, type: this.segmentationDbMeta.cmp[segKey].type });
                }
            }
        }


        return segmentationDbMetaWithIds;
    };

    SegmentationData.prototype.getFilterValues = function (filter) {
        var self = this;

        var newValues = [];
        if (this.event === "[CLY]_view") {
            if (filter == "sg.start" || filter == "sg.exit" || filter == "sg.bounce") {
                return [1];
            }
        }
        switch (filter) {
            case "up.src":
                if (typeof countlySources !== 'undefined') {
                    var arr = this.filterValues[filter + ""] || [],
                        values = {},
                        newKeys = [],
                        group;
                    for (var i = 0; i < arr.length; i++) {
                        group = countlySources.getSourceName(arr[i]);
                        newKeys.push(group);
                        if (!values[group])
                            values[group] = [];
                        values[group].push(countlyCommon.encode(countlySources.getSourceName(arr[i], null, true)));
                    }
                    for (var key in values) {
                        values[key].sort(self.sortFilter);
                    }
                    newKeys.sort(self.sortFilter);
                    newValues = {};
                    for (var i = 0; i < newKeys.length; i++) {
                        newValues[newKeys[i]] = values[newKeys[i]];
                    }
                }
                else {
                    newValues = this.filterValues[filter + ""] || [];
                }
                break;
            default:
                newValues = this.filterValues[filter + ""] || [];
                break;
        }

        return newValues;
    };

    SegmentationData.prototype.getFilterNames = function (filter) {
        if (this.event.indexOf("[CLY]_") == 0) {
            var values = this.filterNames[filter + ""] || [];
            var newValues = [];
            for (var i = 0; i < values.length; i++) {
                if (this.event == "[CLY]_crash" && filter == "sg.crash" && countlyCrashes)
                    newValues.push(countlyCrashes.getCrashName(values[i]));
                else if (this.event == "[CLY]_view" && (filter == "sg.start" || filter == "sg.exit" || filter == "sg.bounce")) {
                    newValues.push("true");
                }
                else
                    newValues.push(values[i]);
            }
            return newValues;
        }
        return this.filterNames[filter + ""] || [];
    };

    SegmentationData.prototype.sortFilter = function (a, b) {
        if (typeof a == "string" && typeof b == "string") {
            a = a.toLowerCase();
            b = b.toLowerCase();
        }
        if (a == b) return 0;
        if (a > b) return 1;
        return -1;
    };

    SegmentationData.prototype.getBigListMetaData = function (prop, period, _event, callback) {
        var self = this;
        return $.ajax({
            type: "GET",
            url: countlyCommon.API_PARTS.data.r,
            data: {
                "api_key": countlyGlobal.member.api_key,
                "app_id": countlyCommon.ACTIVE_APP_ID,
                "event": _event,
                "method": "segmentation_big_meta",
                "prop": prop,
                "search": "",
                "period": period
            },
            dataType: "jsonp",
            success: function (json) {
                var newValues = [];
                var newNames = [];

                switch (prop) {
                    case "up.src":
                        if (typeof countlySources !== 'undefined' && json && json.length) {
                            var arr = json || [],
                                values = {},
                                newKeys = [],
                                group;
                            newNames = arr;
                            for (var i = 0; i < arr.length; i++) {
                                group = countlySources.getSourceName(arr[i]);
                                newKeys.push(group);
                                if (!values[group])
                                    values[group] = [];
                                values[group].push(countlyCommon.encode(countlySources.getSourceName(arr[i], null, true)));
                            }
                            for (var key in values) {
                                values[key].sort(self.sortFilter);
                            }
                            newKeys.sort(self.sortFilter);
                            newValues = {};
                            for (var i = 0; i < newKeys.length; i++) {
                                newValues[newKeys[i]] = values[newKeys[i]];
                            }
                        }
                        else {
                            newValues = json || [];
                            newNames = json || [];
                        }
                        break;
                    default:
                        newValues = json || [];
                        if (json && json.length) {
                            newNames = self.getUserPropertyLongNames(prop, json);
                            for (var i = 0; i < newNames.length; i++) {
                                if (_event == "[CLY]_crash" && prop == "sg.crash" && countlyCrashes)
                                    newNames[i] = countlyCrashes.getCrashName(newNames[i]);
                                else
                                    newNames[i] = newNames[i];
                            }
                        }
                        break;
                }

                callback(newValues, newNames);
            },
            error: function () {
                callback([], []);
            }
        });
    };

    //HTMLDomElement - Observer
    function HTMLDomElement() {
        this.html = "";
        this.handlers = [];
    };


    HTMLDomElement.prototype.subscribe = function (fn, scope) {
        this.handlers.push({
            fn: fn,
            scope: scope
        });
    };
    HTMLDomElement.prototype.unsubscribe = function (fn) {
        this.handlers = this.handlers.filter(
            function (item) {
                if (item !== fn) {
                    return item;
                }
            }
        );
    };
    HTMLDomElement.prototype.runObservers = function (param, thisObj) {
        this.handlers.forEach(function (item) {
            var scope = item.scope || thisObj || window;
            if (item.fn)
                item.fn.call(scope, param);
        });
    };
    HTMLDomElement.prototype.refresh = function () {

        var self = this;
        setTimeout(function () {
            var oldDOM = self.html;
            var newDOM = self.render();

            if (oldDOM)
                oldDOM.replaceWith(newDOM);
        }, 100);
    };
    HTMLDomElement.prototype.remove = function () {
        this.html.remove();
    };

    //BehavioralQuery Object
    BehavioralQueryModule.BehavioralQuery = function (targetElementId, events) {
        HTMLDomElement.call(this);

        this.targetElementId = targetElementId;
        this.rows = [];
        this.events = events;

        //Construction
        var init = function (self) {
            var conditionRow = new ConditionRow(self);
            conditionRow.subscribe(self.onConditionChanged, self);
            self.rows.push(conditionRow);
        };
        init(this);

    };
    BehavioralQueryModule.BehavioralQuery.prototype = Object.create(HTMLDomElement.prototype);

    BehavioralQueryModule.BehavioralQuery.prototype.buildEditSegmentData = function (newSegmentationRow, eventNameValue, eventQueryValue, equation, segmentCounter, index) {

        index = index || 0;

        var newSegmentationQueryRow = new SegmentationQueryRow(newSegmentationRow);

        if (segmentCounter > 0)
            newSegmentationQueryRow.andOrFilter.selectedIndex = 1


        var previousRowProps = newSegmentationQueryRow.setPrevRows(newSegmentationQueryRow);
        var pf_props_items = newSegmentationQueryRow.setPropItems(newSegmentationQueryRow, previousRowProps);

        var eventPropsDropDown = newSegmentationQueryRow.filters[0];
        eventPropsDropDown.items = pf_props_items;
        eventPropsDropDown.selectedIndex = eventPropsDropDown.items.indexOf(_.where(eventPropsDropDown.items, { value: eventNameValue })[0]);


        var equationDropDown = newSegmentationQueryRow.filters[1];
        equationDropDown.cascadeParentDataType = eventPropsDropDown.getSelectedItem().type;
        equationDropDown.selectedIndex = equationDropDown.items.indexOf(_.where(equationDropDown.items, { value: switchEquationValToText(equation) })[0]);

        var filterValueInput = newSegmentationQueryRow.filters[2];
        filterValueInput.typeChanged(eventPropsDropDown, function () {
            if (filterValueInput.type === "l" || filterValueInput.type === "bl") {
                var selectedItem = _.where(filterValueInput.items, { value: countlyCommon.encode(eventQueryValue[equation][index]) })[0];
                filterValueInput.selectedValue = selectedItem.value;
                filterValueInput.selectedIndex = filterValueInput.items.indexOf(selectedItem);
            }
            else if (filterValueInput.type === "d") {
                filterValueInput.selectedValue = eventQueryValue[equation];
                filterValueInput.selectedDateValue = countlyCommon.formatDate(moment(filterValueInput.selectedValue * 1000), "DD MMMM, YYYY");
            } else {
                filterValueInput.selectedValue = eventQueryValue[equation][index];
            }
        });


        return newSegmentationQueryRow;
    }


    BehavioralQueryModule.BehavioralQuery.prototype.buildEditData = function (data, currentIndex, onFinish) {
        var self = this;

        if (currentIndex === 0) self.rows = [];

        if (data.length === currentIndex) {
            onFinish();
            return;
        }

        var condition = data[currentIndex];
        var segmentData = new SegmentationData(condition.event, function () {
            var newConditionRow = new ConditionRow(self);
            newConditionRow.subRows = [];

            newConditionRow.eventProperties = segmentData.getFilters();
            var selectedEvent = self.events.filter(function (event) { return event.name === condition.event })[0];
            if (selectedEvent) {
                newConditionRow.selectedEvent = { text: selectedEvent.name, value: selectedEvent.key };
            }
            newConditionRow.segmentationData = segmentData;
            newConditionRow.isLastConditionRow = currentIndex === data.length - 1;

            //Conditional Query Row
            var newConditionalQueryRow = new ConditionQueryRow(newConditionRow);
            newConditionalQueryRow.subscribe(newConditionRow.onConditionChanged, newConditionRow);
            var typeDropDown = newConditionalQueryRow.filters[0];
            typeDropDown.selectedIndex = typeDropDown.items.indexOf(_.where(typeDropDown.items, { value: condition.type })[0]);

            var eventDropDown = newConditionalQueryRow.filters[1];
            eventDropDown.isVisible = true;
            eventDropDown.selectedIndex = eventDropDown.items.indexOf(_.where(eventDropDown.items, { value: condition.event })[0]);

            if (eventDropDown.selectedIndex < 0) condition.query = {};

            if (!condition.times)
                condition.times = {};
            if (typeof condition.times === 'string')
                condition.times = JSON.parse(condition.times);

            var frequencySelect = newConditionalQueryRow.filters[2];
            var filterKey = Object.keys(condition.times)[0];
            frequencySelect.isVisible = true;
            frequencySelect.selectedIndex = filterKey ? frequencySelect.items.indexOf(_.where(frequencySelect.items, { value: filterKey })[0]) : 1;
            frequencySelect.selection = filterKey ? {
                selectedIndex: frequencySelect.selectedIndex,
                filter: filterKey,
                data: condition.times[filterKey]

            } : undefined;


            var timeRange = newConditionalQueryRow.filters[3];
            timeRange.isVisible = true;
            timeRange.selectedIndex = timeRange.items.indexOf(_.where(timeRange.items, { value: condition.period })[0]);
            if (timeRange.selectedIndex < 0) {
                var days = condition.period.substring(0, condition.period.length - 4);
                timeRange.selectedValue = { text: days + " " + jQuery.i18n.map['cohorts.days'], value: days + 'days' };
            }
            newConditionRow.subRows.push(newConditionalQueryRow);

            //Segmentation Row
            var newSegmentationRow = new SegmentationRow(newConditionRow);
            newSegmentationRow.subRows = [];

            if (typeof condition.query === 'string')
                condition.query = JSON.parse(condition.query);

            if (condition.query) {

                for (var a in condition.query) {
                    var eventNameValue = a;
                    var eventQueryValue = condition.query[a];

                    var segmentCounter = 0;
                    for (var b in eventQueryValue) {

                        if (Array.isArray(eventQueryValue[b])) {
                            for (var c in eventQueryValue[b]) {
                                var newSegmentationQueryRow = self.buildEditSegmentData(newSegmentationRow, eventNameValue, eventQueryValue, b, segmentCounter, c);

                                newSegmentationRow.subRows.push(newSegmentationQueryRow);
                                segmentCounter++;
                            }
                        } else {
                            var newSegmentationQueryRow = self.buildEditSegmentData(newSegmentationRow, eventNameValue, eventQueryValue, b, segmentCounter, 0);
                            newSegmentationRow.subRows.push(newSegmentationQueryRow);
                            segmentCounter++;
                        }


                    }

                }
                if (condition.byVal && condition.byVal.length > 0) {
                    var byValSegmentationQueryRow = new SegmentationQueryRow(newSegmentationRow);
                    byValSegmentationQueryRow.andOrFilter.selectedIndex = 2;
                    byValSegmentationQueryRow.filters = byValSegmentationQueryRow.filters.splice(0, 1);

                    var eventPropsDropDown = byValSegmentationQueryRow.filters[0];
                    eventPropsDropDown.selectedIndex = eventPropsDropDown.items.indexOf(_.where(eventPropsDropDown.items, { value: condition.byVal })[0]);


                    newSegmentationRow.subRows.push(byValSegmentationQueryRow);
                }

            }

            var rowsLength = newSegmentationRow.subRows.length;
            newSegmentationRow.subRows = newSegmentationRow.subRows.map(function (row, index) {
                row.isDisabled = (rowsLength - 1) !== index;
                return row;
            })
            newConditionRow.subRows.push(newSegmentationRow);


            //Add Rows
            newConditionRow.subscribe(self.newConditionRow, self);
            self.rows.push(newConditionRow);
            self.rows.push(new LineRow());

            self.buildEditData(data, ++currentIndex, onFinish);
        });

    }

    BehavioralQueryModule.BehavioralQuery.prototype.renderInElement = function (data) {

        if (data) {
            this.rows = [];
            var self = this;
            $('#' + this.targetElementId).html(this.render());

            this.buildEditData(data, 0, function () {
                self.refresh();
                $(document).trigger('BehavioralQueryModule.hasQuery');
            });
        } else {
            $('#' + this.targetElementId).html(this.render());
        }

    };
    BehavioralQueryModule.BehavioralQuery.prototype.render = function () {

        this.html = $('<div></div>');

        var self = this;

        if (self.rows.length === 0) {

            self.html.append("<div class='segment-loading'>" + jQuery.i18n.map['cohorts.segment-loading'] + "...</div>");

            return this.html;
        }

        this.rows.map(function (row) {
            self.html.append(row.render());
        });


        if (!(this.rows[this.rows.length - 1] instanceof LineRow)) {
            var lineRow = new LineRow();
            self.html.append(lineRow.render());
            self.rows.push(lineRow);
        }


        var div = $('<div class="add-condition-row"></div>');
        var addConditionButton = $('<button id="btn-define-behavior" class="btn btn-orange">+ ' + jQuery.i18n.map['cohorts.add-condition'] + '</button>');
        addConditionButton.off('click').on('click', function () {

            var lastConditionRow = self.rows[self.rows.length - 2];
            var query = lastConditionRow.getQuery();

            if (!query) {
                var conditionQueryRow = lastConditionRow.subRows[0];

                for (var i in conditionQueryRow.filters) {
                    if (!conditionQueryRow.filters[i].getSelectedItem())
                        conditionQueryRow.filters[i].html.css('border-color', '#dd6935');
                }

                return;
            };

            var conditionRow = new ConditionRow(self);
            conditionRow.subscribe(self.onConditionChanged, self);
            self.rows.push(conditionRow);
            self.refresh();

        });

        div.append(addConditionButton);
        self.html.append(div);

        return this.html;
    };
    BehavioralQueryModule.BehavioralQuery.prototype.onConditionChanged = function (job) {
        switch (job) {
            case 'add-row':
                this.refresh();
                break;
        }
    };
    BehavioralQueryModule.BehavioralQuery.prototype.removeRow = function (row) {
        var nextRow = this.rows[this.rows.indexOf(row) + 1];
        var spliceLength = 1;

        if (nextRow && nextRow instanceof LineRow)
            spliceLength = 2;

        this.rows.splice(this.rows.indexOf(row), spliceLength);
        this.refresh();
    };

    BehavioralQueryModule.BehavioralQuery.prototype.getQuery = function () {

        var query = [];
        this.rows.map(function (row) {
            if (!row.removed && row.getQuery) {
                var rowQuery = row.getQuery();
                if (rowQuery)
                    query.push(rowQuery);
            }

        });

        return query;
    };

    BehavioralQueryModule.BehavioralQuery.prototype.destroy = function () {
        delete this.rows;
        this.html.remove();
    };

    //ConditionRow Class
    function ConditionRow(parent) {
        HTMLDomElement.call(this);
        this.subRows = [];
        this.query = {};
        this.eventProperties = [];
        this.isLastConditionRow = true;
        this.events = parent.events;
        this.parent = parent;

        //Construction
        var firstRow = new ConditionQueryRow(this);
        firstRow.subscribe(this.onConditionChanged, this);
        this.subRows.push(firstRow);
    };
    ConditionRow.prototype = Object.create(HTMLDomElement.prototype);

    ConditionRow.prototype.onConditionChanged = function (conditionQueryRow) {

        if (conditionQueryRow.getQuery()) {
            $(document).trigger('BehavioralQueryModule.hasQuery');
            if (this.subRows.length === 1) { //Add segmentation row
                var segmentRow = new SegmentationRow(this);
                this.subRows.push(segmentRow);
            }
            if (this.isLastConditionRow) {
                this.isLastConditionRow = false;
                this.runObservers('add-row');
            }
        }
    };

    ConditionRow.prototype.render = function () {
        this.html = $("<div class='condition-row'></div>");
        var self = this;

        this.subRows.map(function (row) {
            row.onRemove = function () {
                self.willDelete = true;
                self.removed = true;

                self.renderRemoveWarning();

                setTimeout(function () {
                    if (self.willDelete) {
                        self.parent.removeRow(self);
                    }
                }, 2000);

            };

            self.html.append(row.render());
        });

        return this.html;
    };

    ConditionRow.prototype.renderRemoveWarning = function () {
        var self = this;

        var removeRowWarning = $("<div class='undo-row'>" + jQuery.i18n.map['cohorts.row-removed'] + ". <a href='#'>" + jQuery.i18n.map['cohorts.undo'] + "</a></div>");
        removeRowWarning.find('a').on('click', function (e) {
            e.preventDefault();
            self.willDelete = false;
            self.removed = false;
            self.refresh();
        })

        self.html.html(removeRowWarning);
    };

    ConditionRow.prototype.getQuery = function () {
        var query = {};
        this.subRows.map(function (row) {

            if ((row instanceof ConditionQueryRow) || (row instanceof SegmentationRow && row.getQuery())) {
                query = _.extend({}, query, row.getQuery());
            }
        });
        return Object.keys(query).length > 0 ? query : undefined;
    }

    //ConditionQueryRow Class
    function ConditionQueryRow(parentRow) {
        HTMLDomElement.call(this);
        this.parentRow = parentRow;
        this.events = parentRow.events;
        this.label = jQuery.i18n.map['cohorts.users-who'];
        this.filters = [];
        this.filterOnSelect = function (filter) {
            this.next();
        };
        this.query = {};

        //Construction
        var init = function (self) {

            /* Behaviour Filter */
            var dropdownSelectionData = [{ text: jQuery.i18n.map['cohorts.performed-event'], value: "did" }, { text: jQuery.i18n.map['cohorts.not-perform-event'], value: "didnot" }];
            var dropdownSelection = new DropDown(dropdownSelectionData, 'type', -1, jQuery.i18n.map['cohorts.select-behavior-type']);
            dropdownSelection.subscribe(self.filterChanged, self);

            self.filters.push(dropdownSelection);

            /** Event Filter */
            var eventDropDownData = self.events.map(function (event) {
                return { text: event.name, value: event.key }
            });

            eventDropDownData.splice(0, 0, { text: jQuery.i18n.map['cohorts.events'] });
            eventDropDownData.splice(0, 0, { text: jQuery.i18n.map['cohorts.crash'], value: '[CLY]_crash' });
            eventDropDownData.splice(0, 0, { text: jQuery.i18n.map['cohorts.view'], value: '[CLY]_view' });
            eventDropDownData.splice(0, 0, { text: jQuery.i18n.map['cohorts.sessions'], value: '[CLY]_session' });

            var eventDropDown = new DropDown(eventDropDownData, 'event', -1, jQuery.i18n.map['cohorts.select-an-event'], "big-list");
            eventDropDown.subscribe(self.filterChanged, self);
            eventDropDown.isVisible = false;
            dropdownSelection.subscribe(eventDropDown.show, eventDropDown);
            self.filters.push(eventDropDown);

            /** Frequency select */
            var frequencySelect = new FrequencySelect('times');
            frequencySelect.subscribe(self.filterChanged, self);
            frequencySelect.isVisible = false;
            dropdownSelection.subscribe(frequencySelect.show, frequencySelect);
            self.filters.push(frequencySelect);

            /** Time Range Filter */
            var timeRangeDropdown = new PeriodDropDown('period');
            timeRangeDropdown.subscribe(self.filterChanged, self);
            timeRangeDropdown.isVisible = false;
            dropdownSelection.subscribe(timeRangeDropdown.show, timeRangeDropdown);
            self.filters.push(timeRangeDropdown);
        }

        init(this);
    };
    ConditionQueryRow.prototype = Object.create(HTMLDomElement.prototype);

    ConditionQueryRow.prototype.filterChanged = function (filter) {
        this.query[filter.name] = filter.getSelectedItem().value;

        if (filter.name === "event") {
            var self = this;

            if (self.parentRow.segmentationData) self.parentRow.segmentationData.isFetching = true;

            self.parentRow.subRows.splice(1, self.parentRow.subRows.length);
            self.parentRow.refresh();
            self.runObservers(self);

            self.parentRow.segmentationData = new SegmentationData(filter.getSelectedItem().value, function (segmentData) {
                self.parentRow.eventProperties = segmentData.getFilters();
                self.parentRow.selectedEvent = filter.getSelectedItem();
                self.parentRow.refresh();
                self.runObservers(self);
            });

        } else if (filter.name === "type") {
            this.parentRow.refresh();
            this.runObservers(this);
        }
        else
            this.runObservers(this);
    };

    ConditionQueryRow.prototype.getQuery = function () {
        if (Object.keys(this.query).length < 3) {
            for (var i = 0; i < this.filters.length; i++) {
                if (this.filters[i].getSelectedItem())
                    this.query[this.filters[i].name] = this.filters[i].getSelectedItem().value;
            }
        }

        return (this.query.hasOwnProperty('type') && this.query.hasOwnProperty('event') && this.query.hasOwnProperty('period')) ? this.query : undefined;
    };
    ConditionQueryRow.prototype.render = function () {
        this.html = "<div class='condition-range-row'>";
        this.html += "<div>" + this.label + "</div>"
        this.html += "</div>";

        this.html = $(this.html);

        var self = this;

        var filterBlock = $("<div class='filter-block'></div>");
        var tableDiv = $("<div class='filter-table-block'></div>")
        var performedDiv = $('<div></div>');
        performedDiv.append(this.filters[0].render());
        tableDiv.append(performedDiv);


        var eventDiv = $('<div></div>');
        eventDiv.append(this.filters[1].render());
        tableDiv.append(eventDiv);

        var timeAndCountBlock = $('<div></div>');
        if (this.filters[0].selectedIndex <= 0)
            timeAndCountBlock.append(this.filters[2].render());
        timeAndCountBlock.append(this.filters[3].render());

        tableDiv.append(timeAndCountBlock);

        filterBlock.append(tableDiv);
        this.html.append(filterBlock);

        var removeColumn = $('<div></div>');
        var removeButton = $('<a href="#" class="remove-row text-light-gray"><i class="material-icons">highlight_off</i></a>');
        removeButton.off('click').on('click', function (e) {
            e.preventDefault();

            if (self.onRemove)
                self.onRemove();
        });
        removeColumn.html(removeButton);
        this.html.append(removeColumn); //Remove row;

        return this.html;
    };

    //Line Row
    function LineRow(parentRow) {
        HTMLDomElement.call(this);
    };
    LineRow.prototype.render = function () {
        return $('<div class="line-row"><span>THEN</span></div>');
    };

    //Segmentation Row
    function SegmentationRow(parentRow) {
        HTMLDomElement.call(this);
        this.subRows = [];
        this.parentRow = parentRow;
        this.eventProperties = parentRow.eventProperties;
    };
    SegmentationRow.prototype = Object.create(HTMLDomElement.prototype);
    SegmentationRow.prototype.removeRow = function (row) {
        var self = this;
        row.willDelete = true;
        row.removed = true;

        row.renderRemoveWarning();

        setTimeout(function () {
            if (row.willDelete) {
                var indexOf = self.subRows.indexOf(row);
                self.subRows.splice(indexOf, 1);

                if (indexOf === 0 && self.subRows.length > 0)
                    delete self.subRows[0].andOrFilter;

                if (self.subRows.length > 0)
                    self.subRows[self.subRows.length - 1].isDisabled = false;

                self.refresh();
            }
        }, 3000);
    };
    SegmentationRow.prototype.render = function () {
        this.html = $('<div class="segmentation-row"></div>');

        if (this.subRows.length > 0)
            this.html.append('<div class="text-dark-gray">' + jQuery.i18n.map['cohorts.which-has'] + '</div>');

        var self = this;
        this.subRows.map(function (row) {
            row.onRemove = self.removeRow.bind(self);
            self.html.append(row.render());
        });

        if (!self.parentRow.segmentationData.isFetching) {
            var addSegmentationButton = $('<a href="#" class="text-orange add-segmentation-row-btn"><i class="fa fa-filter"></i> ' + jQuery.i18n.map['cohorts.add-segmentation'] + '</a>');

            addSegmentationButton.off('click').on('click', function (e) {
                e.preventDefault();

                var byRow = self.subRows.filter(function (row) {
                    if (row.andOrFilter && row.andOrFilter.getSelectedItem().value === "by")
                        return true;
                })[0];


                var rowsWithoutBy = self.subRows.slice(0, self.subRows.indexOf(byRow));

                if (!byRow && self.subRows.length > 0 && !self.subRows[self.subRows.length - 1].getQuery()) {
                    var prevRow = self.subRows[self.subRows.length - 1];

                    if (!prevRow.filters[0].getSelectedItem())
                        prevRow.filters[0].html.css('border-color', '#dd6935');

                    if (!prevRow.filters[2].getSelectedItem())
                        prevRow.filters[2].html.css('border-color', '#dd6935');

                    return;
                } else if (byRow && rowsWithoutBy.length > 0 && !rowsWithoutBy[rowsWithoutBy.length - 1].getQuery()) {
                    return;
                }


                if (!byRow) {
                    self.subRows.push(new SegmentationQueryRow(self));
                }
                else {
                    self.subRows.splice(self.subRows.indexOf(byRow), 1);
                    self.subRows.push(new SegmentationQueryRow(self));
                    self.subRows.push(byRow);
                }

                self.subRows.map(function (row, index) {
                    if (byRow === row) {
                        row.isDisabled = false;
                    } else if (byRow && (index != self.subRows.length - 2))
                        row.isDisabled = true;
                    else if (!byRow && (index != self.subRows.length - 1))
                        row.isDisabled = true;
                    else
                        row.isDisabled = false;
                })

                self.runObservers('add-segmentation-row');
                self.refresh();
            });

            this.html.append(addSegmentationButton);
        } else {
            var pleaseWait = "<div class='segment-loading'>" + jQuery.i18n.map['cohorts.segment-loading'] + "...</div>"
            this.html.append(pleaseWait);
        }




        return this.html;
    };
    SegmentationRow.prototype.getQuery = function () {
        var dbFilter = {
            query: {},
            byVal: ""
        };

        this.subRows.map(function (row) {
            var rowData = row.getQuery();
            var query = dbFilter.query;

            if (!row.removed && rowData) {
                var condition = switchEquationTextToVal(rowData.condition);

                if (rowData.parentRelation === "by") {
                    dbFilter.byVal = rowData.properties;
                } else {
                    query[rowData.properties] = query[rowData.properties] || {};

                    if (condition === "$in" || condition === "$nin") {

                        query[rowData.properties][condition] = query[rowData.properties][condition] || [];
                        query[rowData.properties][condition].push(rowData.filter);
                    } else {
                        query[rowData.properties][condition] = rowData.filter;
                    }
                }

            }
        });

        return dbFilter;
    };

    //Segmentation Query Row
    function SegmentationQueryRow(parentRow) {
        HTMLDomElement.call(this);
        this.filters = [];
        this.parentRow = parentRow;

        this.setPrevRows = function (self) {
            var previousRowProps = []

            if (self.andOrFilter) {
                for (var i in self.parentRow.subRows) {
                    var currentRow = self.parentRow.subRows[i];

                    if (currentRow != self) {

                        var prevRowQuery = currentRow.getQuery();
                        if (prevRowQuery)
                            previousRowProps.push(prevRowQuery.properties);
                    }

                }
            }

            return previousRowProps;
        }

        this.setPropItems = function (self, previousRowProps) {
            var pf_props_items = [];

            for (var i in self.parentRow.parentRow.eventProperties) {
                var currentEvent = self.parentRow.parentRow.eventProperties[i];


                if (self.andOrFilter && (self.andOrFilter.getSelectedItem().value === "and" || self.andOrFilter.getSelectedItem().value === "by")) {
                    if (previousRowProps.indexOf(currentEvent.id) < 0 || currentEvent.id === "up.fs") {
                        pf_props_items.push({
                            text: currentEvent.name,
                            value: currentEvent.id,
                            type: currentEvent.type
                        })
                    }
                } else if (self.andOrFilter && self.andOrFilter.getSelectedItem().value === "or") {
                    if (previousRowProps.indexOf(currentEvent.id) >= 0) {
                        pf_props_items.push({
                            text: currentEvent.name,
                            value: currentEvent.id,
                            type: currentEvent.type
                        })
                    }
                } else {
                    pf_props_items.push({
                        text: currentEvent.name,
                        value: currentEvent.id,
                        type: currentEvent.type
                    })
                }
            }
            return pf_props_items;
        };

        this.initFilters = function (self) {
            self.filters = [];

            var previousRowProps = self.setPrevRows(self);

            var pf_props_items = self.setPropItems(self, previousRowProps);

            var pf_props = new DropDown(pf_props_items, 'properties', -1, jQuery.i18n.map['cohorts.select-a-filter']);
            pf_props.parentRow = self;
            self.filters.push(pf_props);

            if (!self.andOrFilter || (self.andOrFilter && self.andOrFilter.getSelectedItem().value !== "by")) {
                /* Condition Filter */
                var cf_props = new FilterDropDown(4);
                cf_props.parentRow = self;
                cf_props.name = 'condition';
                pf_props.subscribe(cf_props.cascadeParentChanged, cf_props);
                self.filters.push(cf_props);

                /* Filter */
                var filterValueInput = new FilterValueInput('filter');
                filterValueInput.parentRow = self;
                pf_props.subscribe(filterValueInput.typeChanged, filterValueInput);
                self.filters.push(filterValueInput);
            }

        };

        var init = function (self) {
            if (self.parentRow.subRows.length > 0) {
                self.andOrFilter = new AndOrDropDown();

                self.andOrFilter.subscribe(function (item) {
                    this.initFilters(this);
                    this.refresh();
                }, self);
            }
            /* Props Filter */
            self.initFilters(self);
        };
        init(this);
    };
    SegmentationQueryRow.prototype = Object.create(HTMLDomElement.prototype);

    SegmentationQueryRow.prototype.renderRemoveWarning = function () {
        var self = this;

        var removeRowWarning = $("<div class='undo-row'>" + jQuery.i18n.map['cohorts.row-removed'] + ". <a href='#'>Undo</a></div>");
        removeRowWarning.find('a').on('click', function (e) {
            e.preventDefault();
            self.willDelete = false;
            self.removed = false;
            self.parentRow.refresh();
        })

        self.html.html(removeRowWarning);
    };

    SegmentationQueryRow.prototype.render = function () {

        if (this.removed) {
            this.renderRemoveWarning();
            return this.html;
        }

        this.html = $('<div></div>');

        if (this.andOrFilter)
            this.html.append(this.andOrFilter.render());

        var divFilterContainer = $('<div class="segmentation-filter p-b-10"></div>');
        var divFilterInputs = $('<div></div>');
        var self = this;
        this.filters.map(function (filter) {
            var div = $('<div></div>');
            div.html(filter.render());
            divFilterInputs.append(div);
        });

        divFilterContainer.append(divFilterInputs);

        //Delete column
        var deleteColumn = $('<div></div>');
        var deleteButton = $('<a href="#" class="remove-row text-light-gray"><i class="material-icons">highlight_off</i></a>');

        deleteButton.off('click').on('click', function (e) {
            e.preventDefault();
            self.onRemove(self);
        });
        deleteColumn.append(deleteButton);

        divFilterContainer.append(deleteColumn);

        this.html.append(divFilterContainer);

        if (self.isDisabled) {
            self.html.find('.cly-select[data-name="properties"]').addClass('disabled');
            self.html.find('.cly-select[data-name="filter"]').addClass('disabled');
            self.html.find('.cly-select-orange').addClass('disabled');
        } else {
            self.html.find('.cly-select[data-name="properties"]').removeClass('disabled');
            self.html.find('.cly-select[data-name="filter"]').removeClass('disabled');
            self.html.find('.cly-select-orange').removeClass('disabled');
        }

        return this.html;
    };

    SegmentationQueryRow.prototype.getQuery = function () {

        var selectedData = {};

        var type;
        this.filters.map(function (filter) {
            if (filter instanceof FilterValueInput) {
                if (type && (type.toLowerCase() == "d" || type.toLowerCase() == "n" || (type.toLowerCase().indexOf("custom.") === 0 && $.isNumeric(filter.selectedValue)))) {
                    selectedData[filter.name] = parseInt(filter.selectedValue);
                }
                else{
                    selectedData[filter.name] = filter.selectedValue;
                }
            } else {
                var selectedItem = filter.getSelectedItem();
                type = selectedItem.type || type;
                if (!selectedItem) return;
                selectedData[filter.name] = selectedItem.value;
            }

        });

        if (this.andOrFilter)
            selectedData.parentRelation = this.andOrFilter.getSelectedItem().value;

        if (selectedData.parentRelation !== "by" && (!selectedData.properties || !selectedData.filter)) {
            return;
        }
        return selectedData;
    };

    //Filter Drop Down Class
    function DropDown(items, name, selectedIndex, placeHolder, className) {
        HTMLDomElement.call(this);
        this.items = items;
        this.name = name;
        this.placeHolder = placeHolder;
        this.isVisible = true;
        this.type = 'standard_dropdown';
        this.selectedIndex = selectedIndex;
        this.className = className;
    };
    DropDown.prototype = Object.create(HTMLDomElement.prototype);

    DropDown.prototype.getSelectedItem = function () {
        return this.items[this.selectedIndex];
    };
    DropDown.prototype.onItemSelect = function (item) {
        this.selectedIndex = this.items.indexOf(item);
        if (this.onSelect)
            this.onSelect(this);
    };
    DropDown.prototype.hide = function () {
        this.html.hide();
    };
    DropDown.prototype.show = function () {
        this.isVisible = true;
        this.html.css('border-color', '#D0D0D0');
        this.html.show();
    };
    DropDown.prototype.render = function () {
        if (this.isVisible)
            this.html += "<div class='cly-select text-align-left " + this.className + "' data-name='" + this.name + "'>";
        else
            this.html += "<div class='cly-select text-align-left " + this.className + "' data-name='" + this.name + "' style='display:none'>";
        this.html += "<div class='select-inner'>";
        this.html += "<div class='text-container'>";

        if (this.selectedIndex >= 0)
            this.html += "<div class='text' style='width:80%' data-value='" + this.getSelectedItem().value + "'>" + this.getSelectedItem().text + "</div>";
        else
            this.html += "<div class='text' style='width:80%'><span class='text-light-gray'>" + this.placeHolder + "</span></div>";
        this.html += "</div>";
        this.html += "<div class='right combo'></div>";
        this.html += "</div>";
        this.html += "<div class='select-items square' style='display: none;'>";
        this.html += "<div class='items'>";
        this.html += "</div>";
        this.html += "</div>";
        this.html += "</div>";
        this.html = $(this.html);

        var self = this;

        this.items.map(function (item) {
            var itemDom;

            if (item.value) {
                itemDom = $("<div class='item' data-value='" + item.value + "'>" + item.text + "</div>");
                itemDom.off('click').on('click', function () {
                    self.html.css('border-color', '#D0D0D0');
                    self.html.find('.text').attr('data-value', item.value);
                    self.selectedIndex = self.items.indexOf(item);

                    setTimeout(function () {
                        self.runObservers(self);
                    }, 100);
                });
            }
            else
                itemDom = $("<div class='group'>" + item.text + "</div>");

            self.html.find('.items').append(itemDom);
        });

        return this.html;
    };

    function AndOrDropDown(selectedIndex) {
        DropDown.call(this, [{ text: 'AND', value: 'and' }, { text: 'OR', value: 'or' }]);
        this.selectedIndex = selectedIndex || 0;
    };
    AndOrDropDown.prototype = Object.create(DropDown.prototype);
    AndOrDropDown.prototype.render = function () {

        this.html = "<div class='cly-select centered text-align-left cly-select-orange' style='width:70px !important'>";
        this.html += "<div class='select-inner'>";
        this.html += "<div class='text-container'>";
        this.html += "<div class='text' style='width:80%' data-value='" + this.getSelectedItem().value + "'>" + this.getSelectedItem().text + "</div>";
        this.html += "</div>";
        this.html += "<div class='right combo'></div>";
        this.html += "</div>";
        this.html += "<div class='select-items square' style='display: none;width: 70px !important; min-height: auto;'>";
        this.html += "<div class='items'>";
        this.html += "</div>";
        this.html += "</div>";
        this.html += "</div>";
        this.html = $(this.html);


        var self = this;

        this.html.off('click').on('click', function () {
            var mainDropdown = $(this);

            $(this).parents('.segmentation-row').find('.cly-select-orange').each(function (index) {
                if ($(this).find('.text').attr("data-value") === "by") {
                    mainDropdown.find('.items').find('.item[data-value="by"]').hide();
                } else
                    mainDropdown.find('.items').find('.item[data-value="by"]').show();
            })
        });


        this.items.map(function (item) {
            var itemDom = $("<div class='item' data-value='" + item.value + "'>" + item.text + "</div>");
            itemDom.off('click').on('click', function () {
                self.selectedIndex = self.items.indexOf(item);
                self.runObservers(self);
                self.refresh();
            });

            self.html.find('.items').append(itemDom);
        });

        return this.html;
    };

    function FilterDropDown(selectedIndex, parentDataType) {
        DropDown.call(this, [
            { text: '>', value: '>', dataTypes: ['s', 'n', 'd'] },
            { text: '>=', value: '>=', dataTypes: ['s', 'n', 'd'] },
            { text: '<', value: '<', dataTypes: ['s', 'n', 'd'] },
            { text: '<=', value: '<=', dataTypes: ['s', 'n', 'd'] },
            { text: '=', value: '=', dataTypes: ['s', 'n', 'l', 'bl'] },
            { text: '!=', value: '!=', dataTypes: ['s', 'n', 'l', 'bl'] }
        ]);

        this.cascadeParentDataType = parentDataType || 's';
        this.selectedIndex = selectedIndex || 0;
    };
    FilterDropDown.prototype = Object.create(DropDown.prototype);
    FilterDropDown.prototype.render = function () {
        this.html = "<div class='cly-select text-align-left filter-drop-down' data-name='filter'>";
        this.html += "<div class='select-inner'>";
        this.html += "<div class='text-container'>";

        if (this.selectedIndex >= 0)
            this.html += "<div class='text' style='width:80%' data-value='" + this.getSelectedItem().value + "'>" + this.getSelectedItem().text + "</div>";
        else
            this.html += "<div class='text' style='width:80%'><span class='text-light-gray'>" + this.placeHolder + "</span></div>";
        this.html += "</div>";
        this.html += "<div class='right combo'></div>";
        this.html += "</div>";

        this.html += "<div class='select-items square' style='display: none;min-height: auto; top: 27px;position: absolute'>";
        this.html += "<div class='items'>";
        this.html += "</div>";
        this.html += "</div>";
        this.html += "</div>";
        this.html = $(this.html);

        var self = this;
        var activeItemCount = 0;
        this.items.map(function (item) {
            if (item.dataTypes.indexOf(self.cascadeParentDataType) < 0) return;

            activeItemCount++;
            var itemDom;

            if (item.value) {
                itemDom = $("<div class='item' data-value='" + item.value + "'>" + item.text + "</div>");
                itemDom.off('click').on('click', function () {
                    self.html.find('.text').attr('data-value', item.value);
                    self.selectedIndex = self.items.indexOf(item);
                    self.runObservers(self);
                });
            }
            else
                itemDom = $("<div class='group'>" + item.text + "</div>");

            self.html.find('.items').append(itemDom);
        });

        switch (activeItemCount) {
            case 6:
                this.html.find('.select-items').css('top', "-70px");
                break;
            case 4:
                this.html.find('.select-items').css('top', "-40px");
                break;
            case 2:
                this.html.find('.select-items').css('top', "-15px");
                break;
        }

        if (this.items.length === 6)
            topPosition = -70;
        else if (this.items.length === 2)
            topPosition = -15;

        return this.html;
    };
    FilterDropDown.prototype.cascadeParentChanged = function (parent) {
        this.cascadeParentDataType = parent.getSelectedItem().type;

        switch (this.cascadeParentDataType) {
            case "s":
            case "n":
            case "l":
            case "bl":
                this.selectedIndex = 4;
                break;
            default:
                this.selectedIndex = 0;
                break;
        }

        this.refresh();
    };

    function FilterValueInput(name) {
        HTMLDomElement.call(this);
        this.name = name;
        this.type = 'l';
        this.items = [];
        this.selectedIndex = -1;
    };
    FilterValueInput.prototype = Object.create(HTMLDomElement.prototype);

    FilterValueInput.prototype.getSelectedItem = function () {
        return this.items[this.selectedIndex];
    };

    FilterValueInput.prototype.typeChanged = function (parent, callback) {

        this.type = parent.getSelectedItem().type;
        this.selectedIndex = -1;
        delete this.selectedValue;
        delete this.selectedDateValue;

        var conditionRow = this.parentRow.parentRow.parentRow;

        if (this.type === "l") {
            var segmentationData = conditionRow.segmentationData;
            var filterValues = segmentationData.getFilterValues(parent.getSelectedItem().value);
            var filterNames = segmentationData.getFilterNames(parent.getSelectedItem().value);

            this.items = filterValues.reduce(function (list, value, index) {
                list.push({
                    text: filterNames[index],
                    value: value
                });
                return list;
            }, []);

            if (callback)
                callback();

            this.refresh();
        } else if (this.type === "bl") {
            var self = this;

            var event = conditionRow.selectedEvent.value;
            var period = conditionRow.subRows[0].filters[3].getSelectedItem().value;
            conditionRow.segmentationData.getBigListMetaData(parent.getSelectedItem().value, period, event, function (filterValues, filterNames) {

                if (Array.isArray(filterValues)) {
                    self.items = filterValues.reduce(function (list, value, index) {

                        list.push({
                            text: filterNames[index],
                            value: value
                        });

                        return list;
                    }, []);
                } else {
                    var counter = 0;
                    self.items = [];

                    for (var p in filterValues) {

                        self.items.push({
                            text: p
                        });

                        for (var i = 0; i < filterValues[p].length; i++) {
                            self.items.push({
                                text: countlyCommon.decode(filterValues[p][i]),
                                value: filterValues[p][i]
                            });
                        }
                    }
                }


                if (callback)
                    callback();
                self.refresh();
            })
        } else {
            if (callback)
                callback();
            this.refresh();
        }


    }

    FilterValueInput.prototype.render = function () {
        var self = this;
        function renderList(isBigList) {
            self.html += isBigList ? "<div class='cly-select text-align-left big-list'>" : "<div class='cly-select text-align-left'>";

            self.html += "<div class='select-inner'>";
            self.html += "<div class='text-container'>";

            if (self.selectedIndex >= 0)
                self.html += "<div class='text' style='width:80%'>" + self.getSelectedItem().text + "</div>";
            else
                self.html += "<div class='text' style='width:80%'><span class='text-light-gray'>-----</span></div>";
            self.html += "</div>";
            self.html += "<div class='right combo'></div>";
            self.html += "</div>";
            self.html += "<div class='select-items square' style='display: none;'>";
            self.html += "<div class='items'>";
            self.html += "</div>";
            self.html += "</div>";
            self.html += "</div>";
            self.html = $(self.html);

            self.items.map(function (item) {
                var itemDom;

                if (item.value) {
                    itemDom = $("<div class='item' data-value='" + item.value + "'>" + item.text + "</div>");
                    itemDom.off('click').on('click', function () {
                        self.html.css('border-color', '#D0D0D0');
                        self.selectedIndex = self.items.indexOf(item);
                        self.selectedValue = item.value;
                        self.runObservers(self);
                    });
                }
                else
                    itemDom = $("<div class='group'>" + item.text + "</div>");

                self.html.find('.items').append(itemDom);
            });
        }

        function renderInputText() {
            var inputField = $('<input type="text" placeholder="String" class="string-input">');

            if (self.selectedValue)
                inputField.val(self.selectedValue);

            inputField.on('change', function () {
                self.html.css('border-color', '#D0D0D0');
                self.selectedValue = $(this).val();
            });

            self.html = inputField;
        };

        function renderInputNumber() {
            var inputField = $('<input type="number" placeholder="Number" class="string-input">');

            if (self.selectedValue)
                inputField.val(self.selectedValue);

            inputField.on('change', function () {
                self.html.css('border-color', '#D0D0D0');
                self.selectedValue = $(this).val();
            });

            self.html = inputField;
        };

        function renderDatePicker() {
            self.html = $('<div class="filter-value-date"></div>');

            var openDatePicker = $('<input type="text" placeholder="Date" class="string-input date-value">');
            if (self.selectedDateValue)
                openDatePicker.val(self.selectedDateValue);


            openDatePicker.off('click').on('click', function (e) {
                $(".date-picker").hide();
                $(this).parent().find(".date-picker").show();

                var queryType = $(this).parents('.segmentation-filter').find('.filter-drop-down').find('.text').attr('data-value');
                var maxDate = (queryType === ">=") ? moment().subtract(1, 'days').toDate() : moment().add(1, 'days').toDate();

                $(this).parent().find(".date-picker").find(".calendar").datepicker({
                    numberOfMonths: 1,
                    showOtherMonths: true,
                    onSelect: function (selectedDate) {
                        self.html.css('border-color', '#D0D0D0');
                        var instance = $(this).data("datepicker"),
                            date = $.datepicker.parseDate(instance.settings.dateFormat || $.datepicker._defaults.dateFormat, selectedDate, instance.settings),
                            currMoment = moment(date);


                        self.selectedDateValue = countlyCommon.formatDate(currMoment, "DD MMMM, YYYY");
                        self.html.find('.date-value').val(self.selectedDateValue);

                        var selectedTimestamp = moment(currMoment.format("DD MMMM, YYYY"), "DD MMMM, YYYY").unix();
                        var tzCorr = countlyCommon.getOffsetCorrectionForTimestamp(selectedTimestamp);
                        self.selectedValue = selectedTimestamp - tzCorr;
                        $(".date-picker").hide();
                    }
                });

                $(this).next(".date-picker").find(".calendar").datepicker('option', 'maxDate', maxDate);
                $.datepicker.setDefaults($.datepicker.regional[""]);
                $(this).next(".date-picker").find(".calendar").datepicker("option", $.datepicker.regional[countlyCommon.BROWSER_LANG]);

                if (self.selectedValue) {
                    $(this).next(".date-picker").find(".calendar").datepicker("setDate", moment(self.selectedValue * 1000).toDate());
                }


                $(this).next(".date-picker").click(function (e) {
                    e.stopPropagation();
                });

                e.stopPropagation();
            });

            self.html.append(openDatePicker);
            self.html.append($('<div class="date-picker" style="display:none"><div class="calendar-container calendar-light"><div class="calendar"></div></div></div>'))
        };

        switch (this.type) {
            case "l":
                renderList(false);
                break;
            case "bl":
                renderList(true);
                break;
            case "s":
                renderInputText();
                break;
            case "d":
                renderDatePicker();
                break;
            case "n":
                renderInputNumber();
                break;
        };


        return this.html;
    };

    function PeriodDropDown(name) {
        HTMLDomElement.call(this);
        this.name = name;
        this.selectedIndex = -1;
        this.placeHolder = jQuery.i18n.map['cohorts.select-time-range'];
        this.isVisible = true;

        this.items = [
            { text: "7 " + jQuery.i18n.map['cohorts.days'], value: '7days', selectedText: jQuery.i18n.prop('cohorts.in-last-days-plural', 7) },
            { text: "14 " + jQuery.i18n.map['cohorts.days'], value: '14days', selectedText: jQuery.i18n.prop('cohorts.in-last-days-plural', 14) },
            { text: "30 " + jQuery.i18n.map['cohorts.days'], value: '30days', selectedText: jQuery.i18n.prop('cohorts.in-last-days-plural', 30) },
            { text: jQuery.i18n.map['cohorts.all-time'], value: '0days', selectedText: jQuery.i18n.map['cohorts.all-time'] }
        ]

    }
    PeriodDropDown.prototype = Object.create(HTMLDomElement.prototype);

    PeriodDropDown.prototype.getSelectedItem = function () {
        if (this.selectedIndex < 0 && (this.selectedValue && this.selectedValue.text.length > 0)) {
            return this.selectedValue
        } else
            return this.items[this.selectedIndex];
    };
    PeriodDropDown.prototype.onItemSelect = function (item) {
        this.selectedIndex = this.items.indexOf(item);
        if (this.onSelect)
            this.onSelect(this);
    };
    PeriodDropDown.prototype.hide = function () {
        this.html.hide();
    };
    PeriodDropDown.prototype.show = function () {
        this.html.css('border-color', '#D0D0D0');
        this.isVisible = true;
        this.html.show();
    };



    PeriodDropDown.prototype.render = function () {
        if (this.isVisible)
            this.html += "<div class='cly-select has-data float cly-time-period text-align-left float' data-name='" + this.name + "'>";
        else
            this.html += "<div class='cly-select has-data float cly-time-period text-align-left float' data-name='" + this.name + "' style='display:none'>";
        this.html += "<div class='select-inner'>";
        this.html += "<div class='text-container'>";

        if ((this.selectedIndex >= 0) || (this.selectedValue && this.selectedValue.text.length > 0))
            this.html += "<div class='text' style='width:80%' data-value='" + this.getSelectedItem().value + "'><span>" + this.getSelectedItem().selectedText + "</span></div>";
        else
            this.html += "<div class='text' style='width:80%'><span class='text-light-gray'>" + this.placeHolder + "</span></div>";
        this.html += "</div>";
        this.html += "<div class='right combo'></div>";
        this.html += "</div>";
        this.html += "<div class='select-items square' style='display: none;overflow: initial'>";

        this.html += "<div class='items list-items list-items-selected' ></div>";

        this.html += "<div class='items period-select'>";
        this.html += "<div><a href='#' class='back-button'><i class='ion-chevron-left' style='font-size:10px;margin-right:2px'></i> " + jQuery.i18n.map['cohorts.back'] + "</a></div>";
        this.html += "<div>" + jQuery.i18n.map['cohorts.number-of-days'] + "</div>";
        this.html += "<div><input type='text' maxlength='5' class='custom-number' value='10' /></div>"
        this.html += "<div class='min-value-alert'></div>"
        this.html += "<div><div class='icon-button green'>" + jQuery.i18n.map['cohorts.apply'] + "</div></div>"
        this.html += "</div>";

        this.html += "</div>";
        this.html += "</div>";
        this.html = $(this.html);


        // if ((this.selectedIndex >= 0) || (this.selectedValue && this.selectedValue.text.length > 0))
        //     this.html.addClass('has-data');

        this.html.find('.list-items').html('<div class="custom-range">' + jQuery.i18n.map['cohorts.custom-range'] + ' <span><i class="ion-chevron-right" style="font-size:10px"></i></span></div>');

        var self = this;

        this.html.find('.custom-number').keydown(onlyNumber);
        this.html.find('.custom-number').on('keyup', function (e) {

            if ($(this).val() < 1) {
                self.html.find('.min-value-alert').html(jQuery.i18n.prop('cohorts.minimum-value-alert', 1));
                self.html.find('.icon-button').hide();
                self.html.find('.min-value-alert').show();
            } else {
                self.html.find('.icon-button').show();
                self.html.find('.min-value-alert').hide();
            }
        })

        this.html.find('.period-select').on('click', function (e) {
            e.stopPropagation();
        });

        this.html.find('.icon-button').on('click', function () {
            self.selectedIndex = -1;
            var selectedValue = self.html.find('.custom-number').val();
            if (!selectedValue) return;

            self.selectedValue = {
                text: selectedValue + " " + jQuery.i18n.map['cohorts.days'],
                value: selectedValue + "days",
                selectedText: jQuery.i18n.prop('cohorts.in-last-days' + (selectedValue > 1 ? '-plural' : ''), selectedValue)
            };

            self.html.find(".select-items").hide();
            self.html.find(".search").remove();
            self.html.removeClass("active");
            self.html.find('.text').html(jQuery.i18n.prop('cohorts.in-last-days' + (selectedValue > 1 ? '-plural' : ''), selectedValue));
            self.html.find('.text').attr('data-value', selectedValue + "days");

            self.html.find('.list-items').addClass("list-items-selected");
            self.html.find('.list-items').removeClass("period-select-selected");

            self.runObservers(self);
            // self.refresh();
        });

        this.html.find('.back-button').on('click', function (e) {
            e.preventDefault();
            self.html.find('.list-items').addClass("list-items-selected");
            self.html.find('.list-items').removeClass("period-select-selected");
        });

        this.html.find('.custom-range').on('click', function (e) {
            e.stopPropagation();
            self.html.find('.list-items').removeClass("list-items-selected");
            self.html.find('.list-items').addClass("period-select-selected");
        });

        this.items.map(function (item) {
            var itemDom;

            if (item.value) {
                itemDom = $("<div class='item' data-value='" + item.value + "'>" + item.text + "</div>");
                itemDom.off('click').on('click', function () {
                    self.html.find('.text').attr('data-value', item.value);
                    self.selectedIndex = self.items.indexOf(item);
                    self.runObservers(self);

                    setTimeout(function () {
                        // self.html.addClass('has-data');
                        self.html.find('.text').html("<span>" + item.selectedText + "</span>");
                    }, 0)
                });
            }
            else
                itemDom = $("<div class='group'>" + item.text + "</div>");

            self.html.find('.list-items').append(itemDom);
        });

        return this.html;
    };


    function FrequencySelect(name) {
        HTMLDomElement.call(this);
        this.name = name;
        this.selectedIndex = 0;
        this.placeHolder = jQuery.i18n.map['cohorts.select-frequency'];
        this.isVisible = true;

        this.items = [
            { text: jQuery.i18n.map['cohorts.more-than'], value: '$gte', data: 1, minValue: 1 },
            { text: jQuery.i18n.map['cohorts.equal-to'], value: '$eq', data: 1, minValue: 1 },
            { text: jQuery.i18n.map['cohorts.less-than'], value: '$lte', data: 2, minValue: 2 }
        ]

        this.tempSelection = {};
        this.selection = undefined;
    }

    FrequencySelect.prototype = Object.create(HTMLDomElement.prototype);

    FrequencySelect.prototype.getSelectedItem = function () {
        if (this.selection) {
            var filter = { value: {} };
            filter.value[this.selection.filter] = parseInt(this.selection.data);
            return filter;
        }

        return;
    };

    FrequencySelect.prototype.hide = function () {
        this.html.hide();
    };
    FrequencySelect.prototype.show = function () {
        this.html.css('border-color', '#D0D0D0');
        this.isVisible = true;
        this.html.show();
    };

    FrequencySelect.prototype.renderItems = function () {
        var html = "";
        var self = this;
        this.items.forEach(function (item, index) {
            html += "<div class='item' data-value='" + index + "'>"
            var checked = self.selectedIndex === index ? "checked" : "";
            html += "<div style='display:table-cell'><div class='styled-radio " + checked + "'></div></div> <label for='" + item.text + "'>" + item.text + "</label>";
            html += "</div>";
        });

        html += "<div class='frequency-input'>";
        html += "<div>" + jQuery.i18n.map['cohorts.number-of-times'] + "</div>"
        html += "<div><input type='text' min='" + self.items[self.selectedIndex] + "' maxlength='9' class='custom-number' value='" + self.items[self.selectedIndex].data + "'></div>"
        html += "<div class='min-value-alert'></div>"
        html += "<div><div class='icon-button green'>" + jQuery.i18n.map['cohorts.apply'] + "</div></div>"
        html += "</div>";

        return html;
    };

    FrequencySelect.prototype.bindItemClicks = function () {
        var self = this;

        this.html.find('.item').on('click', function (e) {
            self.tempSelection.selectedIndex = $(this).data().value;
            self.html.find('.checked').removeClass('checked');
            $(this).find('.styled-radio').addClass('checked');

            var value = self.html.find('.custom-number').val();
            var newValue = value < self.items[self.tempSelection.selectedIndex].minValue ? self.items[self.tempSelection.selectedIndex].minValue : value;
            self.html.find('.custom-number').val(newValue);
        });

        this.html.find('.icon-button').on('click', function (e) {
            e.preventDefault();
            var value = self.html.find('.custom-number').val();

            self.selection = {
                selectedIndex: self.tempSelection.selectedIndex,
                filter: self.items[self.tempSelection.selectedIndex].value,
                data: self.html.find('.custom-number').val()
            };

            self.items[self.tempSelection.selectedIndex].data = self.selection.data;
            self.selectedIndex = self.selection.selectedIndex;
            self.tempSelection = {};
            self.html.find('.select-items').css({ display: 'none' });
            self.html.removeClass('active');
            self.html.find('.text').html('<span>' + self.selectedItemText() + '</span>')
            // self.html.addClass('has-data');
            self.runObservers(self);
        });

        this.html.find('.custom-number').keydown(onlyNumber);
        this.html.find('.custom-number').on('keyup', function (e) {

            if ($(this).val() < self.items[self.tempSelection.selectedIndex].minValue) {
                self.html.find('.min-value-alert').html(jQuery.i18n.prop('cohorts.minimum-value-alert', self.items[self.tempSelection.selectedIndex].minValue));
                self.html.find('.icon-button').hide();
                self.html.find('.min-value-alert').show();
            } else {
                self.html.find('.icon-button').show();
                self.html.find('.min-value-alert').hide();
            }
        })

    };


    FrequencySelect.prototype.selectedItemText = function () {
        var item = this.selection;
        if (!item) return "";

        var selector = item.filter === "$eq"
            ? "equal"
            : item.filter === "$gte"
                ? "more" : "less";

        var text = 'cohorts.' + selector + '-performed-message' + (item.data > 1 ? '-plural' : '');
        return jQuery.i18n.prop(text, item.data);
    };

    FrequencySelect.prototype.render = function () {
        if (this.isVisible)
            this.html = "<div class='cly-select has-data float cly-frequency text-align-left' data-name='" + this.name + "'>";
        else
            this.html = "<div class='cly-select has-data float cly-frequency text-align-left' data-name='" + this.name + "' style='display:none'>";


        this.html += "<div class='select-inner'>";
        this.html += "<div class='text-container'>";

        if (this.selectedIndex >= 0 && this.selection)
            this.html += "<div class='text' style='width:80%'><span>" + this.selectedItemText() + "</span></div>";
        else
            this.html += "<div class='text' style='width:80%'><span class='text-light-gray'>" + this.placeHolder + "</span></div>";

        this.html += "</div>";
        this.html += "<div class='right combo'></div>";
        this.html += "</div>";
        this.html += "<div class='select-items square' style='display:none'>"
        this.html += "<div class='items'>";

        this.html += "</div>";
        this.html += "</div>"

        this.html += "</div>";

        this.html = $(this.html);
        // if (this.selection)
        //     this.html.addClass('has-data');

        var self = this;

        this.html.find('.select-items').on('click', function (e) {
            e.stopPropagation();
        });

        this.html.find('.select-inner').on('click', function (e) {
            self.tempSelection = { selectedIndex: self.selectedIndex };
            self.html.find('.items').html(self.renderItems());
            self.bindItemClicks();
        });


        return this.html;
    }


}(window.BehavioralQueryModule = window.BehavioralQueryModule || {}, jQuery));