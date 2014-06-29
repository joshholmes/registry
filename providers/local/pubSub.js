var async = require('async')
  , log = require('../../log')
  , moment = require('moment')
  , sift = require('sift')
  , utils = require('../../utils');

function MemoryPubSubProvider() {
    this.subscriptions = {};
}

MemoryPubSubProvider.prototype.createSubscription = function(subscription, callback) {
    this.subscriptions[subscription.clientId] = subscription;

    return callback();
};

MemoryPubSubProvider.prototype.publish = function(type, item, callback) {
    log.debug("MemoryPubSubProvider: publishing " + type + ": " + item.id + ": " + JSON.stringify(item));
    var self = this;

    async.each(Object.keys(this.subscriptions), function(subscriptionId, subscriptionCallback) {

        var subscription = self.subscriptions[subscriptionId];

        if (subscription.type === type && subscription.callback) {
            sift(subscription.filter, [item]).forEach(function(unfiltered) {
                subscription.callback(null, item);
            });
        }

        subscriptionCallback();

    }, callback);
};

MemoryPubSubProvider.prototype.receive = function(subscription, callback) {
    subscription.callback = callback;
};

MemoryPubSubProvider.prototype.ackReceive = function(ref, sent) {
};

MemoryPubSubProvider.prototype.removeSubscription = function(subscription, callback) {
    delete this.subscriptions[subscription.clientId];

    callback();
};

MemoryPubSubProvider.prototype.staleSubscriptionCutoff = function() {
    return moment().add('days', -1).toDate();
};

// TEST ONLY FUNCTIONS

MemoryPubSubProvider.prototype.resetForTest = function(callback) {
    this.subscriptions = {}

    return callback();
};

MemoryPubSubProvider.prototype.subscriptionsForServer = function(serverId, callback) {
    var self = this;
    var subscriptions = Object.keys(this.subscriptions).map(function(key) {
        return self.subscriptions[key];
    });

    return callback(null, subscriptions);
};

module.exports = MemoryPubSubProvider;
