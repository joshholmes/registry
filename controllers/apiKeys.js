var config = require('../config')
  , core = require('nitrogen-core');

exports.index = function(req, res) {
    core.services.apiKeys.find({ owner: req.user.id }, {}, function(err, apiKeys) {
        if (err) return core.utils.handleError(res, err);

        res.send({ api_keys: apiKeys });
    });
};

exports.create = function(req, res) {
    var apiKey = new core.models.ApiKey(req.body);

    core.services.apiKeys.create(req.user, apiKey, function(err, apiKey) {
        if (err) return core.utils.handleError(res, err);

        res.send({ api_key: apiKey });
    });
};