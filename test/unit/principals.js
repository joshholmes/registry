var assert = require('assert')
  , config = require('../../config')
  , crypto = require('crypto')
  , fixtures = require('../fixtures')
  , log = require('../../log')
  , models = require('../../models')
  , services = require('../../services')
  , ursa = require('ursa');

describe('principals service', function() {
    var passwordFixture = "sEcReT44";

    it('can create and validate a user', function(done) {
        var user = new models.Principal({ type: "user",
                                          email: "user@gmail.com",
                                          password: passwordFixture });

        services.principals.create(user, function(err, user) {
            assert.ifError(err);
            assert.notEqual(user.id, undefined);
            assert.notEqual(user.visible_to, undefined);
            assert.notEqual(user.visible_to.length, 0);
            assert.notEqual(user.password_hash, undefined);
            assert.notEqual(user.password_hash, passwordFixture);
            assert.equal(user.email, "user@gmail.com");

            var principalJson = user.toJSON();
            assert.equal(principalJson.password_hash, undefined);
            assert.equal(principalJson.salt, undefined);

            services.principals.verifyPassword(passwordFixture, user, function(err) {
                assert.ifError(err);

                services.principals.verifyPassword("NOTCORRECT", user, function(err) {
                     assert.notEqual(err, null);
                     done();
                });
            });
        });
    });

    it('can create an app', function(done) {
        var keys = ursa.generatePrivateKey(config.public_key_bits, config.public_key_exponent);

        var device = new models.Principal({
            type: "app",
            public_key: keys.toPublicPem().toString('base64')
        });

        services.principals.create(device, function(err, device) {
            assert.ifError(err);
            assert.notEqual(device.id, undefined);

            done();
        });
    });

    it('can create and validate a device', function(done) {
        var keys = ursa.generatePrivateKey(config.public_key_bits, config.public_key_exponent);

        var device = new models.Principal({
            type: "device",
            public_key: keys.toPublicPem().toString('base64')
        });

        services.principals.create(device, function(err, device) {
            assert.ifError(err);
            assert.notEqual(device.id, undefined);
            assert.notEqual(device.public_key, undefined);
            assert(!device.secret);

            services.nonce.create(device.id, function(err, nonce) {
                assert.ifError(err);
                assert(nonce);
                assert(nonce.nonce);

                var signer = crypto.createSign("RSA-SHA256");
                signer.update(nonce.nonce);

                var signature = signer.sign(keys.toPrivatePem(), "base64");

                services.principals.verifySignature(nonce.nonce, signature, function(err, principal) {

                    assert(!err);
                    assert(principal);

                    // you should not be able to reuse a nonce.
                    services.principals.verifySignature(nonce.nonce, signature, function(err, principal) {
                        assert(err);
                        assert(!principal);
                        done();
                    });
                });
            });
        });
    });

    it('can generate a claim code', function(done) {
        var code = services.principals.generateClaimCode();
        assert.notEqual(code, undefined);
        assert.equal(code.length, config.claim_code_length + 1);

        done();
    });

    it('service can update name', function(done) {
        fixtures.models.principals.device.name = 'my camera';
        services.principals.update(services.principals.servicePrincipal, fixtures.models.principals.device.id, { name: "my camera"}, function(err, principal) {
            assert.ifError(err);
            assert.equal(principal.name, 'my camera');

            done();
        });
    });

    it('service can update visible_to', function(done) {
        fixtures.models.principals.device.name = 'my camera';

        fixtures.models.principals.device.visible_to.push("52747742e2948d8e7f000001");

        services.principals.update(services.principals.servicePrincipal, fixtures.models.principals.device.id,
            { visible_to: fixtures.models.principals.device.visible_to }, function(err, updatedPrincipal) {
            assert.ifError(err);

            var foundPrincipal = false;
            updatedPrincipal.visible_to.forEach(function(principalId) {
                if (principalId.toString() === "52747742e2948d8e7f000001")
                    foundPrincipal = true;
            });

            assert(foundPrincipal);
            done();
        });
    });

    it("a user principal can update a principal's name", function(done) {
        services.principals.update(fixtures.models.principals.user, fixtures.models.principals.user.id, { name: "Joe User" }, function(err, principal) {
            assert.ifError(err);
            assert.equal(principal.name, "Joe User");
            done();
        });
    });

    it('should reject creating a user without an email', function(done) {
        var user = new models.Principal({ type: 'user',
            password: fixtures.models.principals.user.password });

        services.principals.create(user, function(err, user) {
            assert.equal(!!err, true);
            done();
        });
    });

    it('should reject creating a user without a password', function(done) {
        var user = new models.Principal({ type: 'user',
                                          email: 'newuser@gmail.com' });

        services.principals.create(user, function(err, user) {
            assert.equal(!!err, true);
            done();
        });
    });

    it('should reject user deleting the service principal', function(done) {
        services.principals.removeById(fixtures.models.principals.user, services.principals.servicePrincipal.id, function(err) {
            assert.equal(!!err, true);
            done();
        });
    });

    it('should allow device deleting itself', function(done) {
        services.principals.removeById(fixtures.models.principals.device, fixtures.models.principals.device.id, function(err) {
            assert.ifError(err);
            done();
        });
    });

    it('should reject creating a if user that already exists', function(done) {
        var user = new models.Principal({ type: 'user',
                                          email: fixtures.models.principals.user.email,
                                          password: fixtures.models.principals.user.password });

        services.principals.create(user, function(err, user) {
            assert.equal(!err, false);
            done();
        });
    });

    it('can create a user, change its password, and then reset its password.', function(done) {
        var user = new models.Principal({
            type: "user",
            email: "changePassword@gmail.com",
            password: "firstPassword"
        });

        services.principals.create(user, function(err, user) {
            assert.ifError(err);

            var originalPasswordHash = user.password_hash;

            services.accessTokens.findOrCreateToken(user, function(err, accessToken) {
                assert.ifError(err);
                assert.notEqual(accessToken, undefined);

                services.accessTokens.findByPrincipal(user, function(err, accessTokens) {
                    assert.ifError(err);

                    services.principals.changePassword(user, "anotherPassword", function(err, principal) {
                        assert.ifError(err);
                        assert.notEqual(principal.password_hash, originalPasswordHash);
                        originalPasswordHash = principal.password_hash;

                        services.accessTokens.findByPrincipal(user, function(err, accessTokens) {
                            assert.ifError(err);

                            services.principals.resetPassword(services.principals.servicePrincipal, user, function(err, principal) {
                                assert.ifError(err);
                                assert.notEqual(principal.password_hash, originalPasswordHash);
                                done();
                            });
                        });
                    });
                });
            });
        });
    });
});
