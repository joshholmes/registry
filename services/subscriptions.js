var async = require('async')
  , config = require('../config')
  , log = require('../log')
  , models = require('../models')
  , mongoose = require('mongoose')
  , services = require('../services')
  , utils = require('../utils');

var io;

var attach = function(server) {
    if (!config.pubsub_provider) return log.warn('pubsub provider not configured: subscription endpoint not started.');

    io = require('socket.io').listen(server);

    io.set('log level', 1);

    attachAuthFilter();
    attachSubscriptionsEndpoint();

    log.info('listening for realtime connections on ' + config.subscriptions_path);
};

var attachAuthFilter = function() {
    io.configure(function () {
        io.set('authorization', function (handshakeData, callback) {
            if (!handshakeData.query.auth) return callback(null, false);

            services.accessTokens.verify(handshakeData.query.auth, function(err, principal) {
                var success = !err && principal;

                handshakeData.principal = principal;

                callback(null, success);
            });
        });
    });
};

var attachSubscriptionsEndpoint = function() {
    io.sockets.on('connection', function(socket) {
        if (!socket.handshake.principal) return log.error('subscription request without type and/or principal.');

        socket.subscriptions = {};
        socket.on('start', function(spec) {
            start(socket, spec);
        });

        socket.on('disconnect', function() {
            var subscriptionKeys = Object.keys(socket.subscriptions);
            log.info('subscriptions: socket: ' + socket.id + ' disconnected.  stopping ' + subscriptionKeys.length + ' subscriptions on this socket.');

            async.each(subscriptionKeys, function(clientId, callback) {
                stop(socket.subscriptions[clientId], function(err) {
                    delete socket.subscriptions[clientId];

                    return callback(err);
                });
            });
        });

        socket.on('stop', function(spec) {
            stop(socket.subscriptions[spec.id], function(err) {
                if (err) log.error(err);

                delete socket.subscriptions[spec.id];
            });
        });

        // TODO: add ability to create messages through the socket connection.
        //socket.on('message', function(message) {});
    });
};

var count = function(callback) {
    models.Subscription.count(callback);
};

var create = function(subscription, callback) {
    config.pubsub_provider.createSubscription(subscription, function(err) {
        if (err) callback(err);

        save(subscription, callback);
    });
};

var find = function(authPrincipal, filter, options, callback) {
    models.Subscription.find(filter, null, options, callback);
};

var findOne = function(subscription, callback) {
    var filter = {
        principal: subscription.principal,
        type: subscription.type,
        name: subscription.name
    };

    models.Subscription.findOne(filter, callback);
};

var findOrCreate = function(subscription, callback) {
    findOne(subscription, function(err, existingSubscription) {
        if (err) return callback(err);
        if (existingSubscription) return callback(null, existingSubscription);

        create(subscription, callback);
    });
};

var initialize = function(callback) {
    config.pubsub_provider.services = services;
    return callback();
}

var janitor = function(callback) {
    var cutoffTime = config.pubsub_provider.staleSubscriptionCutoff();

    find(services.principals.servicePrincipal, {
        $and: [
            { last_receive: { $lt: cutoffTime } },
            { permanent: false }
        ]
    }, function(err, subscriptions) {
        log.info('subscriptions: janitoring ' + subscriptions.length + ' abandoned session subscriptions from before: ' + cutoffTime.toString());
        async.each(subscriptions, remove, callback);
    });
};

var publish = function(type, item, callback) {
    if (!config.pubsub_provider) return callback(new Error("subscription service: can't publish without pubsub_provider"));

    config.pubsub_provider.publish(type, item, callback);
};

var receive = function(subscription, callback) {
    if (!config.pubsub_provider) return callback(new Error("subscription service: can't receive without pubsub_provider"));

    // fire and forget an update to tag this subscription with the last attempted receive.
    // used for janitorial purposes for non-permanent subscriptions.
    log.debug('subscriptions: updating last_receive for subscription: ' + subscription.id + ': ' + subscription.name + ': ' + subscription.filter_string);

    config.pubsub_provider.receive(subscription, callback);

    subscription.last_receive = new Date();
    subscription.save();
    //update(subscription, { last_receive: new Date() });
};

var remove = function(subscription, callback) {
    if (!subscription) return log.error('undefined subscription passed to services.subscription.remove.');

    log.debug('subscriptions: removing subscription: ' + subscription.id + ': ' + subscription.name + ': filter: ' + JSON.stringify(subscription.filter) + ' last_receive: ' + subscription.last_receive);

    config.pubsub_provider.removeSubscription(subscription, function(err) {
        if (err) {
            log.error('subscriptions: remove failed in provider with error: ' + err);
        }

        if (subscription.socket)
            delete subscription.socket.subscriptions[subscription.clientId];

        subscription.remove(callback);
    });
};

var save = function(subscription, callback) {
    subscription.save(callback);
};

var start = function(socket, spec, callback) {
    var subscription = new models.Subscription({
        clientId: spec.id,
        filter: spec.filter || {},
        name: spec.name,
        principal: socket.handshake.principal.id,
        socket: socket,
        type: spec.type
    });

    subscription.permanent = !!subscription.name;
    if (!subscription.permanent) {
        // assign the subscription a uuid as a name if this is session subscription
        subscription.name = utils.uuid();
    }

    findOrCreate(subscription, function(err, subscription) {
        if (err) {
            var msg = 'subscriptions: failed to create: ' + err;
            log.error(msg);
            if (callback) callback(new Error(msg));
            return;
        }

        log.debug('subscriptions: connecting subscription: ' + subscription.id + ' with clientId: ' + spec.id);

        subscription.clientId = spec.id;

        socket.subscriptions[subscription.clientId] = subscription;

        stream(socket, subscription);
        if (callback) return callback(null, subscription);
    });
};

// stop is invoked when an active subscription is closed.
// for permanent subscriptions this is a noop.
// for session subscriptions this removes them.
var stop = function(subscription, callback) {
    if (!subscription) {
        log.error('subscriptions:  stop passed null subscription');
    }

    if (subscription && !subscription.permanent) {
        remove(subscription, callback);
    } else {
        return callback();
    }
};

var stream = function(socket, subscription) {
    async.whilst(
        function() {
            return socket.subscriptions[subscription.clientId] !== undefined;
        },
        function(callback) {
            receive(subscription, function(err, item, ref) {
                if (err) return callback(err);

                // if the socket has disconnected in the meantime, reject the message.
                if (socket.subscriptions[subscription.clientId] === undefined) {
                    log.info('subscription service:  subscription is closed, rejecting message.');
                    config.pubsub_provider.ackReceive(ref, false);
                } else {
                    // there might not be an item when the provider timed out waiting for an item.
                    if (item) {
                        log.debug('subscription service:  new message from subscription: ' + subscription.clientId + ' with name: ' + subscription.name + ' of type: ' + subscription.type + ": " + JSON.stringify(item));
                        socket.emit(subscription.clientId, item);
                    }

                    config.pubsub_provider.ackReceive(ref, true);
                }

                callback();
            });
        },
        function(err) {
            if (err) log.error("subscription service: receive loop error: " + err);

            log.info("subscription service: stream for " + subscription.clientId + " disconnected.");
        }
    );
};

var update = function(subscription, updates, callback) {
    models.Subscription.update({ _id: subscription.id }, { $set: updates }, callback);
};

module.exports = {
    attach: attach,
    count: count,
    create: create,
    find: find,
    findOne: findOne,
    findOrCreate: findOrCreate,
    initialize: initialize,
    janitor: janitor,
    publish: publish,
    receive: receive,
    start: start,
    stop: stop
};
