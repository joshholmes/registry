var assert = require('assert')
  , core = require('nitrogen-core')
  , request = require('request');

describe('ops endpoint', function() {

    it('should have passing health', function(done) {
        request({
            url: core.config.ops_endpoint + '/health',
            json: true
        }, function(err, resp, body) {
            assert(!err);

            assert.equal(resp.statusCode, 200);
            assert.equal(body.status, "ok");
            done();
        });
    });
});