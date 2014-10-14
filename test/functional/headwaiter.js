var assert = require('assert')
  , core = require('nitrogen-core')
  , request = require('request');

describe('headwaiter endpoint', function() {
    it('should return service endpoints json', function(done) {
        request.get({
            url: core.config.headwaiter_uri + "?principal_id=" + core.fixtures.models.principals.device.id,
            json: true
        }, function(err,resp,body) {
            assert(!err);
            assert.equal(resp.statusCode, 200);

            assert(body.endpoints);
            assert.equal(core.utils.stringEndsWith(body.endpoints.registry.api_keys, "/api_keys"), true);
            assert.equal(core.utils.stringEndsWith(body.endpoints.egress.blobs, "/blobs"), true);
            assert.equal(core.utils.stringEndsWith(body.endpoints.ingress.messages, "/messages"), true);
            assert.equal(core.utils.stringEndsWith(body.endpoints.egress.permissions, "/permissions"), true);
            assert.equal(core.utils.stringEndsWith(body.endpoints.registry.principals, "/principals"), true);
            assert(body.endpoints.egress.subscriptions);

            done();
        });
    });
});
