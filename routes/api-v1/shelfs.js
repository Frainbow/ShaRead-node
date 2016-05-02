var Promise = require('promise');
var config = require('./config');
var connPool = config.connPool;

var getHandler = function (req, res, next) {

    var token = req.query.auth_token;
    var store_id = req.params.store_id;

    if (token == undefined) {
        var obj = { message: "no token" };

        res.status(400).json(obj);
        return;
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

            connPool.query('select id, style, category from shelf where store_id = ?', [store_id], function (err, result) {

                if (err) {
                    reject({ message: err.code });
                    return;
                }

                var shelfs = []

                for (var i = 0; i < result.length; i++) {
                    shelfs.push({
                        id: result[i].id,
                        style: result[i].style,
                        category: result[i].category
                    });
                }

                resolve(shelfs);
            });
        });
    })
    .then(function (shelfs) {

        var obj = {
            "message": "OK",
            "data": shelfs 
        };

        res.status(200).json(obj);
    })
    .catch(function (error) {
        res.status(error.code || 500).json({ message: error.message });
        console.log('catch error', error);
    });
}

var postHandler = function (req, res, next) {

    var token = req.query.auth_token;
    var store_id = req.params.store_id;

    if (token == undefined) {
        var obj = { message: "no token" };

        res.status(400).json(obj);
        return;
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

            resolve({ user_id: result[0].id });
        });
    })
    .then(function (user) {
        // check store owner
        return new Promise(function (resolve, reject) {
            connPool.query('select id from store_list where store_id = ? and user_id = ?', [store_id, user.user_id], function (err, result) {

                if (err) {
                    reject({ message: err.code });
                    return;
                }

                if (result.length == 0) {
                    reject({ code: 403, message: 'invalid owner' });
                    return;
                }

                resolve();
            });
        });
    })
    .then(function () {

        return new Promise(function (resolve, reject) {
            var shelf = {
                store_id: store_id
            };

            if (req.body.style) {
                shelf.style = req.body.style
            }

            if (req.body.category) {
                shelf.category = req.body.category
            }

            connPool.query('insert into shelf set ?', [shelf], function (err, result) {

                if (err) {
                    reject({ message: err.code });
                    return;
                }

                resolve({ id: result.insertId });
            });
        });
    })
    .then(function (shelf) {

        var obj = {
            "message": "OK",
            "shelf_id": shelf.id
        };

        res.status(200).json(obj);
    })
    .catch(function (error) {
        res.status(error.code || 500).json({ message: error.message });
        console.log('catch error', error);
    });
}

var putHandler = function (req, res, next) {

    var token = req.query.auth_token;
    var shelf_id = req.params.shelf_id;
    var shelf = {};

    if (token == undefined) {
        var obj = { message: "no token" };

        res.status(400).json(obj);
        return;
    }

    if (req.body.style) {
        shelf.style = req.body.style;
    }

    if (req.body.category) {
        shelf.category = req.body.category;
    }

    if (Object.getOwnPropertyNames(shelf).length == 0) {
        var obj = { message: "no update colums" };

        res.status(400).json(obj);
        return;
    }

    new Promise(function (resolve, reject) {
        // check auth_token
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
        // check shelf owner
        return new Promise(function (resolve, reject) {
            connPool.query('select store_list.id from shelf, store_list where shelf.store_id = store_list.store_id and shelf.id = ? and store_list.user_id = ?', [shelf_id, user.user_id], function (err, result) {

                if (err) {
                    reject({ message: err.code });
                    return;
                }

                if (result.length == 0) {
                    reject({ code: 403, message: 'invalid owner' });
                    return;
                }

                resolve();
            });
        });
    })
    .then(function () {
        // update shelf
        return new Promise(function (resolve, reject) {

            connPool.query('update shelf set ? where id = ?', [shelf, shelf_id], function (err, result) {

                if (err) {
                    reject({ message: err.code });
                    return;
                }

                if (result.affectedRows == 0) {
                    reject({ code: 500, message: 'no affected rows' });
                    return;
                }

                resolve();
            });
        });
    })
    .then(function () {

        var obj = {
            "message": "OK"
        };

        res.status(200).json(obj);
    })
    .catch(function (error) {
        res.status(error.code || 500).json({ message: error.message });
        console.log('catch error', error);
    });
};

module.exports = {
    GET: getHandler,
    POST: postHandler,
    PUT: putHandler
}

