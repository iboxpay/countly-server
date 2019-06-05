"use strict";
(function (FunnelDrawerModule, $) {

    //Module
    var startupActions = [
        { name: jQuery.i18n.map['funnels.view'], value: '[CLY]_view' },
        { name: jQuery.i18n.map['funnels.events'] }
    ];

    var app = {
        el: '#funnel-drawer',
        data: function () {
            return {
                id: null,
                funnelName: "",
                funnelDescription: "",
                onSave: null,
                isOpen: false,
                queryValid: false,
                events: startupActions.concat(countlyEvent.getEvents().map(function (event) { return { name: event.name, value: event.key } }))
            };
        },
        mounted: function () {
            var queryBuilder = this.$refs.drillQuery;
            var self = this;
            queryBuilder.$on('query_changed', function () {
                var response = true;
                var steps = queryBuilder.steps.filter(function (step) { return !step.isRemoved });

                for (var i = 0; i < steps.length; i++) {
                    var step = steps[i];

                    if (step.selectedEvent === null) {
                        response = false;
                        break;
                    } else {
                        var filters = step.filters.filter(function (filter) { return !filter.isRemoved })
                        for (var c = 0; c < filters.length; c++) {
                            var filter = filters[c];

                            if ((filter.propertyModel.selectedItem && filter.propertyModel.selectedItem.value === null) ||
                                filter.equationModel.selectedItem.value === null ||
                                filter.targetModel.selectedItem.value === null) {
                                response = false;
                                break;
                            }
                        }
                        if (!response)
                            break;
                    }
                }

                self.queryValid = steps.length < 2 ? false : response;
            });
        },
        components: {
            "drill-query-builder": DrillQueryBuilder.queryBuilder
        },
        methods: {
            show: function (selectedFunnel) {
                if (selectedFunnel) {
                    var self = this;
                    self.id = selectedFunnel._id;
                    selectedFunnel.steps = selectedFunnel.steps.map(function (step, index) {
                        return {
                            event: step,
                            query: (selectedFunnel.queries && selectedFunnel.queries[index]) ? selectedFunnel.queries[index] : {}
                        }
                    });
                    self.$refs.drillQuery.setModel(selectedFunnel, function () {
                        self.funnelName = selectedFunnel.name;
                        self.funnelDescription = selectedFunnel.description;
                        self.isOpen = true;
                    });

                } else {
                    var self = this;
                    this.id = null;
                    this.$refs.drillQuery.setModel(null, function () {
                        self.isOpen = true;
                    });
                }
            },
            hide: function () {
                this.isOpen = false;
                this.id = null;
                this.funnelName = "";
                this.funnelDescription = "";
            },
            saveFunnel: function () {
                if (!this.queryValid || !this.funnelName || this.funnelName.length === 0) return;

                var query = this.$refs.drillQuery.getQuery();

                var funnel = {
                    name: countlyCommon.encodeHtml(countlyCommon.decodeHtml(this.funnelName)),
                    description: countlyCommon.encodeHtml(countlyCommon.decodeHtml(this.funnelDescription)),
                    steps: [], queries: [], queryTexts: []
                };

                funnel = query.reduce(function (prev, current) {
                    prev.steps.push(current.event);
                    prev.queries.push(current.query);
                    prev.queryTexts.push(current.queryText);
                    return prev;
                }, funnel);
                if (this.id) {
                    funnel.id = this.id;
                    countlyFunnel.saveFunnel(funnel, FunnelDrawerModule.onSave);
                } else {
                    countlyFunnel.createFunnel(funnel, FunnelDrawerModule.onSave);
                }
            }
        },
        computed: {
            title: function () {
                return this.id ? jQuery.i18n.map['funnels.edit-funnel'] : jQuery.i18n.map['funnels.create']
            },
            saveButton: function () {
                return this.id ? jQuery.i18n.map['funnels.save-funnel'] : jQuery.i18n.map['funnels.create']
            },
            isBtnDisabled: function () {
                if (!this.queryValid || !this.funnelName || this.funnelName.length === 0)
                    return true;
                return false;
            }
        }
    };

    FunnelDrawerModule.app = {};
    FunnelDrawerModule.init = function (onSave) {
        FunnelDrawerModule.onSave = onSave;
        $.when($.get(countlyGlobal["path"] + '/drill/templates/drill.query.builder.html', function (src) {
            $('#funnel-drawer').append(src)
            FunnelDrawerModule.app = new Vue(app);
        }));

        
    };

    FunnelDrawerModule.open = function (selectedFunnel) {
        FunnelDrawerModule.app.show(selectedFunnel);
        $(document).bind('keyup', FunnelDrawerModule.hide);
    };

    FunnelDrawerModule.hide = function (e) {
        if (e && e.type === "keyup" && e.keyCode !== 27) return;
        FunnelDrawerModule.app.hide();
        $(document).unbind('keyup', FunnelDrawerModule.hide);
    };

}(window.FunnelDrawerModule = window.FunnelDrawerModule || {}, jQuery));