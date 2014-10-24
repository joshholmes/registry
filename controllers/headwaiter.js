var core = require('nitrogen-core');

exports.index = function(req, res) {
    var response = {
        endpoints: {


        }
    };

    res.send(response);

/* PUBLIC KEY AUTH SUPPORT
    var nonceFunc = req.query.principal_id ? core.services.nonce.create : core.utils.nop;

    nonceFunc(req.query.principal_id, function(err, nonce) {
        if (err) return core.utils.handleError(res, core.utils.internalError(err));
        if (nonce) response.nonce = nonce.nonce;

        res.send(response);
    }); */

};