var assert = require('assert')
    , config = require('../../../config')
    , providers = require('../../../providers')
    , services = require('../../../services');

describe('Azure EventHub', function() {
    it('can send a message to hub', function(done) {
        var message = new models.Message({
            type: "_test",
            body: { reading: 5.1 }
        });
        var provider = new providers.azure.AzureEventHubProvider({
            'azure_servicebus_namespace': 'a',
            'azure_eventhub_name': 'b',
            'azure_eventhub_key_name': 'c',
            'azure_eventhub_key': 'd' });
        provider.eventHubClient.sendMessage = function (m, p, cb) {
            assert.equal(m, JSON.stringify(message.toObject()));
            assert.equal(p, null);
            cb();
        };
        provider.archive(message, function (err) {
            assert.ifError(err);
            done();
        });
    });
});
