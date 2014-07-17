var async = require('async')
  , config = require('../config')
  , log = require('../log')
  , models = require('../models')
  , moment = require('moment')
  , mongoose = require('mongoose')
  , RedisStore = require('socket.io/lib/stores/redis')
  , redis  = require('socket.io/node_modules/redis')
  , services = require('../services')
  , utils = require('../utils');

var io;

var attach = function(server) {
    if (!config.pubsub_provider) return log.warn('pubsub provider not configured: subscription endpoint not started.');

    io = require('socket.io').listen(server);

    this.pub = redis.createClient(config.redis_server.port, config.redis_server.host);
    this.sub = redis.createClient(config.redis_server.port, config.redis_server.host);
    this.client = redis.createClient(config.redis_server.port, config.redis_server.host);

    io.set('store', new RedisStore({
        redisPub: this.pub,
        redisSub: this.sub,
        redisClient: this.client
    }));

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
            log.info('subscriptions: starting subscription with spec: ' + JSON.stringify(spec));
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
            log.info('subscriptions: stopping subscription with spec: ' + JSON.stringify(spec));
            stop(socket.subscriptions[spec.id], function(err) {
                if (err) log.error(err);

                delete socket.subscriptions[spec.id];
            });
        });

        // Expose message endpoint through socket connection.
        socket.on('messages', function(messageBundle) {
            services.messages.createMany(socket.handshake.principal, messageBundle.messages, function(err, messages) {
                socket.emit(messageBundle.uniqueId, {
                    error: err,
                    messages: messages
                });
            });
        });
    });
};

var cacheKeySubscriptionsForPrincipal = function(principalId) {
    return "subscriptions.principal." + principalId.toString();
};

var clearPrincipalSubscriptionsCacheEntry = function(principalId, callback) {
    var cacheKey = cacheKeySubscriptionsForPrincipal(principalId);
    log.debug('subscriptions: clearing cache entry ' + cacheKey);

    config.cache_provider.del('subscriptions', cacheKey, callback);
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

var findByPrincipalCached = function(authPrincipal, principalId, options, callback) {
    var cacheKey = cacheKeySubscriptionsForPrincipal(principalId);
    config.cache_provider.get('subscriptions', cacheKey, function(err, subscriptionObjs) {
        if (err) return callback(err);
        if (subscriptionObjs) {
            log.debug("subscriptions: " + cacheKey + ": cache hit: " + subscriptionObjs.length);
            var subscriptions = subscriptionObjs.map(function(obj) {
                var subscription = new models.Subscription(obj);

                // Mongoose by default will override the passed id with a new unique one.  Set it back.
                subscription._id = mongoose.Types.ObjectId(obj.id);

                return subscription;
            });

            return callback(null, subscriptions);
        }

        log.debug("subscriptions: " + cacheKey + ": cache miss.");

        // find and cache result
        return findByPrincipal(authPrincipal, principalId, options, callback);
    });
};

var findByPrincipal = function(authPrincipal, principalId, options, callback) {
    var cacheKey = cacheKeySubscriptionsForPrincipal(principalId);

    models.Subscription.find({ principal: principalId }, null, options, function(err, subscriptions) {
        if (err) return callback(err);

        log.debug("subscriptions: setting cache entry for " + cacheKey + ": " + subscriptions.length);
        config.cache_provider.set('subscriptions', cacheKey, subscriptions,  moment().add('days', 1).toDate(), function(err) {
            return callback(err, subscriptions);
        });
    });
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
        last_receive: { $lt: cutoffTime },
        permanent: false
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
        if (err) log.error('subscriptions: remove failed in provider with error: ' + err);

        subscription.remove(function(err, removedCount) {
            if (err) return callback(err);

            if (subscription.socket)
                delete subscription.socket.subscriptions[subscription.clientId];

            clearPrincipalSubscriptionsCacheEntry(subscription.principal, function(err) {
                return callback(err, removedCount);
            });
        });
    });
};

var save = function(subscription, callback) {
    subscription.save(function(err, subscription) {
        if (err) return callback(err);

        clearPrincipalSubscriptionsCacheEntry(subscription.principal, function(err) {
            return callback(err, subscription);
        });
    });
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
        log.warn('subscriptions: stop: passed null subscription.');
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
    models.Subscription.update({ _id: subscription.id }, { $set: updates }, function(err, updateCount) {
        if (err) return callback(err);

        clearPrincipalSubscriptionsCacheEntry(subscription.principal, function(err) {
            return callback(err, updateCount);
        });
    });
};

module.exports = {
    attach: attach,
    count: count,
    create: create,
    find: find,
    findByPrincipal: findByPrincipal,
    findByPrincipalCached: findByPrincipalCached,
    findOne: findOne,
    findOrCreate: findOrCreate,
    initialize: initialize,
    janitor: janitor,
    publish: publish,
    receive: receive,
    remove: remove,
    start: start,
    stop: stop
};
