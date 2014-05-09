if (process.env.new_relic_app_name && process.env.new_relic_license_key) {
    require('newrelic');
}

var express = require('express')
  , app = express()
  , server = require('http').createServer(app)
  , BearerStrategy = require('passport-http-bearer').Strategy
  , config = require('./config')
  , controllers = require('./controllers')
  , ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn(config.user_login_path)
  , exphbs = require('express3-handlebars')
  , hbs = exphbs.create({ defaultLayout: 'main' })
  , LocalStrategy = require('passport-local').Strategy
  , log = require('./log')
  , middleware = require('./middleware')
  , models = require('./models')
  , mongoose = require('mongoose')
  , passport = require('passport')
  , path = require('path')
  , PublicKeyStrategy = require('passport-publickey').Strategy
  , services = require('./services')
  , utils = require('./utils');

log.info("connecting to mongodb instance: " + config.mongodb_connection_string);
mongoose.connect(config.mongodb_connection_string);

app.use(express.logger(config.request_log_format));
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({ secret: config.user_session_secret, cookie: { maxAge: config.user_session_timeout_seconds } }));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new BearerStrategy({}, services.accessTokens.verify));
passport.use(new LocalStrategy({ usernameField: 'email' }, services.principals.authenticateUser));
passport.use(new PublicKeyStrategy({}, services.principals.verifySignature));

app.use(middleware.crossOrigin);

app.enable('trust proxy');
app.disable('x-powered-by');

app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

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

        app.post(config.principals_path + '/publickey/auth', middleware.publicKeyAuth, controllers.principals.authenticate);
        app.post(config.principals_path + '/user/auth', middleware.userAuth,          controllers.principals.authenticate);


        app.get(config.principals_path + '/:id',   middleware.accessTokenAuth,        controllers.principals.show);
        app.get(config.principals_path,            middleware.accessTokenAuth,        controllers.principals.index);

        app.post(config.principals_path,                                              controllers.principals.create);
        app.post(config.principals_path + '/impersonate', middleware.accessTokenAuth, controllers.principals.impersonate);
        app.put(config.principals_path + '/:id',   middleware.accessTokenAuth,        controllers.principals.update);
        app.delete(config.principals_path + '/:id', middleware.accessTokenAuth,       controllers.principals.remove);

        app.get(config.messages_path + '/:id',     middleware.accessTokenAuth,        controllers.messages.show);
        app.get(config.messages_path,              middleware.accessTokenAuth,        controllers.messages.index);
        app.post(config.messages_path,             middleware.accessTokenAuth,        controllers.messages.create);
        app.delete(config.messages_path,           middleware.accessTokenAuth,        controllers.messages.remove);

        // OAuth2 and user management endpoints

        app.get(config.user_login_path,                                               controllers.users.showLogin);
        app.post(config.user_login_path, passport.authenticate('local', {
            successReturnToOrRedirect: 'https://admin.nitrogen.io',
            failureRedirect: config.user_login_path
        }));

        passport.serializeUser(function(user, done) {
          done(null, user);
        });

        passport.deserializeUser(function(user, done) {
          done(null, user);
        });

//        app.get(config.users_path + '/password',                             controllers.users.showChangePassword);
//        app.post(config.users_path + '/password', ensureLoggedIn, middleware.userAuth, controllers.users.changePassword);

//        app.get(config.users_path + '/reset', ensureLoggedIn,                controllers.users.showResetPassword);
//        app.post(config.users_path + '/reset', ensureLoggedIn,               controllers.users.resetPassword);

        app.get(config.users_path + '/authorize', ensureLoggedIn, controllers.users.authorize);
        app.post(config.users_path + '/decision', ensureLoggedIn, controllers.users.decision);

        app.get('/client/nitrogen.js', function(req, res) { res.send(services.messages.clients['nitrogen.js']); });
        app.get('/client/nitrogen-min.js', function(req, res) { res.send(services.messages.clients['nitrogen-min.js']); });

        log.info("service has initialized endpoints");

        app.use(express.static(path.join(__dirname, '/static')));

        mongoose.connection.on('error', log.error);
    });
});