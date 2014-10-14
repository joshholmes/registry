var core = require('nitrogen-core')
  , passport = require('passport');

module.exports = function(req, res, next) {
    req.pause();

    if (!req.body.id) return core.utils.authenticationError("No principal_id provided for secret-based authenication.");
    if (!req.body.secret) return core.utils.authenticationError("No secret provided for secret-based authenication.");

    core.services.principals.authenticateSecret(req.body.id, req.body.secret, function(err, principal) {
        if (err) return core.utils.handleError(res, err);

        req.user = principal;

        next();
    });
};