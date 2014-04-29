var log = require('../log')
  , passport = require('passport')
  , services = require('../services')
  , utils = require('../utils');

module.exports = function(req, res, next) {
    var auth = passport.authenticate(['local'], { session: false });
    req.pause();

    auth(req, res, function(err, failed) {
        req.resume();

        if (err) return utils.handleError(res, utils.authenticationError());

        // opportunistically update the last connection details for this principal.
        if (req.user && req.ips) {
            services.principals.updateLastConnection(req.user, utils.ipFromRequest(req));
        }

        next();
    });
};