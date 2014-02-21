var async = require('async') 
  , config = require('../config')
  , log = require('../log')
  , models = require('../models')
  , services = require('../services')
  , utils = require('../utils');

var authorize = function(req, obj, callback) {
    var principalForId =  !req.principal_for ? "" : req.principal_for.id;

    log.debug('authorizing ' + req.principal.id + ' for action: ' + req.action + ' for principal: ' + principalForId + ' on object: ' + JSON.stringify(obj));
    permissionsFor(req.principal.id, function(err, permissions) {
        if (err) return callback(err);

        //permissions.forEach(function(permission) {
        //    log.info(JSON.stringify(permission));
        //});

        // look for a match in the sorted permissions and return that.
        // by default, actions are not authorized.
        // add a star permission at lowest priority to the default_permissions to override this default.

        async.detectSeries(permissions, function(permission, cb) {
            cb(permission.match(req, obj));
        }, function(permission) {

            // to simplify logic in callback, if no permission is found, callback with an
            // unauthorized permission.

            if (!permission) {
                permission = { 
                    authorized: false
                };
            }
            
            if (!permission.authorized) {
                log.warn('principal ' + req.principal.id + ' not authorized for action: ' + req.action + 
                         ' for principal: ' + principalForId + ' on object: ' + JSON.stringify(obj) + 
                         ' because of permission: ' + JSON.stringify(permission));
            }

            return callback(null, permission);
        });
    });
};

var create = function(authPrincipal, permission, callback) {
    if (!authPrincipal) return callback(utils.principalRequired());
    if (permission.authorized !== false && permission.authorized !== true) return callback(new Error('permission must have authorized.'));

    // TODO: is authPrincipal authorized to create this permission.

    log.info("permissions: creating permission: " + JSON.stringify(permission));
    permission.save(function(err, permission) {
        if (err) return callback(err);

        config.cache_provider.del('permissions', permission.issued_to, function(err) {
            if (err) return callback(err);

            if (permission.principal_for && (!permission.action || permission.action === 'view')) {
                services.principals.updateVisibleTo(permission.principal_for, function(err) {
                    return callback(err, permission);
                });   
            } else {
                return callback(null, permission);
            }
        });
    });
};

var filterForPrincipal = function(authPrincipal, filter) {
    // TODO: think through how permissions should be filtered, if at all.
    return filter;
};

var find = function(authPrincipal, filter, options, callback) {
    return models.Permission.find(filterForPrincipal(authPrincipal, filter), null, options, callback);
};

var findById = function(authPrincipal, permissionId, callback) {
    models.Permission.findOne(filterForPrincipal(authPrincipal, { "_id": permissionId }), callback);
};

var initialize = function(callback) {
    return callback();
};

var permissionsFor = function(principalId, callback) {
    config.cache_provider.get('permissions', principalId, function(err, permissions) {
        if (err) return callback(err);

        if (permissions) return callback(null, permissions);

        // TODO: this is a super broad query so we'll have to evaluate many many permissions.  
        // need to think about how to pull a more tightly bounded set of possible permissions for evaluation.
        var query = { 
            $or : [
                { issued_to: principalId }, 
                { principal_for: principalId },
                { issued_to: { $exists: false } },
                { principal_for: { $exists: false } } 
            ] 
        };

        find(services.principals.servicePrincipal, query, { sort: { priority: 1 } }, function(err, permissions) {
            if (err) return callback(err);

            config.cache_provider.set('permissions', principalId, permissions, utils.dateDaysFromNow(1), function(err) {
                return callback(err, permissions);
            });
        });
    });
};

var removeById = function(authorizingPrincipal, id, callback) {
    findById(authorizingPrincipal, id, function (err, permission) {
        if (err) return callback(err);

        services.principals.findById(authorizingPrincipal, permission.principal_for, function(err, principal) {
            if (err) return callback(err);
            if (!principal) return callback(utils.notFoundError());

            services.permissions.authorize({
                principal: authorizingPrincipal,
                principal_for: principal,
                action: 'admin'
            }, permission, function(err, permission) {

                 if (err) return callback(err);
                 if (!permission.authorized)  {
                    var authError = utils.authorizationError('You are not authorized to remove this permission.');
                    log.warn('permissions: removeById: auth failure: ' + JSON.stringify(authError));
                    
                    return callback(authError);
                 }

                 permission.remove(callback);
            });
        })
    });
};

var remove = function(authPrincipal, filter, callback) {
    // TODO: will need more complicated authorization mechanism for non service users.
    if (!authPrincipal || !authPrincipal.is('service')) return callback(utils.authorizationError());

    find(authPrincipal, filter, {}, function (err, permissions) {
        if (err) return callback(err);

        // invalidate cache entries
        async.eachLimit(permissions, 50, function(permission, cb) {
            permission.remove(function(err) {
                config.cache_provider.del('permissions', permission.issued_to, cb);
            });
        }, callback);
    });
};

var translate = function(obj) {
    if (obj.issued_to === 'service')
        obj.issued_to = services.principals.servicePrincipal.id;

    if (obj.principal_for === 'service')
        obj.principal_for = services.principals.servicePrincipal.id;

    return new models.Permission(obj);
};

module.exports = {
    authorize: authorize,
    create: create,
    find: find,
    initialize: initialize,
    permissionsFor: permissionsFor,
    remove: remove,
    removeById: removeById,
    translate: translate
};
