var assert = require('assert') 
  , config = require('../config')
  , fixtures = require('./fixtures')
  , log = require('../log')
  , services = require('../services');

before(function(done) {
    config.pubsub_provider.resetForTest(function(err) {
        assert.ifError(err);

        fixtures.reset(function(err) {
            assert.ifError(err); 

            log.debug("FIXTURES: creation finished...");
            done();
        });
    });
});
