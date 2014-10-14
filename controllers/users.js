var async = require('async')
  , core = require('nitrogen-core');

var authorize = function(req, res) {
    var key = req.param('api_key');
    var app_id = req.param('app_id');
    var redirect_uri = req.param('redirect_uri');
    var scope = req.param('scope');

    core.services.apiKeys.check(key, redirect_uri, function(err, apiKey) {
        if (err) return core.utils.handleError(res, err);

        if (!app_id) return redirectWithError(res, redirect_uri, "app_id required for authorize");
        if (!scope) return redirectWithError(res, redirect_uri, "scope required for authorize");

        core.services.principals.findByIdCached(core.services.principals.servicePrincipal, app_id, function(err, app) {
            if (err) return redirectWithError(res, redirect_uri, err);
            if (!app) return redirectWithError(res, redirect_uri, "app_id referenced unknown application.");

            var authCode = core.models.AuthCode({
                api_key: apiKey.id,
                app: app_id,
                name: apiKey.name,
                user: req.user.id,
                scope: scope,
                redirect_uri: redirect_uri
            });

            core.services.authCodes.create(authCode, function(err, authCode) {
                if (err) return redirectWithError(res, redirect_uri, err);

                populateClauses(req, authCode.scope, function(err, scope) {
                    if (err) return redirectWithError(res, redirect_uri, err);

                    res.render('user/authorize', {
                        apiKey:             apiKey,
                        code:               authCode.code,
                        scope:              scope,
                        user_decision_path: core.config.user_decision_path
                    });
                });
            });
        });
    });
};

var englishActionMappings = {
    admin: "have administrative privileges",
    impersonate: "impersonate",
    send: "send messages to",
    subscribe: "receive messages from",
    view: "view and query metadata"
};

var populateClauses = function(req, scope, callback) {
    if (typeof scope === 'string') {
        try {
            scope = JSON.parse(scope);
        } catch(e) {
            callback('scope did not parse as JSON.');
        }
    }

    async.concat(scope, function(clause, clauseCallback) {
        core.services.principals.find(req.user, clause.filter, {}, function(err, clausePrincipals) {
            if (err) return callback(err);

            clause.principals = clausePrincipals;

            clause.actionsEnglish = "";

            if (clause.actions.length > 1) {
                for (var idx = 0; idx < clause.actions.length - 1; idx++) {
                    var action = clause.actions[idx];
                    clause.actionsEnglish += englishActionMappings[action];

                    if (clause.actions.length > 2)
                        clause.actionsEnglish += ', ';
                    else
                        clause.actionsEnglish += ' ';
                }

                clause.actionsEnglish += 'and ';
            }

            if (clause.actions.length > 0) {
                var action = clause.actions[clause.actions.length - 1];
                core.log.error('action: ' + action + ' mapping: ' + englishActionMappings[action]);

                clause.actionsEnglish += englishActionMappings[action];
            }

            return clauseCallback(null, [clause]);
        });
    }, callback);
};

var changePassword = function(req, res) {
    var currentPassword = req.param('currentPassword');
    var newPassword = req.param('newPassword');
    var newPasswordAgain = req.param('newPasswordAgain');

    if (!currentPassword || !newPassword || !newPasswordAgain) {
        return renderChangePasswordForm(res, 'Please fill out all three passwords before submitting.');
    }

    if (newPassword !== newPasswordAgain) {
        return renderChangePasswordForm(res, 'New password does not match confirmation, please try again.');
    }

    core.services.principals.authenticateUser(req.user.email, currentPassword, function(err, user) {
        if (err || !user) return renderChangePasswordForm(res, 'Please re-enter your current password and try again.');

        core.services.principals.changePassword(req.user, newPassword, function(err, principal, accessToken) {
            if (err) return core.utils.handleError(res, err);

            return renderLoginForm(res, 'Your password was changed: please login with your new password.');
        });
    });
};

var renderChangePasswordForm = function(res, error) {
    res.render('user/changePassword', {
        error: error,
        user_change_password_path: core.config.user_change_password_path
    });
};

var changePasswordForm = function(req, res) {
    return renderChangePasswordForm(res);
};

var create = function(req, res) {
    var name = req.param('name');
    var email = req.param('email');
    var password = req.param('password');

    if (!name || !email || !password) {
        return renderCreateForm(res, "Please enter your full name, an email, and a password.");
    }

    var user = new core.models.Principal({
        type: 'user',
        name: name,
        email: email,
        password: password
    });

    core.services.principals.create(user, function(err, user) {
        if (err) return renderCreateForm(res, err);

        return logInAndRedirect(req, res, user);
    });
};

var renderCreateForm = function(res, error) {
    res.render('user/create', {
        error: error,
        user_create_path: core.config.user_create_path,
        user_reset_password_path: core.config.user_reset_password_path,
        user_login_path: core.config.user_login_path
    });
};

var createForm = function(req, res) {
    if (core.config.max_new_users_per_day) {
        var measurementStart = moment().subtract('days', 1).toDate();

        core.services.principals.find(core.services.principals.servicePrincipal, {
            type: 'user',
            created_at: {
                $gt: measurementStart
            }
        }, function(err, principals) {
            if (principals.length > core.config.max_new_users_per_day) {
                return renderLoginForm(res, "Cannot create a new user right now due to overwhelming demand. Please try again later.");
            } else {
                return renderCreateForm(res);
            }
        });
    } else {
        return renderCreateForm(res);
    }
};

var deleteAccount = function(req, res) {
    core.services.principals.removeById(req.user, req.user.id, function(err) {
        if (err) return core.utils.handleError(res, err);

        return renderLoginForm(res, "Your account has been deleted. We'd love to hear your feedback about the service: please email us at feedback@nitrogen.io");
    });
};

