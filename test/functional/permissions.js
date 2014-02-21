var assert = require('assert')
  , config = require('../../config')
  , models = require('../../models')
  , fixtures = require('../fixtures')
  , request = require('request');

describe('permissions endpoint', function() {
    it('index should be not be accessible anonymously', function(done) {
        request(config.permissions_endpoint, function(err, resp, body) {
            assert.equal(err, undefined);
            assert.equal(resp.statusCode, 401);
            done();
        });
    });

    it('index should return all permissions', function(done) {
        request({ url: config.permissions_endpoint,
                  headers: { Authorization: fixtures.models.accessTokens.user.toAuthHeader() },
                             json: true }, function(err,resp,body) {
            assert.ifError(err);
            assert.equal(resp.statusCode, 200);

            assert.notEqual(body.permissions, undefined);
            assert.equal(body.permissions.length > 0, true);
            done();
        });
    });

    it('should allow creating and deleting a permission by a user', function(done) {
        var permission = {
            issued_to:     fixtures.models.accessTokens.user.principal,
            principal_for: fixtures.models.accessTokens.user.principal,
            action:        'admin',
            priority:      100,
            authorized:    true        
        };

        request.post(config.permissions_endpoint,
            { headers: { Authorization: fixtures.models.accessTokens.user.toAuthHeader() },
                json: permission }, function(err, resp, body) {
                assert.ifError(err);
                assert.equal(resp.statusCode, 200);

                assert.notEqual(body.permission.id, undefined);

                request.del({ url: config.permissions_endpoint + "/" + body.permission.id,
                              headers: { Authorization: fixtures.models.accessTokens.user.toAuthHeader() } }, function(err, resp, body) {
                    assert.ifError(err);
                    assert.equal(resp.statusCode, 200);

                    done();
                });
            }
        );
    });
});