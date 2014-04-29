if (process.env.new_relic_app_name && process.env.new_relic_license_key) {
    require('newrelic');
}

var express = require('express')
  , app = express()
  , server = require('http').createServer(app)
  , BearerStrategy = require('passport-http-bearer').Strategy
  , config = require('./config')
  , controllers = require('./controllers')
  , LocalStrategy = require('passport-local').Strategy
  , log = require('./log')
  , middleware = require('./middleware')
  , models = require('./models')
  , mongoose = require('mongoose')
  , passport = require('passport')
  , path = require('path')
  , services = require('./services')
  , utils = require('./utils');

log.info("connecting to mongodb instance: " + config.mongodb_connection_string);
mongoose.connect(config.mongodb_connection_string);

app.use(express.logger(config.request_log_format));
app.use(express.bodyParser());

app.use(passport.initialize());
passport.use(new BearerStrategy({}, services.accessTokens.verify));
passport.use(new LocalStrategy({ usernameField: 'email' }, services.principals.authenticateUser));

app.use(middleware.crossOrigin);

app.enable('trust proxy');
app.disable('x-powered-by');

// only open endpoints when we have a connection to MongoDB.
mongoose.connection.once('open', function () {
    log.info("service connected to mongodb.");

    services.initialize(function(err) {
        if (err) return log.error("service failed to initialize: " + err);
        if (!services.principals.servicePrincipal) return log.error("Service principal not available after initialize.");

        server.listen(config.internal_port);
        services.subscriptions.attach(server);

        log.info("service has initialized itself, exposing api at: " + config.api_endpoint);

        // REST endpoints

        app.get(config.headwaiter_path,                                               controllers.headwaiter.index);

        if (config.blob_provider) {
            app.get(config.blobs_path + '/:id',    middleware.accessTokenAuth,        controllers.blobs.show);
            app.post(config.blobs_path,            middleware.accessTokenAuth,        controllers.blobs.create);
        } else {
            log.warn("not exposing blob endpoints because no blob provider configured (see config.js).");
        }

        app.get(config.ops_path + '/health',                                          controllers.ops.health);

        app.get(config.permissions_path,           middleware.accessTokenAuth,        controllers.permissions.index);
        app.post(config.permissions_path,          middleware.accessTokenAuth,        controllers.permissions.create);
        app.delete(config.permissions_path + '/:id', middleware.accessTokenAuth,      controllers.permissions.remove);

        // DEPRECIATED LEGACY AUTH ENDPOINT
        app.post(config.principals_path + '/auth',                                    controllers.principals.legacyAuthentication);

        //app.post(config.principals_path + '/publickey/auth', middleware.publicKeyAuth, controllers.principals.authenticate);
        app.post(config.principals_path + '/user/auth', middleware.userAuth,          controllers.principals.authenticate);

        app.get(config.principals_path + '/:id',   middleware.accessTokenAuth,        controllers.principals.show);
        app.get(config.principals_path,            middleware.accessTokenAuth,        controllers.principals.index);
        app.post(config.principals_path,                                              controllers.principals.create);
        app.post(config.principals_path + '/impersonate', middleware.accessTokenAuth, controllers.principals.impersonate);
        app.post(config.principals_path + '/reset',                                   controllers.principals.resetPassword);
        app.put(config.principals_path + '/:id',   middleware.accessTokenAuth,        controllers.principals.update);
        app.post(config.principals_path + '/password', middleware.accessTokenAuth, middleware.userAuth, controllers.principals.changePassword);
        app.delete(config.principals_path + '/:id', middleware.accessTokenAuth,       controllers.principals.remove);

        app.get(config.messages_path + '/:id',     middleware.accessTokenAuth,        controllers.messages.show);
        app.get(config.messages_path,              middleware.accessTokenAuth,        controllers.messages.index);
        app.post(config.messages_path,             middleware.accessTokenAuth,        controllers.messages.create);
        app.delete(config.messages_path,           middleware.accessTokenAuth,        controllers.messages.remove);

        app.get('/client/nitrogen.js', function(req, res) { res.send(services.messages.clients['nitrogen.js']); });
        app.get('/client/nitrogen-min.js', function(req, res) { res.send(services.messages.clients['nitrogen-min.js']); });

        app.use(express.static(path.join(__dirname, '/static')));

        log.info("service has initialized endpoints");

        mongoose.connection.on('error', log.error);
    });
});
