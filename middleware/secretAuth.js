var log = require('../log')
  , passport = require('passport')
  , services = require('../services')
  , utils = require('../utils');

module.exports = function(req, res, next) {
    req.pause();

    if (!req.body.id) return utils.authenticationError("No principal_id provided for secret-based authenication.");
    if (!req.body.secret) return utils.authenticationError("No secret provided for secret-based authenication.");

    services.principals.authenticateSecret(req.body.id, req.body.secret, function(err, principal) {
      if (err) return utils.handleError(res, err);

      req.user = principal;

      next();
    });
};