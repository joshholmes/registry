var config = require('../config')
  , crypto = require('crypto')
  , log = require('../log')
  , models = require('../models')
  , services = require('../services')
  , utils = require('../utils');

var create = function(authCode, callback) {
    crypto.randomBytes(config.auth_code_bytes, function(err, authCodeBuf) {
        if (err) return callback(err);

        authCode.code = authCodeBuf.toString('base64');
        authCode.save(function(err) {
            return callback(err, authCode);
        });
    });
};

var check = function(code, user, callback) {
    find({ code: code }, {}, function(err, authCodes) {
        if (err) return callback(err);
        if (authCodes.length === 0) return callback(utils.badRequestError('authCode not found.'));

        var authCode = authCodes[0];

        if (!authCode.user.equals(user.id)) return callback(utils.badRequestError('authCode for different user.'));
        return callback(null, authCode);
    });
};

var find = function(query, options, callback) {
    models.AuthCode.find(query, null, options, callback);
};

var remove = function(query, callback) {
    models.AuthCode.remove(query, callback);
};

module.exports = {
    check:           check,
    create:          create,
    find:            find,
    remove:          remove
};