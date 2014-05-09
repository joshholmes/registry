var assert = require('assert')
  , config = require('../../config')
  , fixtures = require('../fixtures')
  , models = require('../../models')
  , services = require('../../services');

describe('authCodes service', function() {
    it('can create, check, and remove authCodes', function(done) {
        var authCode = new models.AuthCode({
            principal: fixtures.models.principals.anotherUser,
            redirect_uri: "http://localhost:9000/",
            perms: {}
        });

        services.authCodes.create(authCode, function(err, authCode) {
            assert(!err);

            assert(authCode.code);
            assert.notEqual(authCode.code.length, 0);

            assert(authCode.id);

            services.authCodes.check(authCode.code, fixtures.models.principals.anotherUser, function(err, checkAuthCode) {
                console.log(err);
                assert(!err);

                assert(checkAuthCode);
                assert(checkAuthCode.id === authCode.id);

                services.authCodes.check(authCode.code, fixtures.models.principals.user, function(err, checkAuthCode) {
                    assert(err);
                    assert(!checkAuthCode);

                    services.authCodes.remove({ code: authCode.code }, function(err, removed) {
                        assert(!err);
                        assert.equal(removed, 1);
                        done();
                    });
                });
            });
        });
    });
});