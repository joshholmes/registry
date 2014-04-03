var assert = require('assert')
  , async = require('async')
  , fixtures = require('../fixtures')
  , models = require('../../models')
  , services = require('../../services');

if (process.env.RUN_PERF_TESTS) {

    describe('messages service', function() {

        var createMessages = function(id, callback) {
            var messages = [];

            console.log(id);

            for (var idx=0; idx < 100; idx++) {
                var message = new models.Message({
                    ts: new Date(),
                    from: fixtures.models.principals.device.id,
                    type: "_temperature",
                    body: { 
                        reading: Math.random() * 100.0,
                        error: Math.random() 
                    },
                    visible_to: [ fixtures.models.principals.device.id, fixtures.models.principals.user.id ]
                });

                messages.push(message);
            }

            // create one interesting command message...
            var command = new models.Message({
                ts: new Date(),
                from: fixtures.models.principals.user.id,
                to: fixtures.models.principals.device.id,
                type: "_thermometerCommand",
                body: { 
                    command: 'measure' 
                },
                tags: [ '_command:' + fixtures.models.principals.device.id ],
                visible_to: [ fixtures.models.principals.device.id ]
            });

            messages.push(command);

            // create a bunch of irrelevant command messages from "other devices".
            for(var idx=0; idx < 100; idx++) {
                messages.push(new models.Message({
                    ts: new Date(),
                    from: fixtures.models.principals.user.id,
                    to: fixtures.models.principals.user.id,
                    type: "_thermometerCommand",
                    body: { 
                        command: 'measure' 
                    },
                    tags: [ '_command:' + fixtures.models.principals.user.id ],
                    visible_to: [ fixtures.models.principals.device.id, fixtures.models.principals.user.id ]
                }));
            }

            models.Message.create(messages, callback);
            //services.messages.createMany(fixtures.models.principals.device, messages, callback);
        }

        it('able to still performantly fetch commands amongst bulk telemetry', function(done) {
            var createStart = new Date();
            var CREATE_ITERATIONS = 50000;

            var dummyArray = [];
            for (var count=0; count < CREATE_ITERATIONS; count++)
                dummyArray.push(count);

            async.eachLimit(dummyArray, 10, createMessages, function(err) {
                assert.ifError(err);

                var createMillis = new Date().getTime() - createStart.getTime();
                console.log('create milliseconds: ' + createMillis);

                var millisPerMessage = createMillis / (CREATE_ITERATIONS * 101);
                console.log('milliseconds per message: ' + millisPerMessage);

                var findStart = new Date();

                services.messages.find(fixtures.models.principals.device, {
                    tags: "_command:" + fixtures.models.principals.device.id
                }, { sort: { ts: 1 } }, function(err, commandMessages) {
                    assert.ifError(err);
                    
                    var findMillis = new Date().getTime() - findStart.getTime();
                    console.log('find milliseconds: ' + findMillis);

                    assert.equal(commandMessages.length, CREATE_ITERATIONS);

                    assert(findMillis < 200);
                    done();
                });
            });
        });

    });
}
