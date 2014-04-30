var assert = require('assert')
  , config = require('../../config')
  , fixtures = require('../fixtures')
  , request = require('request')
  , utils = require('../../utils');

describe('headwaiter endpoint', function() {
    it('should return service endpoints json (legacy entries)', function(done) {
        request.get({ url: config.headwaiter_uri, json: true }, function(err,resp,body) {
            assert.equal(resp.statusCode, 200);

            assert.notEqual(body.endpoints, undefined);
            assert.equal(utils.stringEndsWith(body.endpoints.blobs_endpoint, "/blobs"), true);
            assert.equal(utils.stringEndsWith(body.endpoints.messages_endpoint, "/messages"), true);
            assert.equal(utils.stringEndsWith(body.endpoints.permissions_endpoint, "/permissions"), true);
            assert.equal(utils.stringEndsWith(body.endpoints.principals_endpoint, "/principals"), true);
            assert.notEqual(body.endpoints.subscriptions_endpoint, undefined);

            done();
        });
    });

    it('should return service endpoints json', function(done) {
        request.get({
            url: config.headwaiter_uri + "?principal_id=" + fixtures.models.principals.device.id,
            json: true
        }, function(err,resp,body) {
            assert.equal(resp.statusCode, 200);

            assert.notEqual(body.endpoints, undefined);
            assert.equal(utils.stringEndsWith(body.endpoints.blobs, "/blobs"), true);
            assert.equal(utils.stringEndsWith(body.endpoints.messages, "/messages"), true);
            assert.equal(utils.stringEndsWith(body.endpoints.permissions, "/permissions"), true);
            assert.equal(utils.stringEndsWith(body.endpoints.principals, "/principals"), true);
            assert.notEqual(body.endpoints.subscriptions, undefined);

            done();
        });
    });
});
