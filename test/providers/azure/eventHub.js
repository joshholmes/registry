var assert = require('assert')
    , config = require('../../../config')
    , providers = require('../../../providers')
    , services = require('../../../services');

describe('Azure EventHub', function() {
    it('can send a message to hub', function(done) {
        var message = { from: 'bob', id: '123', message: 'stuff' };
        var provider = new providers.azure.AzureEventHub('a', 'b', 'c', 'd');
        provider.eventHubClient.sendMessage = function (m, p, s, e) {
            assert.equal(m, JSON.stringify(m));
            assert.equal(p, 'bob');
            s();
        };
        provider.archive(message, function (err) {
            assert.ifError(err);
            done();
        });
    });
});
