var assert = require('assert')
  , async = require('async')
  , azure = require('azure')
  , log = require('../../log')
  , sift = require('sift')
  , utils = require ('../../utils');

function AzurePubSubProvider(config) {
    if (!process.env.AZURE_SERVICEBUS_NAMESPACE || !process.env.AZURE_SERVICEBUS_ACCESS_KEY) {
        return log.warn("AzurePubSubProvider: Service bus namespace or access key not configured.  Set AZURE_SERVICEBUS_NAMESPACE and AZURE_SERVICEBUS_ACCESS_KEY as environment variables to configure the azure pub sub provider.");
    }

    var retryOperations = new azure.ExponentialRetryPolicyFilter();

    this.serviceBus = azure.createServiceBusService(process.env.AZURE_SERVICEBUS_NAMESPACE, process.env.AZURE_SERVICEBUS_ACCESS_KEY)
                           .withFilter(retryOperations);

    this.SUPPORTS_PERMANENT_SUBSCRIPTIONS = true;
}

AzurePubSubProvider.RECEIVE_TIMEOUT_SECONDS = 5 * 60;
AzurePubSubProvider.prototype.MAX_LATENCY = 5000;

AzurePubSubProvider.buildQueueName = function(type, id) {
    return type + "." + id;
};

AzurePubSubProvider.prototype.createSubscription = function(subscription, callback) {
    var self = this;
    log.debug('AzurePubSubProvider:creating subscription for type: ' + subscription.type + ' with id: ' + subscription.id + ' with filter: ' + JSON.stringify(subscription.filter));

    var options = {
      MaxSizeInMegabytes: '5120'
    };

    var queueName = AzurePubSubProvider.buildQueueName(subscription.type, subscription.id);

    this.serviceBus.createQueueIfNotExists(queueName, options, function(err) {
        return callback(err, subscription);
    });
};

AzurePubSubProvider.prototype.publish = function(type, item, callback) {
    var self = this;
    log.debug("AzurePubSubProvider: publishing " + type + ": " + item.id + ": " + JSON.stringify(item));

    // for each principal this message is visible_to
    async.each(item.visible_to, function(visibleToId, visibleToCallback) {

        // query the subscriptions that principal has
        self.services.subscriptions.find(self.services.principals.servicePrincipal, {  }, {}, function(err, subscriptions) {
            if (err) return visibleToCallback(err);

            log.debug('subscriptions: ' + JSON.stringify(subscriptions));

            async.each(subscriptions, function(subscription, subscriptionCallback) {
                log.debug("AzurePubSubProvider: CHECKING subscription: name: " + subscription.name + " type: " + subscription.type + " filter: " + JSON.stringify(subscription.filter));

                if (subscription.type !== type) return subscriptionCallback();

                log.debug("message: " + JSON.stringify(item));

                var unfilteredItems = sift(subscription.filter, [item]);

                if (unfilteredItems.length === 0) return subscriptionCallback();

                log.debug("AzurePubSubProvider: MATCHED subscription: name: " + subscription.name + " type: " + subscription.type + " filter: " + JSON.stringify(subscription.filter));

                var serviceBusMessage = {
                    customProperties: item.toObject(),
                    body: JSON.stringify(item)
                };

                var queueName = AzurePubSubProvider.buildQueueName(subscription.type, subscription.id);

                self.serviceBus.sendQueueMessage(queueName, serviceBusMessage, subscriptionCallback);
            }, visibleToCallback);
        });
    }, callback);
};

AzurePubSubProvider.prototype.receive = function(subscription, callback) {
    if (!subscription.type) return callback(new Error('Subscription type required.'));
    if (!subscription.id) return callback(new Error('Subscription id required.'));

    var queueName = AzurePubSubProvider.buildQueueName(subscription.type, subscription.id);

    this.serviceBus.receiveQueueMessage(queueName, {
        timeoutIntervalInS: AzurePubSubProvider.RECEIVE_TIMEOUT_SECONDS
    }, function(err, serviceBusMessage) {
        if (err) {
            // squelch non error error from Azure.
            if (err === 'No messages to receive') err = null;
            callback(err);
        }
        else {
            log.info("AzurePubSubProvider: RECEIVED: " + serviceBusMessage.body);

            var message = JSON.parse(serviceBusMessage.body)
            return callback(null, message);
        }
    });
};

AzurePubSubProvider.prototype.ackReceive = function(ref, sent) {
};

AzurePubSubProvider.prototype.removeSubscription = function(subscription, callback) {
    var queueName = AzurePubSubProvider.buildQueueName(subscription.type, subscription.id);

    this.serviceBus.deleteQueue(queueName, function(err) {
        // squelch NotFound and treat it like success
        if (err && err.code && err.code === 'NotFound')
            return callback();
        else
            return callback(err);
    });
};

AzurePubSubProvider.prototype.staleSubscriptionCutoff = function() {
    return new Date(new Date().getTime() + -4 * 1000 * AzurePubSubProvider.RECEIVE_TIMEOUT_SECONDS);
};

// TEST ONLY METHODS BELOW

AzurePubSubProvider.prototype.resetForTest = function(callback) {
    if (process.env.NODE_ENV === "production") return callback();

    log.debug('AzurePubSubProvider: resetting service bus queues completely for test');
    var self = this;

    this.serviceBus.listQueues(function(err, queues) {
        assert.ifError(err);

        async.each(queues, function(queue, removeCallback) {
            self.serviceBus.deleteQueue(queue.QueueName, removeCallback);
        }, function() {});
    });

    return callback();
};

AzurePubSubProvider.prototype.subscriptionsForServer = function(serverId, callback) {
    this.serviceBus.listQueues(callback);
};

module.exports = AzurePubSubProvider;