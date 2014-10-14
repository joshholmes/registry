var core = require('nitrogen-core')
  , passport = require('passport');

module.exports = function(req, res, next) {
    var auth = passport.authenticate(['publickey'], { session: false });
    req.pause();

    auth(req, res, function(err, failed) {
        req.resume();

        if (err) return core.utils.handleError(res, err);

        next();
    });
};