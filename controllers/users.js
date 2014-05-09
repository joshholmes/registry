var config = require('../config')
  , log = require('../log')
  , models = require('../models')
  , services = require('../services')
  , utils = require('../utils');

var authorize = function(req, res) {
    var key = req.param('api_key');
    var redirect_uri = req.param('redirect_uri');
    var perms = []; // req.param('perms');

    services.apiKeys.check(key, redirect_uri, function(err, apiKey) {
        if (err) return utils.handleError(res, err);

        services.principals.find(services.principals.servicePrincipal, { api_key: apiKey.id, parent: req.user.id }, {}, function(err, apps) {
            if (err) return utils.handleError(res, err);
            if (apps.length > 0) return redirectWithSession(apps[0], redirect_uri, res);

            var authCode = models.AuthCode({
                api_key: apiKey.id,
                name: apiKey.name,
                principal: req.user.id,
                perms: perms,
                redirect_uri: redirect_uri
            });

            services.authCodes.create(authCode, function(err, authCode) {
                if (err) return utils.handleError(res, err);

                res.render('user/authorize', {
                    apiKey:             apiKey,
                    authCode:           authCode,
                    userDecisionPath:  config.user_decision_path
                });
            });
        });
    });
};

var decision = function(req, res) {
    var code = req.param('code');
    var authorized = (req.param('authorize') !== undefined);

    services.authCodes.check(code, req.user, function(err, authCode) {
        if (err) return utils.handleError(res, err);

        if (authorized) {
            var app = new models.Principal({
                type: 'app',
                api_key: authCode.api_key,
                parent: authCode.principal,
                name: authCode.name
            });

            services.principals.create(app, function(err, app) {
                if (err) return utils.handleError(res, err);

                return redirectWithSession(res, app, authCode.redirect_uri);
            });
        }
    });
};

var redirectWithSession = function(res, app, redirectUri) {
    services.accessTokens.findOrCreateToken(app, function (err, accessToken) {
        if (err) return callback(err);

        res.redirect(redirectUri + "?principal=" + encodeURI(JSON.stringify(app.toObject())) +
                                   "&accessToken=" + encodeURI(JSON.stringify(accessToken.toObject())));
    });
};

var showLogin = function(req, res) {
    res.render('user/login', { user_login_path: config.user_login_path });
};

module.exports = {
    authorize:  authorize,
    decision:   decision,
    showLogin:  showLogin
};