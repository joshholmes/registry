var core = require('nitrogen-core');

exports.health = function(req, res) {
    var status = "ok";
    core.services.subscriptions.count(function(err, subscriptionCount) {
        if (err) status = "failing";

        res.send({ memory: process.memoryUsage(),
                   pid: process.pid,
                   status: status,
                   subscriptions: subscriptionCount,
                   uptime: core.services.global.uptime() });
    });
};