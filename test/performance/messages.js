var assert = require('assert')
  , async = require('async')
  , services = require('../../services');

describe('messages service', function() {

    var createMessages = function(callback) {
        for (var idx=0; idx < 100; idx++) {
            var message = new models.Message({
                type: "_temperature",
                body: { 
                    reading: Math.random() * 100.0,
                    error: Math.random() 
                }
            });

            messages.push(message);
        }

        var command = new models.Message({
            type: "_thermometerCommand",
            body: { 
                command: 'measure' 
            }
        });

        messages.push(command);
        services.messages.createMany(fixtures.models.principals.device, messages, function(err, savedMessages) {
          assert.ifError(err);

          return callback(err);
        });
    }

    it('able to still performantly fetch commands amongst bulk telemetry', function(done) {
        async.times(1000, createMessages, function(err, messages) {
            assert.ifError(err);

            var start = new Date();

            services.messages.find(fixtures.models.principals.device, {
                $and: [ 
                    { $or: [ { to: this.device.id }, { from: this.device.id } ] },
                    { $or: [ { type: '_thermometerCommand'}, { type: 'image' } ] }
                ]
            }, { sort: { ts: 1 } }, function(err, commandMessages) {
                var stop = new Date();

                assert.ifError(err);

                assert.equal(commandMessages.length, 1000);
                var executionMillis = stop.getTime() - start.getTime();

                assert(executionMillis < 200);
            });
        });
    });
    
});
