var config = require('../config')
  , services = require('../services')
  , utils = require ('../utils');

exports.index = function(req, res) {
    var response = {
        endpoints: {
            messages: config.messages_endpoint,
            permissions: config.permissions_endpoint,
            principals: config.principals_endpoint,
            subscriptions: config.subscriptions_endpoint,
            users: config.users_endpoint,

            // TODO: DEPRECATED LONG NAMES, REMOVE ONCE CLIENTS MIGRATED.
            messages_endpoint: config.messages_endpoint,
            permissions_endpoint: config.permissions_endpoint,
            principals_endpoint: config.principals_endpoint,
            subscriptions_endpoint: config.subscriptions_endpoint
        }
    };

    if (config.blob_provider) {
        response.endpoints.blobs = config.blobs_endpoint;

        // TODO: DEPRECATED LONG NAME, REMOVE ONCE CLIENTS MIGRATED.
        response.endpoints.blobs_endpoint = config.blobs_endpoint;
    }

    var nonceFunc = req.query.principal_id ? services.nonce.create : utils.nop;

    nonceFunc(req.query.principal_id, function(err, nonce) {
        if (err) return utils.handleError(res, utils.internalError(err));
        if (nonce) response.nonce = nonce.nonce;

        res.send(response);
    });
};