var deleteAccountForm = function(req, res) {
    res.render('user/delete', {
        user_delete_account_path: core.config.user_delete_account_path,
        default_user_redirect: core.config.default_user_redirect
    });
};

var decision = function(req, res) {
    var code = req.param('code');
    var authorized = req.param('authorize') !== undefined;

    core.services.authCodes.check(code, req.user, function(err, authCode) {
        if (err) return core.utils.handleError(res, err);
        if (!authorized) return redirectWithError(res, authCode.redirect_uri, "Request not approved by user.");

        core.services.principals.findByIdCached(core.services.principals.servicePrincipal, authCode.app, function(err, app) {
            if (err) return redirectWithError(res, authCode.redirect_uri, err);
            if (!app) return redirectWithError(res, authCode.redirect_uri, "Application not found");

            populateClauses(req, authCode.scope, function(err, scope) {
                if (err) return redirectWithError(res, authCode.redirect_uri, err);

                async.each(scope, function(clause, clauseCallback) {
                    async.each(clause.actions, function(action, actionCallback) {
                        async.each(clause.principals, function(principal, principalCallback) {

                            var permission = new core.models.Permission({
                                action: action,
                                authorized: true,
                                issued_to: app.id,
                                principal_for: principal.id,
                                priority: core.models.Permission.DEFAULT_PRIORITY_BASE
                            });

                            core.log.info('oauth2 adding permission with action: ' + action + ' issued_to: ' + app.id + ' principal for: ' + principal.id);

                            core.services.permissions.create(req.user, permission, principalCallback);

                        }, actionCallback);
                    }, clauseCallback);
                }, function(err) {
                    redirectWithError(res, authCode.redirect_uri, err);
                });
            });
        });
    });
};

var impersonate = function(req, res) {
    var key = req.param('api_key');
    var redirect_uri = req.param('redirect_uri');

    core.services.apiKeys.check(key, redirect_uri, function(err, apiKey) {
        if (err) return core.utils.handleError(res, err);
        if (!apiKey.can('impersonate')) return redirectWithError(res, redirect_uri, "Impersonation of user not allowed.");

        return redirectWithSession(res, req.user, redirect_uri);
    });
};

var renderLoginForm = function(res, error) {
    res.render('user/login', {
        error: error,
        user_create_path: core.config.user_create_path,
        user_reset_password_path: core.config.user_reset_password_path,
        user_login_path: core.config.user_login_path
    });
};

var login = function(req, res) {
    var email = req.param('email');
    var password = req.param('password');

    if (!email || !password) {
        return renderLoginForm(res, "Please enter your email and password to login.");
    }

    core.services.principals.authenticateUser(email, password, function (err, user) {
        if (err || !user) return renderLoginForm(res, 'Either your email or password were not correct. Please try again.');

        return logInAndRedirect(req, res, user);
    });
};

var logInAndRedirect = function(req, res, user) {
    req.logIn(user, function(err) {
        if (err) return renderLoginForm(res, err);

        return res.redirect(req.session.returnTo || core.config.default_user_redirect);
    });
};

var loginForm = function(req, res) {
    return renderLoginForm(res);
};

var logout = function(req, res) {
    req.logout();

    return renderLoginForm(res, 'You have been signed out. Please login with your email and password.');
};

var privacy = function(req, res) {
    return res.render('user/privacy');
}

var redirectWithError = function(res, redirectUri, error) {
    var finalRedirectUri = redirectUri;
    if (error)
        finalRedirectUri += "?error=" + encodeURIComponent(error);

    res.redirect(finalRedirectUri);
};

var redirectWithSession = function(res, user, redirectUri) {
    core.services.accessTokens.findOrCreateToken(user, function (err, accessToken) {
        if (err) return redirectWithError(res, redirectUri, err);

        res.redirect(redirectUri + "?principal=" + encodeURIComponent(JSON.stringify(user.toJSON())) +
            "&accessToken=" + encodeURIComponent(JSON.stringify(accessToken.toJSON())));
    });
};

var resetPassword = function(req, res) {
    var email = req.param('email');

    if (!email) return renderResetPasswordForm(res, "Please enter an email to reset your password.");

    core.services.principals.find(core.services.principals.servicePrincipal, { email: email }, function(err, principals) {
        if (err) return renderResetPasswordForm(res, err);
        if (principals.length < 1) return renderResetPasswordForm(res, 'User with email "' + email + '" not found.');

        core.services.principals.resetPassword(core.services.principals.servicePrincipal, principals[0], function(err) {
            if (err) return core.utils.handleError(res, err);

            return renderLoginForm(res, 'Your password was reset: please check your email for instructions.');
        });
    });
};

var renderResetPasswordForm = function(res, error) {
    res.render('user/resetPassword', {
        error: error,
        user_create_path: core.config.user_create_path,
        user_reset_password_path: core.config.user_reset_password_path,
        user_login_path: core.config.user_login_path
    });
};

var resetPasswordForm = function(req, res) {
    renderResetPasswordForm(res);
};

var terms = function(req, res) {
    return res.render('user/terms');
}

module.exports = {
    authorize:              authorize,
    changePassword:         changePassword,
    changePasswordForm:     changePasswordForm,
    create:                 create,
    createForm:             createForm,
    deleteAccount:          deleteAccount,
    deleteAccountForm:      deleteAccountForm,
    decision:               decision,
    impersonate:            impersonate,
    login:                  login,
    loginForm:              loginForm,
    logout:                 logout,
    privacy:                privacy,
    resetPassword:          resetPassword,
    resetPasswordForm:      resetPasswordForm,
    terms:                  terms
};