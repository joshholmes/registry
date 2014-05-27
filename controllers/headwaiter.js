var config = require('../config')
  , services = require('../services')
  , utils = require ('../utils');

exports.index = function(req, res) {
    var response = {
        endpoints: {
            api_keys: config.api_keys_endpoint,
            messages: config.messages_endpoint,
            permissions: config.permissions_endpoint,
            principals: config.principals_endpoint,
            subscriptions: config.subscriptions_endpoint,
            users: config.users_endpoint
        }
    };

    if (config.blob_provider) {
        response.endpoints.blobs = config.blobs_endpoint;
    }

    var nonceFunc = req.query.principal_id ? services.nonce.create : utils.nop;

    nonceFunc(req.query.principal_id, function(err, nonce) {
        if (err) return utils.handleError(res, utils.internalError(err));
        if (nonce) response.nonce = nonce.nonce;

        res.send(response);
    });
};