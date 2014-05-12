var async = require('async')
  , config = require('../config')
  , models = require('../models')
  , services = require('../services');

exports.up = function(callback) {
    var adminApiKey = models.ApiKey({
        capabilities: ['impersonate'],
        enabled : true,
        key: "admin",
        name : "Web Admin",
        redirect_uri: config.web_admin_uri,
        owner : services.principals.servicePrincipal
    });

    services.apiKeys.create(adminApiKey, callback);
};

// exports.down = function(callback) {
//    callback();
// };
