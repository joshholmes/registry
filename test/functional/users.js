var app = require('../../server')
  , assert = require('assert')
  , config = require('../../config')
  , fixtures = require('../fixtures')
  , models = require('../../models')
  , request = require('request').defaults({jar: true})
  , services = require('../../services');

describe('users endpoint', function() {

    it('should create user', function(done) {
        request.post(config.users_endpoint + '/create', {
            form: {
                email: 'newuser@server.org',
                name: 'Test User',
                password: 'MOREsEcReT44'
            }
        }, function(err, resp, body) {
            assert(!err);
            assert.equal(resp.statusCode, 302);

            done();
        });
    });

    it('should login user', function(done) {
        request.post(config.users_endpoint + '/login', {
            form: {
                email: 'user@server.org',
                password: 'sEcReT44'
            }
        }, function(err, resp, body) {
            assert(!err);
            assert.equal(resp.statusCode, 302);

            done();
        });
    });

    it('should be able to reset password', function(done) {
        request.post(config.users_endpoint + '/resetpassword', {
            form: { email: 'user@server.org' }
        }, function(err, resp, body) {
            assert(!err);

            assert.equal(resp.statusCode, 200);
            assert.notEqual(body.indexOf('was reset'), -1);
            done();
        });
    });

    it('should be able to change password', function(done) {
        request.post(config.users_endpoint + '/create', {
            form: {
                email: 'changeuser@server.org',
                name: 'Test User',
                password: 'sEcReT55'
            },
            jar: true
        }, function(err, resp, body) {
            assert(!err);
            assert.equal(resp.statusCode, 302);

            request.post(config.users_endpoint + '/changepassword', {
                form: {
                    currentPassword: 'sEcReT55',
                    newPassword: 'SUPERS3CRET',
                    newPasswordAgain: 'SUPERS3CRET'
                },
                jar: true
            }, function(err, resp, body) {
                assert(!err);
                assert.equal(resp.statusCode, 200);

                assert.notEqual(body.indexOf('was changed'), -1);

                request.post(config.users_endpoint + '/login', {
                    form: {
                        email: 'changeuser@server.org',
                        password: 'SUPERS3CRET'
                    }
                }, function(err, resp, body) {
                    assert(!err);
                    assert.equal(resp.statusCode, 302);

                    done();
                });
            });
        });
    });

    it('should not change password without current password', function(done) {
        request.post(config.users_endpoint + '/create', {
            form: {
                email: 'changeuser2@server.org',
                name: 'Test User',
                password: 'sEcReT55'
            },
            jar: true
        }, function(err, resp, body) {
            assert(!err);
            assert.equal(resp.statusCode, 302);

            request.post(config.users_endpoint + '/changepassword', {
                form: {
                    currentPassword: 'WRONGPASSWORD',
                    newPassword: 'SUPERS3CRET',
                    newPasswordAgain: 'SUPERS3CRET'
                },
                jar: true
            }, function(err, resp, body) {
                assert(!err);
                assert.equal(resp.statusCode, 200);

                assert.equal(body.indexOf('was changed'), -1);

                done();
            });
        });
    });

    it('can impersonate user if apiKey allows', function(done) {
        request.post(config.users_endpoint + '/login', {
            form: {
                email: fixtures.models.principals.user.email,
                password: 'sEcReT44'
            },
            jar: true
        }, function(err, resp, body) {
            assert(!err);

            console.log(fixtures.models.apiKeys.admin.key);

            request.get(config.users_endpoint + '/impersonate' +
                '?api_key=' + encodeURIComponent(fixtures.models.apiKeys.admin.key) +
                '&redirect_uri=' + encodeURIComponent(fixtures.models.apiKeys.admin.redirect_uri), {
                    followRedirect: false
                }, function(err, resp, body) {

                assert(!err);

                assert(resp.body.indexOf('accessToken') !== -1);
                assert(resp.body.indexOf('principal') !== -1);
                assert(resp.body.indexOf('error') === -1);

                done();
            });
        });
    });

    it('can not impersonate user if apiKey doesnt allow', function(done) {
        request.post(config.users_endpoint + '/login', {
            form: {
                email: fixtures.models.principals.user.email,
                password: 'sEcReT44'
            },
            jar: true
        }, function(err, resp, body) {
            assert(!err);
            assert(resp.statusCode, 200);

            request.get(config.users_endpoint + '/impersonate' +
                '?api_key=' + encodeURIComponent(fixtures.models.apiKeys.regularApp.key) +
                '&redirect_uri=' + encodeURIComponent(fixtures.models.apiKeys.regularApp.redirect_uri, {
                    followRedirect: false
                }), function(err, resp, body) {

                assert(!err);

                assert(resp.request.uri.query.indexOf('accessToken') === -1);
                assert(resp.request.uri.query.indexOf('principal') === -1);
                assert(resp.request.uri.query.indexOf('error') !== -1);

                done();
            });
        });
    });
});