var async = require('async')
  , config = require('../config')
  , crypto = require('crypto')
  , kue = require('kue')
  , jobs = kue.createQueue({
        redis: {
            host: config.redis_server.host,
            port: config.redis_server.port
        }
    })
  , log = require('../log')
  , models = require('../models')
  , services = require('../services')
  , utils = require('../utils');

var assign = function(principal, callback) {
    models.ApiKey.findOneAndUpdate({ owner: { $exists: false }, type: 'user' }, { $set: { owner: principal.id } }, function(err, apiKey) {
        if (err || apiKey) return callback(err, apiKey);

        // no unassigned keys available, so create an assigned one directly.
        create(new models.ApiKey({ 
            type: 'user', 
            owner: principal 
        }), callback);
    });
};

var check = function(key, redirectUri, callback) {
    if (!redirectUri) return callback(utils.badRequestError("redirect_uri " + key + " not provided."));

    find({ key: key }, {}, function(err, apiKeys) {
        if (err) return callback(err);

        if (apiKeys.length === 0) return callback(utils.badRequestError("api_key " + key + " not found."));

        var apiKey = apiKeys[0];

        if (!apiKey.enabled) return callback(utils.authorizationError("api_key " + key + " is not enabled"));
        if (!utils.stringStartsWith(redirectUri, apiKey.redirect_uri)) return callback(utils.badRequestError("redirect_uri does not match API Key."));

        return callback(null, apiKey);
    });
};

var create = function(apiKey, callback) {
    crypto.randomBytes(config.api_key_bytes, function(err, apiKeyBuf) {
        if (err) return callback(err);

        if (!apiKey.key)
            apiKey.key = apiKeyBuf.toString('hex');

        apiKey.save(function(err) {
            // kick off creating a personalized image for this key.
            jobs.create('build_image', { key: apiKey.key }).attempts(10).save();

            if (callback) return callback(err, apiKey);
        });
    });
};

var createUnassigned = function(callback) {
    log.info('apikeys service: creating unassigned key.');
    services.apiKeys.create(new models.ApiKey({ type: 'user' }), callback);
};

var find = function(query, options, callback) {
    models.ApiKey.find(query, null, options, callback);
};

var findById = function(id, callback) {
    if (!id) return callback(null, undefined);

    return models.ApiKey.findOne({ _id: id }, callback);
};

var findByKey = function(key, callback) {
    if (!key) return callback(null, undefined);

    return models.ApiKey.findOne({ key: key }, callback);
};

var initialize = function(callback) {
    models.ApiKey.find({ owner: { $exists: false }, type: 'user' }, {}, function(err, apiKeys) {
        if (err) return callback(err);

        var required = config.unassigned_apikey_pool_size - apiKeys.length;

        if (required > 0) {
            async.times(required, function(n, next) {
                createUnassigned(next);
            }, callback);
        } else {
            return callback();
        }
    });
};

var remove = function(query, callback) {
    models.ApiKey.remove(query, callback);
};

module.exports = {
    assign:          assign,
    check:           check,
    create:          create,
    find:            find,
    findById:        findById,
    findByKey:       findByKey,
    initialize:      initialize,
    remove:          remove,
};
