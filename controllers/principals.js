var config = require('../config')
  , log = require('../log')
  , models = require('../models')
  , services = require('../services')
  , utils = require('../utils');

var sendAuthResponse = function(res, principal, accessToken) {
    res.set('X-n2-set-access-token', JSON.stringify(accessToken));
    res.send({ principal: principal, accessToken: accessToken });
};

exports.legacyAuthentication = function(req, res) {
    services.principals.authenticate(req.body, function(err, principal, accessToken) {
        if (err) return utils.handleError(res, err);

        // since the authenticateRequest middleware was not run on this request run it manually.
        services.principals.updateLastConnection(principal, utils.ipFromRequest(req));

        sendAuthResponse(res, principal, accessToken);
    });
};

exports.changePassword = function(req, res) {

    // even though we have an accesstoken to validate this request, we still want the
    // user to provide a password to reauthenticate such that we know it is them, and not a hijacked
    // browser window that is making the change password request.

    // but if this fails, send back a 403 not 401 to match up that the operation is not authorized but
    // signal that the session itself is still authenticated.

    services.principals.authenticate(req.body, function(err, principal) {
        if (err) return utils.handleError(res, utils.authorizationError("The current password was not accepted by the service."));

        if (!principal.is('user')) return utils.handleError(res, utils.badRequest("principal must be of type user to change password."));

        services.principals.changePassword(principal, req.body.new_password, function(err, principal, accessToken) {
            if (err) return utils.handleError(res, err);

            sendAuthResponse(res, principal.toObject(), accessToken);
        });
    });
};

exports.create = function(req, res) {
    delete req.body.created_at;

	var principal = new models.Principal(req.body);

	services.principals.create(principal, function(err, principal) {
		if (err) return utils.handleError(res, err);

        services.accessTokens.create(principal, function(err, accessToken) {
            if (err) return utils.handleError(res, err);

            var principalJSON = principal.toObject();

            if (!principal.is('user')) {
                // for create (and create only) we want to pass back the secret to the device.
                principalJSON.secret = principal.secret;
            }

            // since the authenticateRequest middleware was not run on this request run it manually.
            services.principals.updateLastConnection(principal, utils.ipFromRequest(req));

            sendAuthResponse(res, principalJSON, accessToken);
        });
	});
};

exports.impersonate = function(req, res) {
    services.principals.impersonate(req.user, req.body.id, function (err, impersonatedPrincipal, accessToken) {
        if (err) return utils.handleError(res, err);

        // don't use sendAuthResponse above or it will wipe out the request session for the impersonated one.
        res.send({ principal: impersonatedPrincipal, accessToken: accessToken });
    });
};

exports.index = function(req, res) {
    var query = utils.parseQuery(req);
    if (typeof query !== 'object')
        return utils.handleError(res, utils.badRequestError('Invalid query format.'));

    var options = utils.parseOptions(req);
    if (typeof options !== 'object')
        return utils.handleError(res, utils.badRequestError('Invalid options format.'));

    if (!options.sort) options.sort = { last_connection: -1 };

    services.principals.find(req.user, query, options, function (err, principals) {
        if (err) return utils.handleError(res, err);

		res.send({ principals: principals });
	});
};

exports.remove = function(req, res) {
    services.principals.removeById(req.user, req.params.id, function(err) {
        if (err) return utils.handleError(res, err);

        res.send(200);
    });
};

exports.resetPassword = function(req, res) {
    if (!req.body.email) return utils.handleError(res, utils.badRequestError("Email requested to reset password."))

    services.principals.find(services.principals.servicePrincipal, { email: req.body.email }, function(err, principals) {
        if (err) return utils.handleError(res, err);
        if (principals.length < 1) return utils.handleError(res, utils.notFoundError('User ' + req.body.email + ' not found.'));

        services.principals.resetPassword(services.principals.servicePrincipal, principals[0], function(err) {
            if (err) return utils.handleError(res, err);

            res.send(200, {});
        });
    });
};

exports.show = function(req, res) {
	services.principals.findById(req.user, req.params.id, function (err, principal) {
		if (err) return utils.handleError(res, err);
		if (!principal) return utils.sendFailedResponse(res, 403, "Can't show requested principal.");

		res.send({ principal: principal });
	});
};

exports.update = function(req, res) {
    if (req.body.visible_to) return utils.handleError(res, utils.badRequest("update of principal can't include visible_to"));

    services.principals.update(req.user, req.params.id, req.body, function(err, principal) {
        if (err) return utils.handleError(res, err);

        res.send({ principal: principal });
    });
};