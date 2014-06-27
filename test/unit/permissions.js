var assert = require('assert')
  , config = require('../../config')
  , fixtures = require('../fixtures')
  , models = require('../../models')
  , services = require('../../services');

describe('permissions service', function() {
    it('checks default permissions', function(done) {
        var message = new models.Message({
            type: 'ip'
        });

        services.permissions.authorize({
            principal: services.principals.servicePrincipal.id,
            action: 'send'
        }, message, function(err, permission) {
            assert.ifError(err);
            assert.equal(permission.authorized, true);

            services.permissions.authorize({
                principal: fixtures.models.principals.user.id,
                action: 'send'
            }, message, function(err, permission) {
                assert.ifError(err);
                assert.equal(permission.authorized, false);

                message.type = 'image';
                message.body.url = 'http://to.no.where/';

                services.permissions.authorize({
                    principal: fixtures.models.principals.user.id,
                    action: 'send'
                }, message, function(err, permission) {
                    assert.ifError(err);
                    assert.equal(permission.authorized, true);

                    message.to = fixtures.models.principals.device.id;
                    services.permissions.authorize({
                        principal: fixtures.models.principals.user.id,
                        action: 'send'
                    }, message, function(err, permission) {
                        assert.ifError(err);
                        assert.equal(permission.authorized, false);
                        done();
                    });
                });
            });
        });
    });

    it('creating a permission updates visible_to and clears caches', function(done) {
        services.principals.findById(services.principals.servicePrincipal, fixtures.models.principals.anotherUser.id, function(err, anotherUser) {
            assert(!err);

            services.permissions.create(services.principals.servicePrincipal,
                new models.Permission({
                    authorized: true,
                    issued_to: fixtures.models.principals.user.id,
                    principal_for: fixtures.models.principals.anotherUser.id,
                    priority: 50000000
                }),
                function(err, permission) {
                    assert(!err);

                    config.cache_provider.get('permissions', fixtures.models.principals.user.id, function(err, permissionObjs) {
                        assert(!err);
                        assert(!permissionObjs);
                    });

                    config.cache_provider.get('permissions', fixtures.models.principals.anotherUser.id, function(err, permissionObjs) {
                        assert(!err);
                        assert(!permissionObjs);
                    });

                    services.principals.findById(services.principals.servicePrincipal, fixtures.models.principals.anotherUser.id, function(err, anotherUser) {
                        assert(!err);

                        var foundUser = false;
                        anotherUser.visible_to.forEach(function(visiblePrincipalId) {
                            if (visiblePrincipalId.toString() === fixtures.models.principals.user.id)
                                foundUser = true;
                        });

                        assert(foundUser);

                        services.permissions.permissionsForCached(fixtures.models.principals.user.id, function(err, permissions) {
                            assert(!err);
                            assert(permissions.length);

                            config.cache_provider.get('permissions', fixtures.models.principals.user.id, function(err, permissionObjs) {
                                assert(!err);
                                assert(permissionObjs.length);

                                var found = false;
                                permissionObjs.forEach(function(permissionObj) {
                                    found = found || permissionObj.priority === 50000000
                                })

                                assert(found);
                            });
                        });

                        services.permissions.removeById(services.principals.servicePrincipal, permission.id, function(err) {
                            assert(!err);

                            config.cache_provider.get('permissions', fixtures.models.principals.user.id, function(err, permissionObjs) {
                                assert(!err);
                                assert(!permissionObjs);

                                services.permissions.permissionsForCached(fixtures.models.principals.user.id, function(err, permissions) {
                                    assert(!err);
                                    assert(permissions.length);

                                    var found = false;
                                    permissions.forEach(function(permission) {
                                        found = found || permission.priority === 50000000
                                    })

                                    assert(!found);

                                    done();
                                });
                            });
                        });
                    });
                }
            );
        });
    });

});
