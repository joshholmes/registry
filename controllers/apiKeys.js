var config = require('../config')
  , models = require('../models')
  , services = require('../services')
  , utils = require('../utils');

exports.index = function(req, res) {
    services.apiKeys.find({ owner: req.user.id }, {}, function(err, apiKeys) {
        if (err) return utils.handleError(res, err);

        res.send({ api_keys: apiKeys });
    });
};

exports.create = function(req, res) {
    var apiKey = new models.ApiKey(req.body);

    services.apiKeys.create(req.user, apiKey, function(err, apiKey) {
        if (err) return utils.handleError(res, err);

        res.send({ api_key: apiKey });
    });
};