var async = require('async')
  , config = require('../config')
  , fs = require('fs')
  , log = require('../log')
  , models = require('../models')
  , moment = require('moment')
  , services = require('../services')

var serviceStartTime = new Date();

var buildStats = function(callback) {
    var measurementStart = moment().subtract('days', 1).toDate();

    var stats = {};

    console.dir(measurementStart);
    // measure total
    services.principals.find(services.principals.servicePrincipal, {
        last_connection: {
            $gt: measurementStart
        }
    }, {}, function(err, principals) {
        console.dir(err);

        if (err) return callback(err);

        stats.principals_24h_active = principals.length;
        stats.devices_24h_active = filterByType(principals, 'device').length;
        stats.users_24h_active = filterByType(principals, 'user').length;

        services.subscriptions.count(function(err, subscriptionsCount) {
            if (err) return callback(err);

            stats.subscriptions = subscriptionsCount;

            services.messages.count({
                created_at: {
                    $gt: measurementStart
                }
            }, function(err, messagesCount) {
                if (err) return callback(err);

                console.log(messagesCount);

                stats.messages = messagesCount;

                return callback(null, stats);
            })
        });
    });
};

var filterByType = function(principals, type) {
    return principals.map(function(principal) {
        if (principal.is(type)) return principal;
    });
};

// TODO: when scaled out do we just let all the nodes do this and use the
// entropy in the offset timing of that automatically scale these deletes?
var janitor = function(callback) {
    services.accessTokens.remove({ expires_at: { $lt: new Date() } }, function(err, removed) {
        if (err) callback("janitor message removal failed: " + err);
        log.info("janitor removed " + removed + " expired access tokens.");

        services.messages.remove(services.principals.servicePrincipal, { index_until: { $lt: new Date() } }, function(err, removed) {
            if (err) callback("janitor message removal failed: " + err);
            log.info("janitor removed " + removed + " messages.");

            services.subscriptions.janitor(callback);
          });
    });
};

var migrate = function(callback) {
    models.Metadata.findOne({ key: 'schemaVersion' }, function(err, schemaVersion) {
        if (err) throw err;

        if (!schemaVersion) {
            schemaVersion = new models.Metadata({ key: 'schemaVersion', value: '0' });
            schemaVersion.save();
        }

        log.info('current schema version: ' + schemaVersion.value);

        fs.readdir('./migrations', function(err, files) {
            async.eachSeries(files, function(file, cb) {
                var fileMigrationPosition = parseInt(file);

                if (parseInt(file) > schemaVersion.value) {
                    log.info('starting migration: ' + file);
                    require('../migrations/' + file).up(function(err) {
                        if (err) return cb(err);

                        log.info('migration successful, updating current schema version to ' + fileMigrationPosition);
                        models.Metadata.update({ _id: schemaVersion.id }, { value: fileMigrationPosition }, cb);
                    });
                } else {
                    return cb();
                }
            }, callback);
        });
    });
};

var startJanitor = function(callback) {
    setInterval(function() {
        janitor(function(err) {
            if (err) log.error(err);
        });
    }, config.janitor_interval);

    return callback();
};

var uptime = function() {
    return Math.floor((new Date().getTime() - serviceStartTime.getTime()) / 1000.0);
};

module.exports = {
    buildStats: buildStats,
    janitor: janitor,
    migrate: migrate,
    startJanitor: startJanitor,
    uptime: uptime
};