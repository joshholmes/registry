var config = require('../config')
  , services = require('../services')
  , utils = require('../utils');

exports.health = function(req, res) {
    var status = "ok";
    services.subscriptions.count(function(err, subscriptionCount) {
        if (err) status = "failing";

        res.send({ memory: process.memoryUsage(),
                   pid: process.pid,
                   status: status,
                   subscriptions: subscriptionCount,
                   uptime: services.global.uptime() });
    });
};
