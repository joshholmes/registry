var assert = require('assert')
  , config = require('../../config')
  , fixtures = require('../fixtures')
  , request = require('request')
  , utils = require('../../utils');

describe('headwaiter endpoint', function() {
    it('should return service endpoints json', function(done) {
        request.get({
            url: config.headwaiter_uri + "?principal_id=" + fixtures.models.principals.device.id,
            json: true
        }, function(err,resp,body) {
            assert.equal(resp.statusCode, 200);

            assert.notEqual(body.endpoints, undefined);
            assert.equal(utils.stringEndsWith(body.endpoints.api_keys, "/api_keys"), true);
            assert.equal(utils.stringEndsWith(body.endpoints.blobs, "/blobs"), true);
            assert.equal(utils.stringEndsWith(body.endpoints.messages, "/messages"), true);
            assert.equal(utils.stringEndsWith(body.endpoints.permissions, "/permissions"), true);
            assert.equal(utils.stringEndsWith(body.endpoints.principals, "/principals"), true);
            assert.notEqual(body.endpoints.subscriptions, undefined);

            done();
        });
    });
});
