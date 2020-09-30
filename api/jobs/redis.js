'use strict';

const job = require('../parts/jobs/job.js'),
    common = require('../utils/common.js'),
    log = require('../utils/log.js')('job:redis');

/** Class for the sync redis meta data to db job **/
class RedisJob extends job.Job {

    /**
     * Redis sync initialize function
     */
    init() {
        log.i("Redis job start...");
        this.getAllApps();
    }

    /**
     * async
     * That initialize function for Redis Job but Its main purpose is to get all the Apps.
     * The errors of all functions will be caught here.
     */
    async getAllApps() {
        try {
            const getAllApps = await new Promise((res, rej) => common.db.collection("apps").find({}, { _id: 1 }).toArray((err, apps) => err ? rej(err) : res(apps)));
            await Promise.all(getAllApps.map((app) => this.getAppMetas(app)));
        }
        catch (error) {
            log.e("Redis Job has a error: ", error);
        }
    }

    /**
     * async
     * getAppMetas function
     * @param {Object} app appMetas object
     */
    async getAppMetas(app) {
        try {
            let collectionName = "drill_meta" + app._id;
            log.d(collectionName);
            const getMetas = await new Promise((res, rej) => common.drillDb.collection(collectionName).find({}, { _id: 1 }).toArray((err, metas) => err ? rej(err) : res(metas)));
            await Promise.all(getMetas.map((meta) => this.getAppMetaKeys(meta, app._id)));
        }
        catch (error) {
            log.e("Redis Job has a error: ", error);
        }
    }

    /**
     * async
     * getAppMetaKeys function
     * @param {Object} meta - appMeta object
     */
    async getAppMetaKeys(meta, appId) {
        let pattern = appId + ":" + meta._id + ":*";
        log.d(pattern);
        let stream = common.redis.scanStream({
            // only returns keys match the special pattern
            match: pattern,
            // returns approximately 10 elements per call
            count: 10,
        });
        
        stream.on("data", function (resultKeys) {
            // Pause the stream from scanning more keys until we've migrated the current keys.
            stream.pause();
            let dbAppId, dbMetaId;
            Promise.all(resultKeys.map((key) => {
                // log.d(key);
                let keys = key.split(":");
                dbAppId = keys[0];
                dbMetaId = keys[1];
                let keyName = keys[2];
                let keyType = keys[3];
                if ('type' === keyType) { // found type
                    common.redis.get(key, function (err, result) {
                        if (result) {
                            let update = {'$set': {}};
                            // log.d(dbMetaId + ":" + keyName + ":" + result);
                            if ("meta_up" === dbMetaId) {
                                update.$set['up.' + keyName + ".type"] = result;
                            } else {
                                update.$set['sg.' + keyName + ".type"] = result;
                            }

                            common.drillDb.collection("drill_meta" + dbAppId).update({'_id': dbMetaId}, update, {'upsert': true}, function() {});
                        }
                    });
                } else { // found values
                    let typeKey = key.replace("values", "type");
                    common.redis.get(typeKey, function(err, type){
                        if (type) {
                            if ("l" === type) { // update db whether type l, otherwise abort
                                common.redis.smembers(key, function(err, result){
                                    if (result) {
                                        let update = {'$set': {}};
                                        log.d(dbMetaId + ":" + keyName + ":" + result);
                                        if ("meta_up" === dbMetaId) {
                                            update.$set['up.' + keyName + ".values"] = result;
                                        } else {
                                            update.$set['sg.' + keyName + ".values"] = result;
                                        }
                                        common.drillDb.collection("drill_meta" + dbAppId).update({'_id': dbMetaId}, update, {'upsert': true}, function() {}); 
                                    }
                                });
                            } else {
                                
                            }
                        }
                    });
                }
            })).then(() => {
                // Resume the stream here.
                // log.d("star resume.....")
                stream.resume();
            });
        });

        stream.on("end", function () {
            log.d("all keys have been visited");
        });
    }

     /**
     * async
     * getMetaValues function
     * @param {Object} key - saveMetaValues object
     */
    async getMetaValues(key) {
        log.d(key)
    }
    
    /**
     * Run the job
     * @param {Db} db connection
     * @param {done} done callback
     */
    run(db, done) {
        this.init();
        done()
    }
}

module.exports = RedisJob;