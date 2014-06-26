var async = require('async')
  , config = require('../config')
  , models = require('../models')
  , services = require('../services')
  , utils = require('../utils');

exports.create = function(req, res) {
    var permission = new models.Permission(req.body);

    services.permissions.create(req.user, permission, function(err, permission) {
        if (err) return utils.handleError(res, err);

        res.send({ 'permission': permission });
    });
};

exports.index = function(req, res) {
    var query = utils.parseQuery(req);
    var options = utils.parseOptions(req);

    services.permissions.find(req.user, query, options, function(err, permissions) {
        if (err) return utils.handleError(res, err);

        res.send({ "permissions": permissions });
    });
};

exports.remove = function(req, res) {
    services.permissions.removeById(req.user, req.params.id, function(err) {
        if (err) return utils.handleError(res, err);

        res.send(200);
    });
};
