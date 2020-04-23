"use strict";
(function (CohortsDrawerModule, $) {

    //Module
    var startupActions = [
        { name: jQuery.i18n.map['cohorts.crash'], value: '[CLY]_crash' },
        { name: jQuery.i18n.map['cohorts.view'], value: '[CLY]_view' },
        { name: jQuery.i18n.map['cohorts.sessions'], value: '[CLY]_session' },
        { name: jQuery.i18n.map['cohorts.events'] }
    ];

    CohortsDrawerModule.app = {};
    CohortsDrawerModule.init = function (onSave) {
        CohortsDrawerModule.onSave = onSave;

        var tasks = [$.get(countlyGlobal["path"] + '/drill/templates/drill.query.builder.html')];
        var hasGeo = countlyGlobal["plugins"].indexOf("geo")!=-1;

        if (hasGeo) {
            tasks.push(countlyCohorts.loadLocations(countlyCommon.ACTIVE_APP_ID))
        } 
        
        $.when.apply($, tasks).then(completedCallback);

        function completedCallback (templateResponse, locationsResponse) {
            if (hasGeo) {
                var src = templateResponse[0];
                var locations = locationsResponse[0];
            }else{
                var src = templateResponse;
                var locations = [];
            }
            
            var app = {
                el: '#cohorts-drawer',
                data: function () {
                    return {
                        id: null,
                        cohortName: "",
                        onSave: null,
                        isOpen: false,
                        behaviorSegmentationIsValid: false,
                        userSegmentationIsValid: false,
                        events: startupActions.concat(countlyEvent.getEvents().map(function (event) { return { name: event.name, value: event.key } }))
                    };
                },
                mounted: function () {
                    var behaviorSegmentation = this.$refs.behaviorSegmentation;
                    var userSegmentation = this.$refs.userSegmentation;
                    var locationsMap = locations.reduce(function (map, value, index) {
                        map[value._id] = value;
                        return map;
                    }, {});
                    userSegmentation.staticProperties.setProperty("spup.loc", { 
                        listEntry: { value: "spup.loc", name: jQuery.i18n.map["push.geo.location"], type: "l" },
                        values:[],
                        allowedValues:{},
                        disableRegex: true,
                        events:{
                            onSave: function(value, queryObject){
                                var usedLocations = {};
                                for (var key in value) {
                                    value[key].forEach(function(item){
                                        usedLocations[item] = locationsMap[item];
                                    });
                                }
                                if (!queryObject.misc){
                                    queryObject.misc = {};
                                }
                                queryObject.misc.used_locations = usedLocations;
                            }
                        }
                    });
                    if (hasGeo && locations && locations.length>0){
                        userSegmentation.staticProperties.setValues("spup.loc", locations.reduce(function (list, value, index) {
                            list.push({name: value.title, value: value._id});
                            return list;
                        }, []));
                    }
                    var self = this;
                    behaviorSegmentation.$on('query_changed', function () {
                        var response = true;
                        var steps = behaviorSegmentation.steps.filter(function(step){return !step.isRemoved});
                        for (var i = 0; i < steps.length; i++) {
                            var step = steps[i];
                            if (step.selectedEvent === null || step.selectedBehavior === null || step.selectedPeriod === null) {
                                response = false;
                                break;
                            } else {
                                var filters = step.filters.filter(function(filter){return !filter.isRemoved})
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
                        self.behaviorSegmentationIsValid = steps.length < 1 ? false : response;
                    });

                    userSegmentation.$on('query_changed', function(){
                        var filters = userSegmentation.step.filters.filter(function(filter){ return !filter.isRemoved });
                        var userSegmentationIsValid = true;
                        for (var c = 0; c < filters.length; c++) {
                            var filter = filters[c];

                            if ((filter.propertyModel.selectedItem && filter.propertyModel.selectedItem.value === null) ||
                                filter.equationModel.selectedItem.value === null ||
                                filter.targetModel.selectedItem.value === null) {
                                userSegmentationIsValid = false;
                                break;
                            }
                        }
                        self.userSegmentationIsValid = userSegmentationIsValid;

                    })
                },
                components: {
                    "drill-query-builder": DrillQueryBuilder.queryBuilder,
                    "user-property-segmentation" : DrillQueryBuilder.userProperties
                },
                methods: {
                    show: function (selectedCohort) {
                        if (selectedCohort) {
                            var self = this;
                            self.id = selectedCohort.id;

                            self.$refs.behaviorSegmentation.setModel(selectedCohort, function () {
                                self.cohortName = countlyCommon.decodeHtml(selectedCohort.name); //selectedCohort.name;
                                self.$refs.userSegmentation.setModel(selectedCohort, function(){
                                        self.isOpen = true;
                                })
                            });

                            

                        } else {
                            var self = this;
                            this.id = null;
                            this.$refs.behaviorSegmentation.setModel(null, function () {
                                self.$refs.userSegmentation.setModel(null, function () {
                                    self.isOpen = true;
                                });
                            });
                        }
                    },
                    hide: function () {
                        this.isOpen = false;
                        this.id = null;
                        this.cohortName = "";
                    },
                    saveCohort: function () {
                        if ((!this.behaviorSegmentationIsValid && !this.userSegmentationIsValid) || !this.cohortName || this.cohortName.length === 0)
                            return;

                        var steps = this.$refs.behaviorSegmentation.getQuery();
                        var userSegmentaion = this.$refs.userSegmentation.getQuery();
                        var cohort = {
                            cohort_name: countlyCommon.encodeHtml(countlyCommon.decodeHtml(this.cohortName))
                        };
                        cohort.steps = JSON.stringify(steps);
                        cohort.user_segmentation = JSON.stringify(userSegmentaion);
                        if (this.id) {
                            cohort.cohort_id = this.id;
                            countlyCohorts.update(cohort, function (res) {
                                CohortsDrawerModule.onSave(res);
                            });
                        } else {
                            countlyCohorts.add(cohort, function (res) {
                                CohortsDrawerModule.onSave(res);
                            });
                        }
                    }
                },
                computed: {
                    title: function () {
                        return this.id ? jQuery.i18n.map['cohorts.update-cohort'] : jQuery.i18n.map['cohorts.create-cohort']
                    },
                    saveButton: function () {
                        return this.id ? jQuery.i18n.map['cohorts.update-cohort'] : jQuery.i18n.map['cohorts.create-cohort']
                    },
                    isBtnDisabled: function () {
                        if ((!this.behaviorSegmentationIsValid && !this.userSegmentationIsValid) || !this.cohortName || this.cohortName.length === 0)
                            return true;
                        return false;
                    }
                }
            };
            $('#cohorts-drawer').append(src)
            CohortsDrawerModule.app = new Vue(app);
        }
        
        
    };

    CohortsDrawerModule.open = function (selectedFunnel) {
        CohortsDrawerModule.app.show(selectedFunnel);
    };

    CohortsDrawerModule.hide = function () {
        CohortsDrawerModule.app.hide();
    };

}(window.CohortsDrawerModule = window.CohortsDrawerModule || {}, jQuery));
