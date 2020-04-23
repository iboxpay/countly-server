var plugin = {},
    common = require('../../../api/utils/common.js'),
    plugins = require('../../pluginManager.js');

(function() {
    //write api call
    plugins.register("/i", function(ob) {
        
    });

    //read api call
    plugins.register("/o", function(ob){
        var obParams = ob.params;
        var validateUserForDataReadAPI = ob.validateUserForDataReadAPI;
        if (obParams.qstring.method === 'get_cohort_list') {
            let result = {};
            validateUserForDataReadAPI(obParams, function(params){
                common.returnOutput(params, result);
            });
            return true;
        } else if (obParams.qstring.method === 'get_cohorts') {
            let result = [
                {"_id":"7a642cef6e2e721488d418a7080a3491","name":"分享 &amp; 购买","type":"auto","steps":
                [{"type":"did","event":"购买","period":"30天","query":"{}","byVal":""},
                {"type":"did","event":"分享","period":"14天","query":"{}","byVal":""}],
                "user_segmentation":null,"in_process":false,"generated":true,"last_generated":1584334810209,"result":10,"run_time":1480},
                {"_id":"4ed2a28d7f096f4dfbb43f4921e02179","name":"下单 &amp; 支付","type":"auto","steps":
                [{"type":"did","event":"[CLY]_session","times":"{\"$gte\":1}",
                "period":"30天","query":"{\"custom.Login\":{\"$in\":[\"true\"]}}","byVal":""},
                {"type":"didnot","event":"分享","times":"{\"$gte\":1}","period":"0days","query":"{}","byVal":""}],
                "user_segmentation":null,"in_process":false,"generated":true,"last_generated":1584334809828,"result":96,"run_time":1099},
                {"_id":"e38357a3c1161697599a347a949c88f9","name":"用户登录","type":"auto","steps":
                [{"type":"did","event":"[CLY]_session","period":"30天","query":"{\"custom.Login\":{\"$in\":[\"true\"]}}","byVal":""}],
                "user_segmentation":null,"generated":true,"in_process":false,"last_generated":1584334809576,"result":135,"run_time":846},
                {"_id":"aafc9d57bffdb74f3fbe6ddd7332c931","name":"下单 &amp; 支付","type":"auto","steps":
                [{"type":"did","event":"购买","period":"30天","query":"{}","byVal":""},
                {"type":"did","event":"[CLY]_session","period":"20天","query":"{}","byVal":""}],
                "user_segmentation":null,"in_process":false,"generated":true,"last_generated":1584334811974,"result":52,"run_time":1696}];
            validateUserForDataReadAPI(obParams, function(params){
                let loader = params.qstring.display_loader;
                if (!loader) {
                    result = [{"_id":"7a642cef6e2e721488d418a7080a3491","name":"分享 &amp; 购买","type":"auto","steps":
                    [{"type":"did","event":"购买","period":"30天","query":"{}","byVal":""},
                    {"type":"did","event":"分享","period":"14天","query":"{}","byVal":""}],
                    "user_segmentation":null,"in_process":false,"generated":true,"last_generated":1584334810209,"result":10,"run_time":1480},
                    {"_id":"4ed2a28d7f096f4dfbb43f4921e02179","name":"下单 &amp; 支付","type":"auto","steps":
                    [{"type":"did","event":"[CLY]_session","times":"{\"$gte\":1}","period":"30天","query":"{\"custom.Login\":{\"$in\":[\"true\"]}}","byVal":""},
                    {"type":"didnot","event":"分享","times":"{\"$gte\":1}","period":"0天","query":"{}","byVal":""}],
                    "user_segmentation":null,"in_process":false,"generated":true,"last_generated":1584334809828,"result":96,"run_time":1099},
                    {"_id":"e38357a3c1161697599a347a949c88f9","name":"用户登录","type":"auto","steps":
                    [{"type":"did","event":"[CLY]_session","period":"30天","query":"{\"custom.Login\":{\"$in\":[\"true\"]}}","byVal":""}],
                    "user_segmentation":null,"generated":true,"in_process":false,"last_generated":1584334809576,"result":135,"run_time":846},
                    {"_id":"aafc9d57bffdb74f3fbe6ddd7332c931","name":"下单 &amp; 支付","type":"auto","steps":
                    [{"type":"did","event":"购买","period":"30天","query":"{}","byVal":""},
                    {"type":"did","event":"[CLY]_session","period":"20天","query":"{}","byVal":""}],
                    "user_segmentation":null,"in_process":false,"generated":true,"last_generated":1584334811974,"result":52,"run_time":1696}];
                }
                common.returnOutput(params, result);
            });
            return true;
        } else if (obParams.qstring.method === 'cohortdata') {
            let result = [{"_id":"7a642cef6e2e721488d418a7080a3491",
                "data":{"2020":{"3":{"9":{"11":{"i":24},"i":24},
                "10":{"9":{"o":2},"o":2},"11":{"9":{"o":1},"o":1},
                "12":{"9":{"o":2},"o":2},"13":{"9":{"o":1},"o":1},
                "14":{"9":{"o":2},"o":2},"15":{"9":{"o":4},"o":4},
                "16":{"9":{"o":2},"o":2},"i":24,"o":14},"i":24,"o":14},
                "meta":{}}},{"_id":"4ed2a28d7f096f4dfbb43f4921e02179",
                "data":{"2020":{"3":{"9":{"11":{"i":118},"i":118},
                "10":{"9":{"o":6},"o":6},"11":{"9":{"o":2},"o":2},"12":{"9":{"o":5},"o":5},
                "13":{"9":{"o":2},"o":2},"14":{"9":{"o":4},"o":4},"15":{"9":{"o":1},"o":1},
                "16":{"9":{"o":2},"o":2},"i":118,"o":22},"i":118,"o":22},"meta":{}}},
                {"_id":"e38357a3c1161697599a347a949c88f9","data":{"2020":{"3":{"9":{"11":{"i":165},
                "i":165},"10":{"9":{"o":6},"o":6},"11":{"9":{"o":5},"o":5},"12":{"9":{"o":5},"o":5},
                "13":{"9":{"o":2},"o":2},"14":{"9":{"o":6},"o":6},"15":{"9":{"o":2},"o":2},"16":{"9":{"o":4},
                "o":4},"i":165,"o":30},"i":165,"o":30},"meta":{}}},{"_id":"aafc9d57bffdb74f3fbe6ddd7332c931",
                "data":{"2020":{"3":{"9":{"11":{"i":79},"i":79},"10":{"9":{"o":2},"o":2},"11":{"9":{"o":6},
                "o":6},"12":{"9":{"o":2},"o":2},"13":{"9":{"o":2},"o":2},"14":{"9":{"o":3},"o":3},"15":{"9":{"o":9},
                "o":9},"16":{"9":{"o":3},"o":3},"i":79,"o":27},"i":79,"o":27},"meta":{}}}];
                // let result = "[{\"_id\":\"7a642cef6e2e721488d418a7080a3491\",\"data\":{\"2020\":{\"3\":{\"9\":{\"11\":{\"i\":24},\"i\":24},\"10\":{\"9\":{\"o\":2},\"o\":2},\"11\":{\"9\":{\"o\":1},\"o\":1},\"12\":{\"9\":{\"o\":2},\"o\":2},\"13\":{\"9\":{\"o\":1},\"o\":1},\"14\":{\"9\":{\"o\":2},\"o\":2},\"15\":{\"9\":{\"o\":4},\"o\":4},\"16\":{\"9\":{\"o\":2},\"o\":2},\"i\":24,\"o\":14},\"i\":24,\"o\":14},\"meta\":{}}},{\"_id\":\"4ed2a28d7f096f4dfbb43f4921e02179\",\"data\":{\"2020\":{\"3\":{\"9\":{\"11\":{\"i\":118},\"i\":118},\"10\":{\"9\":{\"o\":6},\"o\":6},\"11\":{\"9\":{\"o\":2},\"o\":2},\"12\":{\"9\":{\"o\":5},\"o\":5},\"13\":{\"9\":{\"o\":2},\"o\":2},\"14\":{\"9\":{\"o\":4},\"o\":4},\"15\":{\"9\":{\"o\":1},\"o\":1},\"16\":{\"9\":{\"o\":2},\"o\":2},\"i\":118,\"o\":22},\"i\":118,\"o\":22},\"meta\":{}}},{\"_id\":\"e38357a3c1161697599a347a949c88f9\",\"data\":{\"2020\":{\"3\":{\"9\":{\"11\":{\"i\":165},\"i\":165},\"10\":{\"9\":{\"o\":6},\"o\":6},\"11\":{\"9\":{\"o\":5},\"o\":5},\"12\":{\"9\":{\"o\":5},\"o\":5},\"13\":{\"9\":{\"o\":2},\"o\":2},\"14\":{\"9\":{\"o\":6},\"o\":6},\"15\":{\"9\":{\"o\":2},\"o\":2},\"16\":{\"9\":{\"o\":4},\"o\":4},\"i\":165,\"o\":30},\"i\":165,\"o\":30},\"meta\":{}}},{\"_id\":\"aafc9d57bffdb74f3fbe6ddd7332c931\",\"data\":{\"2020\":{\"3\":{\"9\":{\"11\":{\"i\":79},\"i\":79},\"10\":{\"9\":{\"o\":2},\"o\":2},\"11\":{\"9\":{\"o\":6},\"o\":6},\"12\":{\"9\":{\"o\":2},\"o\":2},\"13\":{\"9\":{\"o\":2},\"o\":2},\"14\":{\"9\":{\"o\":3},\"o\":3},\"15\":{\"9\":{\"o\":9},\"o\":9},\"16\":{\"9\":{\"o\":3},\"o\":3},\"i\":79,\"o\":27},\"i\":79,\"o\":27},\"meta\":{}}}]";
            validateUserForDataReadAPI(obParams, function(params){
                let cohorts = params.qstring.cohorts;
                if (cohorts === true) {
                    common.returnOutput(params, []);
                }
                common.returnOutput(params, result);
            });
            return true;
        }
    });

    plugins.register("/i/cohorts/add", function(ob){

    });

    plugins.register("/i/cohorts/edit", function(ob){

    });

    plugins.register("/i/cohorts/delete", function(ob){

    });
}(plugin));
module.exports = plugin;
