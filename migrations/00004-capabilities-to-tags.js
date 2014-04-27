var async = require('async')
  , models = require('../models')
  , services = require('../services')
  , utils = require('../utils');

// migrates capabilities into tags

exports.up = function(callback) {
    services.principals.find(services.principals.servicePrincipal, {}, function(err, principals) {
        if (err) return callback(err);

        async.each(principals, function(principal, principalCallback) {
            principal.tags = [];

            principal.capabilities.forEach(function(capability) {
                if (utils.stringEndsWith(capability, "Command")) {
                    principal.tags.push("executes:" + capability);
                }
            });

            principal.capabilities = [];
            principal.save(principalCallback);
        }, callback);
    });
};

// exports.down = function(callback) {
//    callback();
// };
