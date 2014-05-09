var config = require('../config')
  , crypto = require('crypto')
  , log = require('../log')
  , models = require('../models')
  , services = require('../services')
  , utils = require('../utils');

var create = function(principalId, callback) {
    services.principals.findById(services.principals.servicePrincipal, principalId, function(err, principal) {
        if (err) return callback(err);
        if (!principal) return callback(utils.notFoundError("Principal " + principalId + " not found."));

        log.info('nonce: creating nonce for principal: ' + principalId);

        var nonce = new models.Nonce({
            principal: principal
        });

        crypto.randomBytes(config.nonce_bytes, function(err, nonceBuf) {
            if (err) return callback(err);

            nonce.nonce = nonceBuf.toString('base64');
            nonce.save(function(err) {
                return callback(err, nonce);
            });
        });
    });
};

var find = function(query, options, callback) {
    models.Nonce.find(query, null, options, callback);
};

var remove = function(query, callback) {
    models.Nonce.remove(query, callback);
};

module.exports = {
    create:          create,
    find:            find,
    remove:          remove
};