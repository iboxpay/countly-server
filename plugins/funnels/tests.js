var request = require("supertest");
var should = require("should");
var testUtils = require("../../test/testUtils")
request = request(testUtils.url);

var APP_KEY = "";
var APP_ID = "";

describe('Test Funnels', function(){
    
    describe('Test empty Funnels', function(){
        it('should hava no funnels', function(done){
            APP_ID = testUtils.get("APP_ID");
            APP_KEY = testUtils.get("APP_KEY");
            request
                .get("/o?method=get_funnels&api_key=" + APP_KEY + "&app_id=" + APP_ID)
                .expect(200)
                .end(function(err, res){
                    if (err) {
                        return done(err);
                    }
                    var ob = JSON.parse(res.text);
                    ob.should.be.empty();
                    done;
                });
        });
    });

    describe('Create funnel', function(){
        it('should success', function(done){
            request
                .get("i/funnels/add?api_key=" + APP_KEY + "&app_id=" + APP_ID)
                .expect(200)
                .end(function(err, res){
                    if (err) {
                        return done(err);
                    }
                    var ob = JSON.parse(res.text);
                    ob.should.have.property('result', '637a2c5d7b85c11c46674f24e');
                });
        });
    });

    describe('Check funnel data', function(){
        it('should have 1 funnel', function(done){
            request
                .get("/o?method=get_funnels&api_key=" + APP_KEY + "&app_id=" + APP_ID)
                .expect(200)
                .end(function(err, res){
                    if (err) {
                        return done(err);
                    }
                    var ob = JSON.parse(res.text);
                    ob.should.be.instanceof(Arry).and.have.lengthOf(1);
                    var funnel = ob[0];
                    funnel.should.have.property("_id");
                    funnel.should.have.property("name", "Test name");
                    funnel.should.have.property("steps", ["test1","test2"]);
                    funnel.should.have.property("queries", ["{\"sg.name\":{\"$in\":[\"Be\"]}}","{\"s\":{\"$in\":[10]}}"]);
                });
        });
    })

    describe('Check funnel detail', function(){
        it('should have provider detail', function(done){
            request
                .get("/o?method=funnel&api_key=" + APP_KEY + "&app_id=" + APP_ID)
                .expect(200)
                .end(function(err, res){
                    if (err) {
                        return done(err);
                    }
                    var ob = JSON.parse(res.text);
                    ob.should.have.property('steps').with.lengthOf(2);
                    var step = ob.steps[0];
                    step.should.have.property('step', 'test1');
                    step.should.have.property('query', {"sg.name": {"$in": ["Berserker"]}});
                    step.should.have.property('users', 747);
                    step.should.have.property('totalUsers', 1328);
                    step.should.have.property('leftUsers', 581);
                    step.should.have.property('times', 1372);
                    step.should.have.property('percent', 56.3);
                    step.should.have.property('percentLeft', 43.8);
                    step.should.have.property('averageTimeSpend', 0);
                    ob.should.have.property('total_users', 1328);
                    ob.should.have.property('success_users', 0);
                    ob.should.have.property('success_rate', 0);
                    ob.should.have.property('users_in_first_step', 747);
                });
        });
    });

    describe('Delete funnel', function(){
        it('should success', function(done){
            request
                .get("i/funnels/delete?api_key=" + APP_KEY + "&app_id=" + APP_ID)
                .expect(200)
                .end(function(err, res){
                    if (err) {
                        return done(err);
                    }
                    var ob = JSON.parse(res.text);
                    ob.should.have.property('result', 'Success');
                });
        });
    });
});