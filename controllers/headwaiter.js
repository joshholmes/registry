var core = require('nitrogen-core');

exports.index = function(req, res) {
    var response = {
        endpoints: {

            ingress: {
                messages: core.config.messages_endpoint
            },

            registry: {
                api_keys: core.config.api_keys_endpoint,
                principals: core.config.principals_endpoint,
                users: core.config.users_endpoint
            },

            egress: {
                permissions: core.config.permissions_endpoint,
                subscriptions: core.config.subscriptions_endpoint,
                messages: core.config.messages_endpoint
            }
        }
    };

    if (core.config.blob_provider) {
        response.endpoints.egress.blobs = core.config.blobs_endpoint;
    }

    if (core.config.images_endpoint) {
        response.endpoints.egress.images = core.config.images_endpoint;
    }

    res.send(response);

/* PUBLIC KEY AUTH SUPPORT
    var nonceFunc = req.query.principal_id ? core.services.nonce.create : core.utils.nop;

    nonceFunc(req.query.principal_id, function(err, nonce) {
        if (err) return core.utils.handleError(res, core.utils.internalError(err));
        if (nonce) response.nonce = nonce.nonce;

        res.send(response);
    }); */

};