var app = require('../../server')
  , assert = require('assert')
  , config = require('../../config')
  , fixtures = require('../fixtures')
  , models = require('../../models')
  , request = require('request')
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

    it('should not change password without you knowing current password', function(done) {
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

});