var assert = require('assert')
  , config = require('../../config')
  , fixtures = require('../fixtures')
  , services = require('../../services');

describe('accessToken service', function() {
    it('can create and remove tokens', function(done) {
        services.accessTokens.create(fixtures.models.principals.anotherUser, function(err, accessToken) {
            assert(!err);

            services.accessTokens.findByTokenCached(accessToken.token, function(err, accessToken) {
                assert(!err);
                assert(accessToken);

                config.cache_provider.get('accessTokens', "token." + accessToken.token, function(err, accessTokenObj) {
                    assert(!err);
                    assert(accessTokenObj);

                    services.accessTokens.remove({ _id: accessToken.id }, function(err, removed) {
                        assert(!err);
                        assert.equal(removed, 1);

                        config.cache_provider.get('accessTokens', "token." + accessToken.token, function(err, accessTokenObj) {
                            assert(!err);
                            assert(!accessTokenObj);
                            done();
                        });
                    });
                });
            });
        });
    });
});