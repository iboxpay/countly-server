"use strict";
/**
 * It query builder for both cohorts and funnels. Please crosscheck after you make changes.
 */


// var modelTemplate = {
//     queryBuilderType: String,
//     labels: {
//          addCondition: String
//     },
//     behaviors : Array,
//     events : Array,
//     frequencies : { name : String, equation : String },
//     periods : { name : String, value : Number, valueAsString : String, longName : String },
//     equations : Array,
//     andOrItems : Array,
//     steps : [{
//         isRemoved : false,
//         segmentationMeta : Array, //Segmentation meta data
//         uniqueId : Number, //Date.Now
//         filters : Array,

//         selectedBehavior : Object,
//         selectedEvent : { name : String, value : String},
//         selectedFrequency : { value : Number, equation : String},
//         selectedPeriod : Object
//         visibles: {
//             userActions: Boolean,
//             events: Boolean,
//             timeAndFrequency: Boolean
//         }
//     }]
// }


(function (DrillQueryBuilder, $) {
    //step model {type: "did", event: "Buy", period: "30days", query: "{}", byVal: ""}
    //Components
    var timePeriodSelect = {
        template: '#cly-time-period-template',
        props: {
            onChanged: { type: Function, required: true },
            selectedPeriod: { required: true },
            periods: { required: true },
            labels: { required: true }
        },
        data: function () {
            return {
                isCustomPanelVisible: false,
                customValue: 10,
            }
        },
        methods: {
            isNumber: function (evt) {
                evt = (evt) ? evt : window.event;
                var charCode = (evt.which) ? evt.which : evt.keyCode;
                if ((charCode > 31 && (charCode < 48 || charCode > 57)) && charCode !== 46) {
                    evt.preventDefault();;
                } else {
                    return true;
                }
            },
            setClyValues: function (period) {
                $(this.$refs['cly-time-period']).clySelectSetSelection(period.value, period.longName);
                $(this.$refs['cly-time-period']).removeClass('active');
                $(this.$refs.items).hide();
                this.onChanged(period);
            },
            onItemSelect: function (period) {
                this.setClyValues(period);
            },
            onApply: function () {
                if (this.isDisabled) return;
                this.isCustomPanelVisible = false;
                var nameString = 'drill.in-last-days' + (this.customValue > 1 ? '-plural' : '');
                var period = {
                    value: this.customValue,
                    valueAsString: this.customValue + 'days',
                    name: jQuery.i18n.prop(nameString, this.customValue),
                    longName: jQuery.i18n.prop(nameString, this.customValue)
                }
                this.setClyValues(period);
            }
        },
        mounted: function () {
            if (this.selectedPeriod) {
                this.customValue = this.selectedPeriod.value;
                this.setClyValues(this.selectedPeriod);
            }
        },
        computed: {
            isDisabled: function () {
                return this.customValue < 1;
            }
        }
    }

    var frequencySelect = {
        template: '#cly-frequency-template',
        props: {
            onChanged: { type: Function, required: true },
            selectedFrequency: { required: true },
            frequencies: { required: true },
            labels: { required: true }
        },
        data: function () {
            return {
                tempSelectedItem: {
                    value: 1,
                    equation: '$gte',
                    minValue: 1
                }
            }
        },
        methods: {
            setClyValues: function (value, equation) {
                var text = jQuery.i18n.prop("drill." + equation + "-message" + (value > 1 ? "-plural" : ""), value);
                $(this.$refs['cly-frequency']).clySelectSetSelection(equation, text);
                $(this.$refs['cly-frequency']).removeClass('active');
                $(this.$refs.items).hide();
            },
            itemOnSelect: function (item) {
                this.tempSelectedItem.equation = item.equation;
                this.tempSelectedItem.value = this.tempSelectedItem.value < item.minValue ? item.minValue : this.tempSelectedItem.value;
                this.tempSelectedItem.minValue = item.minValue;
            },
            isNumber: function (evt) {
                evt = (evt) ? evt : window.event;
                var charCode = (evt.which) ? evt.which : evt.keyCode;
                if ((charCode > 31 && (charCode < 48 || charCode > 57)) && charCode !== 46) {
                    evt.preventDefault();;
                } else {
                    return true;
                }
            },
            applyValue: function () {
                if (this.isApplyDisabled) return;

                var value = parseInt(this.tempSelectedItem.value);
                this.onChanged({ value: value, equation: this.tempSelectedItem.equation });
                this.setClyValues(value, this.tempSelectedItem.equation);
            }
        },
        mounted: function () {
            if (this.selectedFrequency) {
                this.tempSelectedItem = {
                    value: this.selectedFrequency.value,
                    equation: this.selectedFrequency.equation
                }
                this.setClyValues(this.selectedFrequency.value, this.selectedFrequency.equation);
            }
        },
        computed: {
            minValueAlert: function () {
                return jQuery.i18n.prop('drill.minimum-value-alert', this.tempSelectedItem.minValue)
            },
            isApplyDisabled: function () {
                return this.tempSelectedItem.value < this.tempSelectedItem.minValue
            }
        }
    }

    // <segmentation-filter></segmentation-filter>
    var segmentationFilter = {
        template: "#segmentation-filter-template",
        props: ['step', 'filter'],
        components: {
            'cly-select': CountlyVueComponents.selectList,
            'cly-input': CountlyVueComponents.input,
            'cly-datepicker': CountlyVueComponents.datePicker
        },
        data: function () {
            return {
                state: 'filter',
                tOut: null,
                model: this.$parent.model
            }
        },
        methods: {
            setQueryText : function(){
                var newText = '';
                if((this.filter.propertyModel.selectedItem && this.filter.propertyModel.selectedItem.name) &&
                    (this.filter.equationModel.selectedItem && this.filter.equationModel.selectedItem.value) &&
                    (this.filter.targetModel.selectedItem && (this.filter.targetModel.selectedItem.name || this.filter.targetModel.selectedItem.text))){

                    var name = this.filter.propertyModel.selectedItem.name;
                    var equation = this.filter.equationModel.selectedItem.value;
                    var target = this.filter.targetModel.selectedItem.name || this.filter.targetModel.selectedItem.text;

                    if(this.filter.propertyModel.selectedItem.type === "d"){
                        target = countlyCommon.formatDate(moment(target*1000),"DD MMMM, YYYY");
                    }

                    if(this.filter.andOrModel && this.filter.andOrModel.selectedItem && this.filter.andOrModel.selectedItem.name){
                        newText = 'drill.' + this.filter.andOrModel.selectedItem.value + '|';
                    }
                    newText += name + ' ' + equation + ' ' + target;
                    this.filter.queryText = newText;
                }
            },
            onUndo: function () {
                if (this.tOut) {
                    clearTimeout(this.tOut);
                    this.state = 'filter';
                    this.filter.isRemoved = false;
                    this.$parent.$parent.$parent.$emit('query_changed');
                }
            },
            removeFilter: function (e) {
                e.preventDefault();
                var self = this;
                this.state = 'undo';
                this.filter.isRemoved = true;
                this.$parent.$parent.$parent.$emit('query_changed');

                this.tOut = setTimeout(function () {
                    self.step.filters.splice(self.step.filters.indexOf(self.filter), 1);
                }, 2000)
            },
            onPropertySelect: function (item) {
                this.filter.propertyModel.selectedItem = item;

                var defaultEquation = item.type === "d" ? ">=" : "=";
                this.filter.equationModel.selectedItem = this.filter.equationModel.items.find(function (filter) { return filter.value === defaultEquation });

                if (item.type === "d") {
                    this.filter.targetModel.maxDate = (defaultEquation === ">=") ? moment().subtract(1, 'days').toDate() : moment().add(1, 'days').toDate();
                }

                //Set selected event for segmentation filter if it's different than selected event
                var self = this;
                if (this.step.selectedEvent.value !== countlySegmentation.getEvent()) {
                    countlySegmentation.initialize(this.step.selectedEvent.value).then(function () {
                        setFilterTarget(self.step, self.filter, null, self.model, function(){
                            self.setQueryText();
                        });
                    })
                } else {
                    setFilterTarget(this.step, this.filter, null, self.model, function(){
                        self.setQueryText();
                    });
                }
            },
            onEquationSelect: function (item) {
                this.filter.equationModel.selectedItem = item;
                if (this.filter.propertyModel.selectedItem && this.filter.propertyModel.selectedItem.type === "d") {
                    this.filter.targetModel.maxDate = (this.filter.equationModel.selectedItem.value === ">=") ? moment().subtract(1, 'days').toDate() : moment().add(1, 'days').toDate();
                }
                this.setQueryText();
            },
            onTargetValueChanged: function (e) {
                if (e.type === 'inputnumber' || e.type === 'inputtext' || e.type === 'datepicker') {
                    this.filter.targetModel.selectedItem = { value: e.value, text: e.value };
                }
                else {
                    this.filter.targetModel.selectedItem = this.filter.targetModel.items.find(function (item) { return item.value === e.value });
                }
                this.setQueryText();
            },
            onFilterSearch: function (key) {
                var self = this;

                //Set selected event for segmentation filter if it's different than selected event
                if (this.step.selectedEvent.value !== countlySegmentation.getEvent()) {
                    countlySegmentation.initialize(this.step.selectedEvent.value).then(function () {
                        countlySegmentation.getBigListMetaData(
                            self.filter.propertyModel.selectedItem.value,
                            key,
                            setTargetModelItems.bind(this, self.filter, null)
                        );
                    })
                } else {
                    countlySegmentation.getBigListMetaData(
                        this.filter.propertyModel.selectedItem.value,
                        key,
                        setTargetModelItems.bind(this, this.filter, null)
                    );
                }
            },
            onAndOrSelect: function (item) {
                this.filter.andOrModel.selectedItem = item;
                this.filter.propertyModel.selectedItem = null;
                this.filter.targetModel.selectedItem = { value: null, name: null };
                this.filter.equationModel.selectedItem = this.filter.equationModel.items.find(function (filter) { return filter.value === "=" });
            }
        },
        computed: {
            equationFilters: function () {
                if (!this.filter.propertyModel.selectedItem)
                    return this.filter.equationModel.items;
                else {

                    var currentFilter = this.filter;
                    var isRegexAllowed = countlySegmentation.isFieldRegexable(this.filter.propertyModel.selectedItem.value, this.filter.propertyModel.selectedItem.type);
                    if (isRegexAllowed) {
                      // iterate through to check if the field is in use
                      this.step.filters.forEach(function(otherFilter){
                         var a = otherFilter.propertyModel;
                         var b = currentFilter.propertyModel;
                         if (a.selectedItem && a.selectedItem.value == b.selectedItem.value && otherFilter.order != currentFilter.order){
                           isRegexAllowed = false;
                         }
                      });
                    }

                    var selectedType = this.filter.propertyModel.selectedItem.type;
                    return this.filter.equationModel.items.filter(function (filter) {
                      if (filter.value === "contains"){
                        return isRegexAllowed;
                      }
                      return filter.dataTypes.includes(selectedType)
                    });
                }
            },
            propertyItems: function () {
                var filter = this.filter;
                var regexFields = [];
                this.step.filters.forEach(function(otherFilter){
                  if (otherFilter.propertyModel.selectedItem && otherFilter.equationModel.selectedItem.value === "contains"){
                    regexFields.push(otherFilter.propertyModel.selectedItem.value);
                  }
                });
                return filter.propertyModel.items.filter(function (item) {
                    if (!filter.andOrModel)
                        return true;
                    if (regexFields.indexOf(item.value)!=-1){
                      return false;
                    }
                    if (filter.andOrModel.selectedItem.value === "and")
                        return filter.andOrModel.prevSelectedProperty.value !== item.value;
                    else
                        return filter.andOrModel.prevSelectedProperty.value === item.value;
                })
            },
            isDisabled: function () {
                var indexOf = this.step.filters.indexOf(this.filter);
                var numberOfFilter = this.step.filters.length;
                return (numberOfFilter - 1) !== indexOf;
            }
        },
        mounted: function(){
            this.setQueryText();
        }
    };

    // <segmentational-row></segmentational-row>
    var segmentationRow = {
        components: { 'segmentation-filter': segmentationFilter },
        props: ['step', 'customModel'],
        data: function () {
            return {
                model: this.$parent.model
            }
        },
        methods: {
            addSegmentation: function (e) {
                e.preventDefault();
                addSegmentation(this.step, this.model);
            }
        },
        computed: {
            addSegmentationStatus: function () {
                if(this.model.isUserSegmentation) return true;

                var builderType = this.model.queryBuilderType;
                if (builderType === "cohorts" && this.step.selectedEvent && this.step.selectedBehavior && this.step.selectedPeriod) {
                    return true;
                } else if (builderType === "funnels" && this.step.selectedEvent) {
                    return true;
                }
                return false;
            }
        }
    };

    // <conditional-range-row></conditional-range-row>
    var conditionRangeRow = {
        props: ['onRemoveStep', 'step'],
        components: {
            "cly-select": CountlyVueComponents.selectList,
            "cly-frequency": frequencySelect,
            "cly-time-period": timePeriodSelect
        },
        mounted: function () {
            if (this.step.selectedPerformed && typeof this.step.selectedPerformed === 'string') {
                var self = this;
                self.step.selectedPerformed = self.userActionItems.find(function (item) { return item.value === self.step.selectedPerformed })

            }
            if (this.step.selectedFrequency && typeof this.step.selectedFrequency === 'string') {
                this.step.selectedFrequency = JSON.parse(this.step.selectedFrequency);
            }

            this.$forceUpdate();
        },
        data: function () {
            return {
                model: this.$parent.model
            }
        },
        computed: {
            stepName: function () {
                var stepNameKey = this.$parent.$parent.stepNameKey;
                return jQuery.i18n.prop(stepNameKey, this.$parent.$parent.steps.indexOf(this.step) + 1)
            },
            isRemoveVisible: function () {
                return this.$parent.$parent.steps.indexOf(this.step) > 0
            }
        },
        methods: {
            onPerformSelected: function (perform) {
                this.step.selectedBehavior = perform;
                this.step.visibles = { userActions: true, events: true, timeAndFrequency: true }
            },
            onEventSelected: function (event) {
                var self = this;
                countlySegmentation.initialize(event.value).then(function (json) {
                    self.step.selectedEvent = event;
                    self.step.segmentationMeta = countlySegmentation.getFilters().map(function (filter) { return { value: filter.id, name: filter.name, type: filter.type } });
                    self.model.staticProperties.extend(self.step.segmentationMeta);
                    self.step.filters = [];
                });
            },
            onFrequencySelected: function (frequency) {
                this.step.selectedFrequency = frequency;
            },
            onTimePeriodChanged: function (period) {
                this.step.selectedPeriod = period;
            }
        }
    };

    // <step-row></step-row>
    var stepRow = {
        props: ['step'],
        data: function () { return { state: 'step', tOut: null, model: this.$parent } },
        components: {
            "conditional-range-row": conditionRangeRow,
            "segmentational-row": segmentationRow
        },
        computed: {
            isThenVisible: function () {
                return this.$parent.steps.indexOf(this.step) < (this.$parent.steps.length - 1);
            }
        },
        methods: {
            removeStep: function () {
                this.state = 'undo';
                this.step.isRemoved = true;
                this.$parent.$emit('query_changed');
                var self = this;
                this.tOut = setTimeout(function () {
                    self.$parent.steps.splice(self.$parent.steps.indexOf(self.step), 1);
                }, 2000)
            },
            onUndo: function () {
                if (this.tOut) {
                    clearTimeout(this.tOut);
                    this.state = 'step';
                    this.step.isRemoved = false;
                    this.$parent.$emit('query_changed');
                }
            }
        },
        watch: {
            'step.filters': {
                handler: function (val, newOne) {
                    if (newOne[0]) {
                        newOne[0].andOrModel = null;
                    }
                }
            }
        }
    };

    var userSegmentationStepRow = {
        components: { "segmentational-row" : segmentationRow, "segmentation-filter" :  segmentationFilter},
        props : ['step'],
        data : function(){
            return { model: this.$parent}
        }
    }

    //Public functions


    DrillQueryBuilder.queryBuilder = {
        template: '#user-behaviour-segmentation-template',
        components: { 'step-row': stepRow },
        props: { 'headerTextKey': { required: true }, 'stepNameKey': { required: true }, 'eventList': { required: true }, 'builderType': { default: 'funnels' } },
        data: function () {
            return initModel(this.builderType, this.eventList)
        },
        methods: {
            addCondition: function () {
                for (var i = 0; i < this.steps.length; i++) {
                    var step = this.steps[i];
                    if (!step.selectedEvent) {
                        return;
                    };

                    if (this.queryBuilderType === "cohorts" && (!step.selectedBehavior || !step.selectedPeriod))
                        return;

                    for (var x = 0; x < step.filters.length; x++) {
                        var filter = step.filters[x];
                        if (!filter.propertyModel.selectedItem || !filter.targetModel.selectedItem || !filter.targetModel.selectedItem.value)
                            return;
                    }
                }
                this.steps.push(newStep(this.queryBuilderType))
            },
            getQuery: function () {
                var steps = this.steps.filter(function (step) { 
                    return !step.isRemoved && step.selectedEvent !== null || step.selectedBehavior !== null || step.selectedPeriod !== null
                }).map(function (step) {
                    var res = {
                        type: step.selectedBehavior ? step.selectedBehavior.value : "",
                        event: step.selectedEvent.value,
                        times: {},
                        period: step.selectedPeriod ? step.selectedPeriod.valueAsString : "",
                        query: {},
                        queryText:"",
                        byVal: ""
                    };

                    if (step.selectedFrequency)
                        res.times[step.selectedFrequency.equation] = step.selectedFrequency.value;

                    // step.filters.filter(function (filter) { return !filter.isRemoved }).forEach(function (filter) {
                    //     var property = filter.propertyModel.selectedItem.value;
                    //     var equation = switchEquationTextToVal(filter.equationModel.selectedItem.value);
                    //     res.query[property] = res.query[property] || {};
                    //     res.queryText += filter.queryText + " ";

                    //     if (filter.equationModel.selectedItem.value === "=" || filter.equationModel.selectedItem.value === "!=") {
                    //         res.query[property][equation] = res.query[property][equation] || [];
                    //         res.query[property][equation].push(filter.targetModel.selectedItem.value)
                    //     } else if (filter.equationModel.selectedItem.value === "contains") {
                    //         res.query[property][equation] = [filter.targetModel.selectedItem.value];
                    //     } else {
                    //         res.query[property][equation] = filter.targetModel.selectedItem.value;
                    //     }
                    // });
                    // res.queryText = res.queryText.trim();
                    var queryModel = createQueryFromFilters(step.filters);
                    res.query = queryModel.query;
                    res.queryText = queryModel.queryText;
                    return res;
                })
                return steps;
            },
            setModel: function (selectedQuery, callback) {
                var self = this;
                this.steps = [];
                var newSteps = [];
                if (!selectedQuery) {
                    var step = newStep(this.builderType);
                    newSteps = [step];
                    setTimeout(function () {
                        self.steps = newSteps;
                        callback();
                    }, 0);
                } else {
                    setStepsFromData(0, this.builderType, newSteps, selectedQuery, this.events, function () {
                        self.steps = newSteps;
                        callback();
                    })
                }


            }
        },
        watch: {
            steps: {
                handler: function (val, newOne) {
                    this.$emit('query_changed');
                },
                deep: true
            }
        },
        computed: {
            headerText: function () { return jQuery.i18n.map[this.headerTextKey] },
            addConditionIsDisabled : function () {
                if (this.queryBuilderType !== "funnels")
                    return false;
                var limit = countlyGlobal.funnel_step_limit || 8;
                return this.steps.length >= limit
            }
        }
    };

    DrillQueryBuilder.userProperties = {
        template: '#user-property-segmentation-template',
        components: { "user-segmentation-step" : userSegmentationStepRow},
        computed : {
            headerText : function(){ return "USER PROPERTY SEGMENTATION"}
        },
        data : function(){
            var step = newStep("cohorts");
            step.selectedEvent = { value : '', segmentationMeta:[]}

            return {
                queryBuilderType: "cohorts",
                labels: {
                    whicHas: jQuery.i18n.map['drill.which-has'],
                    addSegmentation: jQuery.i18n.map['drill.add-property']
                },
                step: step,
                equations: [
                { name: jQuery.i18n.map['drill.opr.greater-than'], value: '>',  dataTypes: ['s', 'n', 'd'] },
                { name: jQuery.i18n.map['drill.opr.at-least'],     value: '>=', dataTypes: ['s', 'n', 'd'] },
                { name: jQuery.i18n.map['drill.opr.less-than'],    value: '<', dataTypes: ['s', 'n', 'd'] },
                { name: jQuery.i18n.map['drill.opr.at-most'],  value: '<=', dataTypes: ['s', 'n', 'd'] },
                { name: jQuery.i18n.map['drill.opr.is'],    value: '=', dataTypes: ['s', 'n', 'l', 'bl'] },
                { name: jQuery.i18n.map['drill.opr.is-not'], value: '!=', dataTypes: ['s', 'n', 'l', 'bl'] },
                { name: jQuery.i18n.map['drill.opr.contains'],     value: 'contains', dataTypes: ['s', 'l', 'bl'] }],
                andOrItems: [{ name: jQuery.i18n.map['drill.and'], value: 'and' }, { name: jQuery.i18n.map['drill.or'], value: 'or' }],
                isUserSegmentation: true,
                staticProperties: new StaticPropertyManager("user-properties")
            }
        },
        methods : {
            initMeta : function(){
                var self = this;
                countlySegmentation.initialize("").then(function (json) {
                    self.step.segmentationMeta = countlySegmentation.getFilters().map(function (filter) { return { value: filter.id, name: filter.name, type: filter.type } });
                    // self.step.filters.push(self.newFilter(true));
                    self.staticProperties.extend(self.step.segmentationMeta);
                    addSegmentation(self.step, self);
                });
            },
            getQuery: function(){
                var self = this;
                var res = {};
                var queryModel = createQueryFromFilters(this.step.filters);
                res.query = queryModel.query;
                res.queryText = queryModel.queryText;
                for(var key in queryModel.query){
                    self.staticProperties.emitSave(key, queryModel.query[key], res);
                }
                return res;
            },
            setModel: function (selectedQuery, callback) {
                var self = this;

                this.step = newStep("cohorts");
                this.step.selectedEvent = { value : '', segmentationMeta:[]}
                countlySegmentation.initialize("").then(function (json) {
                    self.step.segmentationMeta = countlySegmentation.getFilters().map(function (filter) { return { value: filter.id, name: filter.name, type: filter.type } });
                    self.staticProperties.extend(self.step.segmentationMeta);
                    if (!selectedQuery) {
                        addSegmentation(self.step, self);
                        callback();
                    } else {
                        if(!selectedQuery.user_segmentation || !selectedQuery.user_segmentation.query){
                            addSegmentation(self.step, self);
                            callback();
                            return;
                        }
                        var userSegmentation = selectedQuery.user_segmentation;
                        var query = userSegmentation.query;

                        if(typeof query === 'string'){
                            query = CountlyHelpers.isJSON(query) ? JSON.parse(query) : {};
                        }
                        var filterQueries = getFilterArray(query);
                        filterQueries = self.staticProperties.checkValues(filterQueries);
                        setSegmentationForFilterQueries(0, filterQueries, self.step, self, callback);
                    } 
                });

            }
        },
        mounted: function(){
            this.initMeta();
        },watch: {
            step: {
                handler: function (val, newOne) {
                    this.$emit('query_changed');
                },
                deep: true
            }
        }
    }

    //Private Functions
    function setFilterTarget(step, filter, selectedValue, model, callback) {
        if (filter.propertyModel.selectedItem.type === "l") {
            if (model.staticProperties && model.staticProperties.isStatic(filter.propertyModel.selectedItem.value)){
                filter.targetModel.items = model.staticProperties.getStaticFilterPairs(filter.propertyModel.selectedItem.value);
            } else {
                var filterValues = countlySegmentation.getFilterValues(filter.propertyModel.selectedItem.value);
                var filterNames = countlySegmentation.getFilterNames(filter.propertyModel.selectedItem.value);
                filter.targetModel.items = filterValues.reduce(function (list, value, index) {
                    list.push({
                        name: filterNames[index],
                        value: value
                    });
                    return list;
                }, []);
            }
            
	        if (filter.equationModel.selectedItem.value!="contains") {
                filter.targetModel.selectedItem = selectedValue ? filter.targetModel.items.find(function (item) { return item.value === selectedValue }) : { value: null, text: null };
            } else {
                filter.targetModel.selectedItem = { value: selectedValue || null, text: selectedValue || null };
            }
            callback();
        } else if (filter.equationModel.selectedItem.value!="contains" && filter.propertyModel.selectedItem.type === "bl") {
            countlySegmentation.getBigListMetaData(filter.propertyModel.selectedItem.value, null, function(values, names){
                if(!selectedValue || values.indexOf(selectedValue) >= 0){
                    setTargetModelItems(filter, selectedValue, values, names)
                }else{
                    countlySegmentation.getBigListMetaData(filter.propertyModel.selectedItem.value, selectedValue, function(searchValues, searchNames){
                        setTargetModelItems(filter, selectedValue, values.concat(searchValues), names.concat(searchNames));
                    })
                }
                callback();
            });
        } else {
            filter.targetModel.selectedItem = { value: selectedValue || null, text: selectedValue || null };
            callback();
        }
    };

    function addSegmentation(step, model, selectedProperty, selectedEquation, selectedValue, callback) {
        var prevSelectedProperty = null;
        if (step.filters.length > 0) {
            var prevFilter = step.filters[step.filters.length - 1];
            if ((prevFilter.propertyModel.selectedItem && !prevFilter.propertyModel.selectedItem.value) || (prevFilter.targetModel && !prevFilter.targetModel.selectedItem.value))
                return;

            prevSelectedProperty = prevFilter.propertyModel.selectedItem;
        }

        selectedEquation = selectedEquation ? switchEquationValToText(selectedEquation) : "=";
        var previousHasRegex = step.filters.length > 0 && prevFilter.equationModel.selectedItem.value == "contains";

        var followingAndOrModel = null;
        if (step.filters.length > 0) {
          if (!previousHasRegex) {
            followingAndOrModel = {
               items: model.andOrItems,
               selectedItem: prevSelectedProperty.value === selectedProperty ? model.andOrItems[1] : model.andOrItems[0],
               prevSelectedProperty: prevSelectedProperty
            }
          } else {
            followingAndOrModel = {
              items: [model.andOrItems[0]],
              selectedItem: model.andOrItems[0],
              prevSelectedProperty: prevSelectedProperty
            }
          }
        }
        var filter = {
            propertyModel: {
                placeholder: jQuery.i18n.map['drill.select-property'],
                items: step.segmentationMeta,
                selectedItem: selectedProperty ? step.segmentationMeta.find(function (item) { return item.value === selectedProperty }) : null
            },
            equationModel: {
                items: model.equations,
                selectedItem: model.equations.find(function (filter) { return filter.value === selectedEquation })
            },
            targetModel: {
                items: [],
                selectedItem: { value: null, text: null }
            },
            andOrModel: followingAndOrModel,
            order: step.filters.length,
            queryText : "",
            hideRemoveFilter: model.isUserSegmentation && step.filters.length < 1
        };

        if (filter.propertyModel.selectedItem) {
            setFilterTarget(step, filter, selectedValue, model, function(){
                step.filters.push(filter);
                callback();
                // if(callback){
                //     callback();
                // }
            });
        }else{
            step.filters.push(filter);
            if(callback){
                callback();
            }
        }

        
    };

    function switchEquationTextToVal(text) {
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
            case "contains":
                return "rgxcn";
        }
    };

    function switchEquationValToText(val) {
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
            case "rgxcn":
                return "contains";
        }
    };

    function setTargetModelItems(filter, selectedValue, newValues, newNames) {
        filter.targetModel.items = newValues.reduce(function (list, value, index) {
            list.push({
                name: newNames[index],
                value: value
            });
            return list;
        }, []);
        filter.targetModel.selectedItem = selectedValue ? filter.targetModel.items.find(function (item) { return item.value === selectedValue }) : { value: null, text: null };
    };

    function setStepsFromData(index, queryBuilderType, responseSteps, data, events, callback) {
        if (index === data.steps.length) {            
            callback();
            return;
        }

        var model = DrillQueryBuilder.queryBuilder.data();
        var currentStep = data.steps[index];
        var currentQuery = currentStep.query;

        if (typeof currentQuery === "string") {
            try {
                currentQuery = JSON.parse(currentQuery)
            } catch (error) {
                console.error('Unknown json format');
                callback();
                return;
            }
        }

        if(typeof currentStep.event !== "string"){
            currentStep.event = currentStep.event.event;
        }

        countlySegmentation.initialize(currentStep.event).then(function (json) {
            
            var step = newStep(queryBuilderType);
            if (queryBuilderType === "cohorts") {
                step.visibles = { userActions: true, events: true, timeAndFrequency: true }
            }
            step.selectedBehavior = model.behaviors.find(function (item) { return item.value === currentStep.type });
            step.selectedEvent = events.find(function (item) { return item.value === currentStep.event });
            step.selectedPeriod = model.periods.find(function (item) { return item.valueAsString === currentStep.period });

            if (currentStep.period && currentStep.period.length > 0 && !step.selectedPeriod) { //Custom period
                var value = parseInt((currentStep.period.replace('days', '')));
                var nameString = 'drill.in-last-days' + (value > 1 ? '-plural' : '');
                step.selectedPeriod = {
                    value: value,
                    valueAsString: value + "days",
                    name: jQuery.i18n.prop(nameString, value),
                    longName: jQuery.i18n.prop(nameString, value)
                }
            }

            step.segmentationMeta = countlySegmentation.getFilters().map(function (filter) { return { value: filter.id, name: filter.name, type: filter.type } });
            model.staticProperties.extend(step.segmentationMeta);
            var times = null;
            try {
                times = JSON.parse(currentStep.times);
            } catch (error) { }

            step.selectedFrequency = (times && !_.isEmpty(times)) ? { value: times[Object.keys(times)[0]], equation: Object.keys(times)[0] } : null;

            // Object.keys(currentQuery).forEach(function (key) {
            //     var selectedProperty = key;

            //     Object.keys(currentQuery[key]).forEach(function (subKey) {
            //         var selectedEquation = subKey;

            //         if (Array.isArray(currentQuery[key][subKey])) {
            //             currentQuery[key][subKey].forEach(function (value) {
            //                 var selectedValue = value;
            //                 addSegmentation(step, model, selectedProperty, selectedEquation, selectedValue);
            //             })
            //         } else {
            //             var selectedValue = currentQuery[key][subKey];
            //             addSegmentation(step, model, selectedProperty, selectedEquation, selectedValue);
            //         }

            //     })
            // });

            var filterQueries = getFilterArray(currentQuery);
            setSegmentationForFilterQueries(0, filterQueries, step, model, function(){
                responseSteps.push(step);
                setStepsFromData(index + 1, queryBuilderType, responseSteps, data, events, callback);
            });
        });
    };

    function createQueryFromFilters(filters){
        var query = {};
        var queryText = "";

        filters.filter(function (filter) { return !filter.isRemoved }).forEach(function (filter) {
            if (!filter.propertyModel.selectedItem) {
                return;
            }
            var property = filter.propertyModel.selectedItem.value;
            var equation = switchEquationTextToVal(filter.equationModel.selectedItem.value);
            query[property] = query[property] || {};
            queryText += filter.queryText + " ";

            if (filter.equationModel.selectedItem.value === "=" || filter.equationModel.selectedItem.value === "!=") {
                query[property][equation] = query[property][equation] || [];
                query[property][equation].push(filter.targetModel.selectedItem.value)
            } else if (filter.equationModel.selectedItem.value === "contains") {
                query[property][equation] = [filter.targetModel.selectedItem.value];
            } else {
                query[property][equation] = filter.targetModel.selectedItem.value;
            }
        });
        queryText = queryText.trim();

        return {
            query: query,
            queryText: queryText
        };
    };

    function getFilterArray(query){
        var result = [];
        Object.keys(query).forEach(function (key) {
            var selectedProperty = key;
            Object.keys(query[key]).forEach(function (subKey) {
                var selectedEquation = subKey;
                if (Array.isArray(query[key][subKey])) {
                    query[key][subKey].forEach(function (value) {
                        var selectedValue = value;
                        result.push({selectedProperty : selectedProperty, selectedEquation : selectedEquation, selectedValue : selectedValue})
                    })
                } else {
                    var selectedValue = query[key][subKey];
                    result.push({selectedProperty : selectedProperty, selectedEquation : selectedEquation, selectedValue : selectedValue})
                }

            })
        });

        return result;
    }

    function setSegmentationForFilterQueries(index, queries, step, model, callback){
        if(index === queries.length){
            callback();
            return;
        }

        var query = queries[index];   
        addSegmentation(step, model, query.selectedProperty, query.selectedEquation, query.selectedValue, function(){
            setSegmentationForFilterQueries(index + 1, queries, step, model, callback);
        })
    }


    //Model builder factory.
    function initModel(queryType, events) {
        return {
            queryBuilderType: queryType,
            labels: {
                addCondition: queryType === 'funnels' ? jQuery.i18n.map['drill.add-step'] : jQuery.i18n.map['drill.add-condition'],
                thenText: jQuery.i18n.map['drill.and'],
                selectActionPlaceHolder: jQuery.i18n.map['drill.select-property'],
                selectPerformPlaceholder: jQuery.i18n.map['cohorts.select-behavior-type'],
                addSegmentation: jQuery.i18n.map['drill.add-property'],
                whicHas: jQuery.i18n.map['drill.which-has'],
                removeRow: jQuery.i18n.map['drill.remove-row'],
                defineFrequency: jQuery.i18n.map['cohorts.select-frequency'],
                numberOfItems: jQuery.i18n.map['cohorts.number-of-times'],
                apply: jQuery.i18n.map['drill.apply-only'],
                timeRange: jQuery.i18n.map['cohorts.select-time-range'],
                customRange: jQuery.i18n.map['cohorts.custom-range'],
                back: jQuery.i18n.map['cohorts.back'],
                numberOfDays: jQuery.i18n.map['cohorts.number-of-days']
            },
            behaviors: [
                { name: jQuery.i18n.map['cohorts.performed-event'], value: 'did' },
                { name: jQuery.i18n.map['cohorts.not-perform-event'], value: "didnot" }
            ],
            events: events,
            frequencies: [
                { name: jQuery.i18n.map['drill.at-least'], equation: '$gte', minValue : 1 },
                { name: jQuery.i18n.map['drill.equal-to'], equation: '$eq', minValue : 1 },
                { name: jQuery.i18n.map['drill.at-most'], equation: '$lte', minValue : 2 }
            ],
            periods: [
                { name: jQuery.i18n.prop('drill.days', 7), value: 7, valueAsString: "7days", longName: jQuery.i18n.prop('drill.in-last-days-plural', 7) },
                { name: jQuery.i18n.prop('drill.days', 14), value: 14, valueAsString: "14days", longName: jQuery.i18n.prop('drill.in-last-days-plural', 14) },
                { name: jQuery.i18n.prop('drill.days', 30), value: 30, valueAsString: "30days", longName: jQuery.i18n.prop('drill.in-last-days-plural', 30) },
                { name: jQuery.i18n.map['drill.all-time'], value: 0, valueAsString: "0days", longName: jQuery.i18n.map['drill.all-time'] }
            ],
            equations: [
            { name: jQuery.i18n.map['drill.opr.greater-than'], value: '>', dataTypes: ['s', 'n', 'd'] },
            { name: jQuery.i18n.map['drill.opr.at-least'],     value: '>=', dataTypes: ['s', 'n', 'd'] },
            { name: jQuery.i18n.map['drill.opr.less-than'],    value: '<', dataTypes: ['s', 'n', 'd'] },
            { name: jQuery.i18n.map['drill.opr.at-most'],      value: '<=', dataTypes: ['s', 'n', 'd'] },
            { name: jQuery.i18n.map['drill.opr.is'],           value: '=', dataTypes: ['s', 'n', 'l', 'bl'] },
            { name: jQuery.i18n.map['drill.opr.is-not'],       value: '!=', dataTypes: ['s', 'n', 'l', 'bl'] },
            { name: jQuery.i18n.map['drill.opr.contains'],     value: 'contains', dataTypes: ['s', 'l', 'bl'] }],
            andOrItems: [{ name: jQuery.i18n.map['drill.and'], value: 'and' }, { name: jQuery.i18n.map['drill.or'], value: 'or' }],
            steps: [],
            staticProperties: new StaticPropertyManager("query-builder")
        }
    };

    //New Step factory.
    function newStep(queryBuilderType) {
        return {
            uniqueId: Date.now(),
            segmentationMeta: {},
            filters: [],
            isRemoved: false,
            selectedBehavior: null,
            selectedEvent: null,
            selectedFrequency: null,
            selectedPeriod: null,

            visibles: {
                userActions: queryBuilderType === "cohorts" ? true : false,
                events: queryBuilderType === "cohorts" ? false : true,
                timeAndFrequency: false
            }
        }
    };

    function StaticPropertyManager(context){
        this.context = context;
        this.properties = {};
    }

    StaticPropertyManager.prototype.setProperty = function(name, value){
        this.properties[name] = value;
        if (value.disableRegex === true) {
            countlySegmentation.disableRegex(name);
        }
    }
    StaticPropertyManager.prototype.setValues = function(name, values){
        if(this.isStatic(name)){
            this.properties[name].values = values;
            this.properties[name].allowedValues = values.reduce(function (map, value, index) {
                map[value.value] = true;
                return map;
            }, {});
        }
    }

    StaticPropertyManager.prototype.getStaticFilterPairs = function(name){
        return this.properties[name].values;
    }

    StaticPropertyManager.prototype.extend = function(list){
        for(var key in this.properties) {
            var property = this.properties[key];
            if (property.listEntry.type !== "l" || (property.listEntry.type === "l" && (property.values && property.values.length>0))){
                if (property.order) {
                    list.splice(property.order, 0, property.listEntry);
                } else {
                    var numberOfHeaders = 0;
                    var insertTo = 0;
                    for(var i = 0; i < list.length && numberOfHeaders!=2; i++, insertTo++){
                        if (!list[i].value) {
                            numberOfHeaders++;
                        }
                    }
                    if(numberOfHeaders==2){
                        list.splice(insertTo-1, 0, property.listEntry);
                    } else {
                        list.push(property.listEntry);
                    }
                }
            }
        }
    }

    StaticPropertyManager.prototype.isStatic = function(name){
        return Object.keys(this.properties).indexOf(name) != -1;
    }

    StaticPropertyManager.prototype.checkValues = function(rows){
        var edited = [];
        var self = this;
        rows.forEach(function(row){
            var key = row.selectedProperty;
            var add = true;
            if (self.isStatic(key)){
                var property = self.properties[key];
                var value = row.selectedValue;
                if (property.allowedValues) {                  
                    add = !!property.allowedValues[value];
                }
            }
            if(add) {
                edited.push(row);
            }
        });
        return edited;
    }

    StaticPropertyManager.prototype.emitSave = function(key, value, writeObject){
        if (this.isStatic(key)){
            var property = this.properties[key];
            if (property.events && property.events.onSave){
                property.events.onSave(value, writeObject);
            }
        }   
    }

}(window.DrillQueryBuilder = window.DrillQueryBuilder || {}, jQuery));
