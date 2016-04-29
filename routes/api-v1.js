var express = require('express');
var router = express.Router();
var FB = require('fb');
var Promise = require('promise');
var md5 = require('md5');

// Database
var mysql = require('mysql');
var mysqlPool = mysql.createPool({
    host: process.env.ShaDBHost,
    database: process.env.ShaDBName,
    user: process.env.ShaDBUser,
    password: process.env.ShaDBPassword
});

/* GET api listing. */
router.get('/', function(req, res, next) {
    var obj = {
        message: "OK"
    };

    res.send(JSON.stringify(obj));
});

router.post('/login', function(req, res, next) {
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
                var token = md5(Math.random());
                var user = {
                    email: value.email.toLocaleLowerCase(),
                    name: value.name,
                    auth_token: token
                };

                mysqlPool.query('insert into user set ?', user, function (err, result) {

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

                mysqlPool.query('select id, auth_token from user where email = ?',
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

            res.status(200)
            res.send(JSON.stringify(obj));
        })
        .catch(function (error) {
            res.status(error.code || 500);
            res.send(JSON.stringify({ message: error.message }));
            console.log('catch error', error);
        });
    }
    else {
        var obj = { message: "no token" };

        res.status(400);
        res.send(JSON.stringify(obj));
    }
});

module.exports = router;

