var assert = require('assert')
  , config = require('../../config')
  , fixtures = require('../fixtures')
  , models = require('../../models')
  , services = require('../../services');

describe('apiKeys service', function() {
    it('can create, check, and remove apiKeys', function(done) {
        var apiKey = new models.ApiKey({
            owner: fixtures.models.principals.anotherUser,
            name: 'my app',
            redirect_uri: "http://localhost:9000/"
        });

        services.apiKeys.create(apiKey, function(err, apiKey) {
            assert(!err);

            assert(apiKey.key);
            assert.notEqual(apiKey.key.length, 0);

            assert(apiKey.id);

            services.apiKeys.check(apiKey.key, apiKey.redirect_uri + "/suffix", function(err, checkApiKey) {
                assert(!err);

                assert(checkApiKey);
                assert(checkApiKey.id === apiKey.id);

                services.apiKeys.check(apiKey.key, "http://roguesite.com", function(err, checkApiKey) {
                    assert(err);
                    assert(!checkApiKey);

                    services.apiKeys.remove({ _id: apiKey.id }, function(err, removed) {
                        assert(!err);
                        assert.equal(removed, 1);
                        done();
                    });
                });
            });
        });
    });
});