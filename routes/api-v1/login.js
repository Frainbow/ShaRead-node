var FB = require('fb');
var Promise = require('promise');
var md5 = require('md5');
var config = require('./config');
var connPool = config.connPool;
var postHandler = function(req, res, next) {
    var facebook_token = req.body.facebook_token;

    if (facebook_token) {

        new Promise(function (resolve, reject) {
            FB.setAccessToken(facebook_token);
            FB.api('me', { fields: ['id', 'name', 'email'] }, function (res) {

                if (!res) {
                    reject({ message: 'error occurred' });
                    return;
                }

                if (res.error && res.error.code == 190) {
                    reject({ code: 403, message: "invalid token" });
                    return;
                }

                if (res.error) {
                    reject({ message: res.error.message });
                    return;
                }

                resolve(res);
            });
        })
        .then(function (value) {

            return new Promise(function (resolve, reject) {
                var token = md5(value.email.toLocaleLowerCase() + Math.random());
                var user = {
                    email: value.email.toLocaleLowerCase(),
                    name: value.name,
                    auth_token: token
                };

                connPool.query('insert into user set ?', user, function (err, result) {

                    if (err) {
                        if (err.code == "ER_DUP_ENTRY") {
                            resolve(user);
                        } else {
                            reject({ message: err.code });
                        }
                        return;
                    }

                    user.id = result.insertId;

                    resolve(user);
                });
            });
        })
        .then(function (user) {

            if (user.id) {
                return value;
            }

            return new Promise(function (resolve, reject) {

                connPool.query('select id, auth_token from user where email = ?',
                    [user.email],
                    function (err, results, fields) {

                        if (err) {
                            reject({ message: err.code });
                            return;
                        }

                        if (results.length > 0) {
                            user.id = results[0].id;
                            user.auth_token = results[0].auth_token;
                            resolve(user);
                        } else {
                            reject({ message: 'empty result' });
                        }
                    }
                );
            });
        })
        .then(function (user) {

            var obj = {
                message: "OK",
                user_id: user.id,
                auth_token: user.auth_token
            };

            res.status(200).json(obj);
        })
        .catch(function (error) {
            res.status(error.code || 500).json({ message: error.message });
            console.log('catch error', error);
        });
    }
    else {
        var obj = { message: "no token" };

        res.status(400).json(obj);
    }
};

module.exports = {
    POST: postHandler
}

