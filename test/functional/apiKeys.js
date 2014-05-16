var assert = require('assert')
  , config = require('../../config')
  , fixtures = require('../fixtures')
  , request = require('request');

describe('api_keys endpoint', function() {

    it("should return user api_keys for users", function(done) {
        request({
            headers: {
                Authorization: fixtures.models.accessTokens.user.toAuthHeader()
            },
            json: true,
            url: config.api_keys_endpoint
        }, function(err,resp,body) {
            assert.ifError(err);
            assert.equal(resp.statusCode, 200);

            assert(body.api_keys);
            assert.equal(body.api_keys.length, 1);
            assert.equal(body.api_keys[0].owner, fixtures.models.principals.user.id);

            done();
        });
    });

});