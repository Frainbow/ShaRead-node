var FB = require('fb');
var Promise = require('promise');
var md5 = require('md5');
var config = require('./config');
var connPool = config.connPool;
var postHandler = function(req, res, next) {
    var facebook_token = req.body.facebook_token;
    var firebase_uid = req.body.firebase_uid || '';

    if (facebook_token) {

        new Promise(function (resolve, reject) {
            FB.setAccessToken(facebook_token);
            FB.api('me', { fields: ['id', 'name', 'email', 'picture'] }, function (res) {

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
                    fb_avatar: value.picture.data.url,
                    auth_token: token,
                    firebase_uid: firebase_uid
                };

                var update = {
                    name: value.name,
                    fb_avatar: value.picture.data.url,
                    auth_token: token,
                    firebase_uid: firebase_uid
                };

                connPool.query('insert into user set ? on duplicate key update ?', [user, update], function (err, result) {

                    if (err) {
                        reject({ message: err.code });
                        return;
                    }

                    user.id = result.insertId;

                    resolve(user);
                });
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

