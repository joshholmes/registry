var async = require('async')
  , config = require('../config')
  , log = require('../log')
  , models = require('../models')
  ,	services = require('../services')
  , utils = require('../utils');

var checkFrom = function(req, message, callback) {
    if (!message.from || message.from === req.user.id)
        return callback(null, new models.Permission({ authorized: true }));

    services.permissions.authorize({
        principal: req.user.id,
        principal_for: message.from,
        action: 'admin'
    }, message, callback);
};

exports.create = function(req, res) {
    async.concat(req.body, function(messageObject, callback) {
        delete messageObject.created_at;

        // translate constants to ObjectIds, apply defaults.
        services.messages.translate(messageObject);

        var message = new models.Message(messageObject);
        if (!message.from) message.from = req.user.id;

        checkFrom(req, message, function(err, permission) {
            if (err) return callback(err);
            if (!permission.authorized) {
                log.warn('principal: ' + req.user.id + ' attempted to send message with from: of another principal: ' + JSON.stringify(message));
                return callback(utils.authorizationError());
            }

            return callback(null, [message]);
        });
    }, function (err, messages) {
        if (err) return utils.handleError(res, err);

        services.messages.createMany(req.user, messages, function(err, messages) {
            if (err) return utils.handleError(res, err);

            res.send({ "messages": messages });
        });
    });
};

exports.index = function(req, res) {
    var query = utils.parseQuery(req);
    var options = utils.parseOptions(req);

    if (!options.sort) options.sort = { ts: -1 };

    services.messages.find(req.user, query, options, function(err, messages) {
        if (err) return utils.handleError(res, err);

        res.send({ "messages": messages });
    });
};

exports.remove = function(req, res) {
    var query = utils.parseQuery(req);

    services.messages.remove(req.user, query, function(err, removed) {
        if (err) return utils.handleError(res, err);

        res.send({ "removed": removed });
    });
};

exports.show = function(req, res) {
    services.messages.findById(req.user, req.params.id, function(err, message) {
        if (err) return utils.handleError(res, err);
        if (!message) return utils.sendFailedResponse(res, 403, err);

        res.send({ "message": message });
    });
};
