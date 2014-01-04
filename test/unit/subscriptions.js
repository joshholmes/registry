var assert = require('assert')
  , config = require('../../config')
  , fixtures = require('../fixtures')
  , log = require('../../log')
  , models = require('../../models')
  , services = require('../../services')
  , utils = require('../../utils');

describe('subscriptions service', function() {
    it('creating a session subscription should not create row', function(done) {
        var subscription = new models.Subscription({
            filter: {},
            principal: fixtures.models.principals.device.id,
            type: 'message'
        });

        services.subscriptions.findOrCreate(subscription, function(err, createdSubscription) {
            assert.ifError(err);
            assert.equal(createdSubscription.permanent, false);

            services.subscriptions.findOne(subscription, function(err, subscription) {
                assert.ifError(err);
                assert.equal(subscription, null);

                done();
            });
        });
    });

    it('creating a named subscription should create row', function(done) {
        models.Subscription.count({}, function(err, startingCount) {
            assert.ifError(err);

            var subscription = new models.Subscription({
                filter: {},
                name: 'named',
                principal: fixtures.models.principals.device.id,
                type: 'message'
            });

            services.subscriptions.findOrCreate(subscription, function(err, subscription) {
                assert.ifError(err);

                models.Subscription.count({}, function(err, endingCount) {
                    assert.ifError(err);

                    assert.equal(startingCount + 1, endingCount);
                    done();
                });
            });
        });
    });

    it('running the janitor should remove abandoned session subscriptions', function(done) {
        var permSub = new models.Subscription({
            assignment: 'localhost',
            clientId: "5",
            filter: {},
            name: "permanent",
            permanent: true,
            principal: services.principals.servicePrincipal,
            type: "message",
            last_receive: utils.dateDaysFromNow(-2)
        });

        permSub.save(function(err) {
            assert.ifError(err);

            var sessionSub = new models.Subscription({
                assignment: 'localhost',
                clientId: "5",
                filter: {},
                name: "session",
                permanent: false,
                principal: services.principals.servicePrincipal,
                type: "message",
                last_receive: utils.dateDaysFromNow(-2)
            });

            sessionSub.save(function(err) {
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
