var assert = require('assert')
  , config = require('../../config')
  , fixtures = require('../fixtures')
  , log = require('../../log')
  , models = require('../../models')
  , services = require('../../services')
  , utils = require('../../utils');

describe('subscriptions service', function() {
    it('creating a subscription should create row', function(done) {
        services.subscriptions.findByPrincipalCached(fixtures.models.principals.device, fixtures.models.principals.device.id, {}, function(err, subscriptions) {
            assert(!err);

            var cachedCount = subscriptions.length;

            models.Subscription.count({}, function(err, startingCount) {
                assert(!err);

                var subscription = new models.Subscription({
                    filter: {},
                    name: 'named',
                    principal: fixtures.models.principals.device.id,
                    type: 'message',
                    permanent: false,
                    name: utils.uuid()
                });

                services.subscriptions.findOrCreate(subscription, function(err, subscription) {
                    assert(!err);

                    config.cache_provider.get('subscriptions', "subscriptions.principal." + fixtures.models.principals.device.id.toString(), function(err, subscriptionObjs) {
                        assert(!err);
                        assert(!subscriptionObjs);
                    });

                    models.Subscription.count({}, function(err, endingCount) {
                        assert(!err);

                        assert.equal(startingCount + 1, endingCount);

                        services.subscriptions.findByPrincipalCached(fixtures.models.principals.device, fixtures.models.principals.device.id, {}, function(err, subscriptions) {
                            assert(!err);

                            assert.equal(cachedCount + 1, subscriptions.length);

                            config.cache_provider.get('subscriptions', "subscriptions.principal." + fixtures.models.principals.device.id.toString(), function(err, subscriptionObjs) {
                                assert(!err);
                                assert(subscriptionObjs.length);

                                log.info('removing subscription: ' + subscription.id);
                                services.subscriptions.remove(subscription, function(err) {
                                    assert(!err);

                                    config.cache_provider.get('subscriptions', "subscriptions.principal." + fixtures.models.principals.device.id.toString(), function(err, subscriptionObjs) {
                                        assert(!err);
                                        assert(!subscriptionObjs);

                                        services.subscriptions.findByPrincipalCached(fixtures.models.principals.device, fixtures.models.principals.device.id, {}, function(err, subscriptions) {
                                            assert(!err);
                                            assert.equal(cachedCount, subscriptions.length);

                                            done();
                                        });
                                    });
                                })
                            });
                        });
                    });
                });
            });

        });
    });

    it('can correctly create and then find by principal with cache', function(done) {
        var subscription = new models.Subscription({
            clientId: "fakeclientid",
            filter: { type: 'ip' },
            principal: services.principals.servicePrincipal.id,
            type: 'message',
            permanent: false,
            name: utils.uuid()
        });

        // cache no subscriptions
        services.subscriptions.findByPrincipal(services.principals.servicePrincipal, services.principals.servicePrincipal.id, {}, function(err, subscriptions) {
            assert(!err);

            // add a subscription, which should invalidate cache entry
            services.subscriptions.findOrCreate(subscription, function(err, createdSubscription) {
                assert(!err);

                services.subscriptions.findByPrincipal(services.principals.servicePrincipal, services.principals.servicePrincipal.id, {}, function(err, subscriptions) {
                    assert(!err);

                    subscriptions.forEach(function(subscription) {
                        console.log('subscription: ' + subscription.id);
                        console.log('createdSubscription: ' + createdSubscription.id);

                        if (subscription.id === createdSubscription.id)
                            done();
                    });
                });
            });
        });
    });

    it('can create a session subscription and receive messages from it', function(done) {
        var subscription = new models.Subscription({
            clientId: "fakeclientid",
            filter: { type: 'ip' },
            principal: services.principals.servicePrincipal.id,
            type: 'message',
            permanent: false,
            name: utils.uuid()
        });

        services.subscriptions.findOrCreate(subscription, function(err, subscription) {
            assert(!err);

            var publishFinished;
            config.pubsub_provider.receive(subscription, function(err, message) {

                assert(!err);
                assert.notEqual(message, undefined);
                assert.equal(message.type, 'ip');

                //var totalTime = new Date().getTime() - publishFinished.getTime();
                //assert(totalTime < 200);

                config.pubsub_provider.subscriptionsForServer(subscription.assignment, function(err, subscriptions) {
                    assert(!err);
                    var startingSubscriptions = subscriptions.length;

                    config.pubsub_provider.removeSubscription(subscription, function(err) {
                        assert(!err);

                        config.pubsub_provider.subscriptionsForServer(subscription.assignment, function(err, subscriptions) {
                            assert(!err);

                            assert.equal(1, startingSubscriptions - subscriptions.length);
                            done();
                        });
                    });
                });
            });

            var message = new models.Message({
                from: services.principals.servicePrincipal,
                type: "_test",
                body: { reading: 5.1 }
            });

            var startPublish = new Date();

            services.messages.create(services.principals.servicePrincipal, message, function(err) {
                assert(!err);
                publishFinished = new Date();

                //var totalTime = publishFinished.getTime() - startPublish.getTime();
                //assert(totalTime < 800);

                var message = new models.Message({
                    from: services.principals.servicePrincipal,
                    type: "ip",
                    body: { ip_address: "127.0.0.1" }
                });

                services.messages.create(services.principals.servicePrincipal, message, function(err) {
                    publishFinished = new Date();
                    assert(!err);
                });
            });
        });
    });

    if (config.pubsub_provider.SUPPORTS_PERMANENT_SUBSCRIPTIONS) {
        it('permanent subscriptions should queue messages for later', function(done) {
            var subscription = new models.Subscription({
                filter: { type: '_permanentQueueTest' },
                name: 'permanent',
                permanent: true,
                principal: services.principals.servicePrincipal.id,
                type: 'message'
            });

            services.subscriptions.findOrCreate(subscription, function(err, subscription) {
                assert.ifError(err);
                assert(subscription.permanent);

                var msg = new models.Message({
                    type: '_permanentQueueTest',
                    from: services.principals.servicePrincipal.id,
                    body: {
                        seq: 1
                    }
                });

                // create a message
                services.messages.create(services.principals.servicePrincipal, msg, function(err) {
                    assert.ifError(err);

                    // create an irrelevant message
                    msg.type = '_anotherType';
                    services.messages.create(services.principals.servicePrincipal, msg, function(err) {
                        assert.ifError(err);

                        // create a 2nd message
                        msg.body.seq = 2;
                        msg.type = '_permanentQueueTest';
                        services.messages.create(services.principals.servicePrincipal, msg, function(err) {
                            assert.ifError(err);

                            // receive messages and make sure we get both and in order and they are relevant.
                            services.subscriptions.receive(subscription, function(err, message, ref) {
                                assert.ifError(err);

                                assert.equal(message.type, '_permanentQueueTest');
                                assert.equal(message.body.seq, 1);

                                config.pubsub_provider.ackReceive(ref, true);

                                services.subscriptions.receive(subscription, function(err, message, ref) {
                                    assert.ifError(err);
                                    assert.equal(message.type, '_permanentQueueTest');
                                    assert.equal(message.body.seq, 2);

                                    config.pubsub_provider.ackReceive(ref, true);

                                    done();
                                });
                            });
                        });
                    });
                });
            });
        });
    }


    it('running the janitor should remove abandoned session subscriptions', function(done) {
        var permSub = new models.Subscription({
            assignment: 'localhost',
            clientId: "5",
            filter: {},
            name: "janitorTest",
            permanent: true,
            principal: services.principals.servicePrincipal,
            type: "message",
            last_receive: utils.dateDaysFromNow(-5)
        });

        services.subscriptions.findOrCreate(permSub, function(err, permSub) {
            assert.ifError(err);

            var sessionSub = new models.Subscription({
                clientId: "5",
                filter: {},
                principal: services.principals.servicePrincipal,
                type: "message",
                permanent: false,
                name: utils.uuid(),
                last_receive: utils.dateDaysFromNow(-5)
            });

            services.subscriptions.findOrCreate(sessionSub, function(err, sessionSub) {
                assert.ifError(err);

                models.Subscription.count({}, function(err, startingCount) {
                    assert.ifError(err);

                    services.subscriptions.janitor(function(err) {
                        assert.ifError(err);

                        models.Subscription.count({}, function(err, endingCount) {
                            assert.ifError(err);

                            assert.equal(startingCount, endingCount + 1);
                            done();
                        });
                    });
                });
            });
        });
    });
});
