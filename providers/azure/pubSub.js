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

    this.serviceBus.createTopicIfNotExists('message', function(err) {
        if (err) return log.error("AzurePubSubProvider: Not able to create/confirm service bus topics: " + err);
    });

    this.SUPPORTS_PERMANENT_SUBSCRIPTIONS = true;
}

AzurePubSubProvider.RECEIVE_TIMEOUT_SECONDS = 5 * 60;

// sample JSON query
// {
//    "$and": [
//        { "type": "cameraCommand" },
//        { "$or": [
//                {"public":true},
//                {"visible_to":"5279287eb876269422000018"}
//          ]
//        }
//    ],
//    { "foo": "bar"}
// }

AzurePubSubProvider.buildFromSubArray = function(array, operation) {
    var subqueries = [];
    array.forEach(function(element) {
        subqueries.push(AzurePubSubProvider.sqlFromJsonQuery(element));        
    });

    return "(" + subqueries.join(operation) + ")";
};

AzurePubSubProvider.sqlFromJsonQuery = function(jsonQuery) {
    var subqueries = [];
    for (var key in jsonQuery) {
        if (key === "$and") {
            subqueries.push(AzurePubSubProvider.buildFromSubArray(jsonQuery[key], " AND "));
        } else if (key === "$or") {
            subqueries.push(AzurePubSubProvider.buildFromSubArray(jsonQuery[key], " OR "));
        } else {
            var value = JSON.stringify(jsonQuery[key]).replace(/"/g, "'");
            subqueries.push(key + '=' + value);
        }

    }

    if (subqueries.length > 0)
        return "(" + subqueries.join(" AND ") + ")";
    else
        return "";
};

AzurePubSubProvider.prototype.createSubscription = function(subscription, callback) {
    var self = this;    
    log.info('AzurePubSubProvider:creating subscription for type: ' + subscription.type + ' with id: ' + subscription.id);
    this.serviceBus.createSubscription(subscription.type, subscription.id, function(err) {
        if (err) {
            // non error - already exists.
            if (err.detail && err.detail.indexOf('already exists') !== -1)
                return callback();
            else
                return callback(err);
        }

        if (subscription.filter) {

            self.serviceBus.deleteRule(
                subscription.type, 
                subscription.id, 
                azure.Constants.ServiceBusConstants.DEFAULT_RULE_NAME,
                function(err) {
                    if (err) return callback(err);

                    self.serviceBus.createRule(
                        subscription.type, 
                        subscription.id, subscription.id + "_filter", {
                            sqlExpressionFilter: AzurePubSubProvider.sqlFromJsonQuery(subscription.filter)
                        }, function(err) {
                            return callback(err, subscription);
                        }
                    );  
                }
            );
        } else {
            return callback(null, subscription);
        }
    });
};

AzurePubSubProvider.prototype.publish = function(type, item, callback) {
    log.info("AzurePubSubProvider: publishing " + type + ": " + item.id + ": " + JSON.stringify(item));

    var serviceBusMessage = {
        customProperties: item.toObject(),
        body: JSON.stringify(item)
    };

    this.serviceBus.sendTopicMessage(type, serviceBusMessage, callback);
};

AzurePubSubProvider.prototype.receive = function(subscription, callback) {
    if (!subscription.type) return callback(new Error('Subscription type required.'));
    if (!subscription.id) return callback(new Error('Subscription id required.'));

    this.serviceBus.receiveSubscriptionMessage(
        subscription.type,
        subscription.id,
        { timeoutIntervalInS: AzurePubSubProvider.RECEIVE_TIMEOUT_SECONDS },
        function (err, item) {
            if (err) {
                // squelch non error error from Azure.
                if (err === 'No messages to receive') err = null;
                callback(err);
            }
            else {
                var message = JSON.parse(item.body)
                var unfiltered = sift(subscription.filter, [message]);

                if (unfiltered.length > 0)
                    callback(null, message);
                else {
                    log.warn('AzurePubSubProvider: had to post filter a message that should have been handled by Service Bus.');                    
                    callback();
                }
            }
        }
    );
};

AzurePubSubProvider.prototype.removeSubscription = function(subscription, callback) {
    this.serviceBus.deleteSubscription(subscription.type, subscription.id, function(err) {
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

    log.info('AzurePubSubProvider: resetting service bus topic completely for test');
    var self = this;
    
    this.serviceBus.listSubscriptions('message', function(err, subscriptions) {
        assert.ifError(err);

        async.each(subscriptions, function(subscription, removeCallback) {
            self.serviceBus.deleteSubscription(subscription.TopicName, subscription.SubscriptionName, removeCallback);
        }, function() {});

    });

    // don't wait for deleting all the current subscriptions
    return callback();
};

AzurePubSubProvider.prototype.subscriptionsForServer = function(serverId, callback) {
    this.serviceBus.listSubscriptions('message', callback); 
};

module.exports = AzurePubSubProvider;