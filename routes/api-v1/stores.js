var Promise = require('promise');
var config = require('./config');
var connPool = config.connPool;

var getHandler = function (req, res, next) {

    var token = req.query.auth_token

    if (token == undefined) {
        var obj = { message: "no token" };

        res.status(400).json(obj);
        return
    }

    new Promise(function (resolve, reject) {
        // get user_id
        connPool.query('select id from user where auth_token = ?', [token], function (err, result) {

            if (err) {
                reject({ message: err.code });
                return;
            }

            if (result.length == 0) {
                reject({ code: 403, message: "invalid token" });
                return;
            }

            resolve({ user_id: result[0].id })
        });
    })
    .then(function (user) {

        return new Promise(function (resolve, reject) {

            connPool.query('select * from store, store_list where store.id = store_list.store_id and store_list.user_id = ?', [user.user_id], function (err, result) {

                if (err) {
                    reject({ message: err.code });
                    return;
                }

                var stores = []

                for (var i = 0; i < result.length; i++) {
                    stores.append({
                        store_id: result[i].id,
                        store_name: result[i].store_name,
                        description: result[i].description
                    });
                }

                resolve(stores);
            });
        });
    })
    .then(function (stores) {

        var obj = {
            "message": "OK",
            "data": stores
        };

        res.status(200).json(obj);
    })
    .catch(function (error) {
        res.status(error.code || 500).json({ message: error.message });
        console.log('catch error', error);
    });
}

var postHandler = function (req, res, next) {
    console.log('handler post');
}

module.exports = {
    GET: getHandler,
    POST: postHandler
}

