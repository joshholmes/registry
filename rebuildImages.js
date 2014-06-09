var config = require('./config')
  , kue = require('kue')
  , jobs = kue.createQueue({
        redis: {
            host: config.redis_server.host,
            port: config.redis_server.port
        }
    })
  , log = require('./log')
  , models = require('./models')
  , mongoose = require('mongoose')
  , services = require('./services')
  , utils = require('./utils');

log.info("connecting to mongodb instance: " + config.mongodb_connection_string);
mongoose.connect(config.mongodb_connection_string);

// only open endpoints when we have a connection to MongoDB.
mongoose.connection.once('open', function () {
    log.info("rebuildImage connected to mongodb.");

    models.ApiKey.find({}, {}, function(err, apiKeys) {
        if (err) return console.log('find failure: ' + err);

        apiKeys.forEach(function(apiKey) {
            log.info('requesting image build for key: ' + apiKey.key);

            jobs.create('build_image', { key: apiKey.key }).attempts(10).save();
        });

        process.exit(0);
    });

    mongoose.connection.on('error', log.error);
});