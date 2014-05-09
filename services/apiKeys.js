var config = require('../config')
  , crypto = require('crypto')
  , log = require('../log')
  , models = require('../models')
  , services = require('../services')
  , utils = require('../utils');

var check = function(key, redirectUri, callback) {
    log.info("key: " + key);
    log.info("redirectUri: " + redirectUri);

    find({ key: key }, {}, function(err, apiKeys) {
        if (err) return callback(err);

        log.info('apiKeys: ' + JSON.stringify(apiKeys));

        if (apiKeys.length === 0) return callback(utils.badRequestError("api_key " + key + " not found."));

        var apiKey = apiKeys[0];

        if (!apiKey.enabled) return callback(utils.authorizationError("api_key " + key + " is not enabled"));
        if (!utils.stringStartsWith(redirectUri, apiKey.redirect_uri)) return callback(utils.badRequestError("redirect_uri does not match API Key."));

        return callback(null, apiKey);
    });
};

var create = function(apiKey, callback) {
    log.info('apiKeys: creating apiKey for owner: ' + apiKey.owner);

    crypto.randomBytes(config.api_key_bytes, function(err, apiKeyBuf) {
        if (err) return callback(err);

        apiKey.key = apiKeyBuf.toString('base64');
        apiKey.save(function(err) {
            return callback(err, apiKey);
        });
    });
};

var find = function(query, options, callback) {
    log.info("query: " + JSON.stringify(query));
    models.ApiKey.find(query, null, options, callback);
};

var remove = function(query, callback) {
    models.ApiKey.remove(query, callback);
};

module.exports = {
    check:           check,
    create:          create,
    find:            find,
    remove:          remove
};