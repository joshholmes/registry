var async = require('async')
  , models = require('../models')
  , services = require('../services');

exports.up = function(callback) {
    var dedupedPermissions = {};
    services.permissions.find(services.principals.servicePrincipal, {}, { limit: 100000 }, function(err, permissions) {
        if (err) return callback(err);

        console.log("total of " + permissions.length + " permissions before dedup'ing.");
        permissions.forEach(function(permission) {
            var key = permission.issued_to + "_" + 
                      permission.principal_for + "_" + 
                      permission.action + "_" + 
                      permission.permission + "_" +
                      permission.filter;
            dedupedPermissions[key] = JSON.stringify(permission);
        });

        services.permissions.remove(services.principals.servicePrincipal, {}, function(err) {
            if (err) return callback(err);

            async.each(Object.keys(dedupedPermissions), function(key, eachCB) {
                var jsonString = dedupedPermissions[key];
                console.log('json string permission: ' + jsonString);                
                var json = JSON.parse(jsonString);

                delete json.id;
                delete json.created_at;                

                console.log('creating deduped permission: ' + JSON.stringify(json));
                var permission = new models.Permission(json);

                permission.save(eachCB);
            }, callback);
        })
    });
};

// exports.down = function(callback) {
//    callback();
// };
