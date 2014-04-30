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

        next();
    });
};