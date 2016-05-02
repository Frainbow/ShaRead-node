var Promise = require('promise');
var config = require('./config');
var connPool = config.connPool;
var fs = require('fs');
var mkdirp = require('mkdirp');

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

            connPool.query('select store.id, store.name, store.description from store, store_list where store.id = store_list.store_id and store_list.user_id = ?', [user.user_id], function (err, result) {

                if (err) {
                    reject({ message: err.code });
                    return;
                }

                var stores = []

                for (var i = 0; i < result.length; i++) {
                    stores.push({
                        store_id: result[i].id,
                        store_name: result[i].name,
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

    var token = req.query.auth_token;
    var store_id = req.params.store_id;
    var conn;

    if (store_id) {
        postImageHandler(req, res, next);
        return;
    }

    if (token == undefined) {
        var obj = { message: "no token" };

        res.status(400).json(obj);
        return;
    }

    new Promise(function (resolve, reject) {

        connPool.getConnection(function (err, connection) {

            if (err) {
                reject({ message: err.code });
                return;
            }

            conn = connection;
            resolve();
        });
    })
    .then(function () {

        return new Promise(function (resolve, reject) {
            // get user_id
            conn.query('select id from user where auth_token = ?', [token], function (err, result) {

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
        });
    })
    .then(function (user) {
        // begin transaction
        return new Promise(function (resolve, reject) {
            conn.beginTransaction(function (err) {

                if (err) {
                    reject({ message: err.code });
                    return;
                }

                resolve(user);
            });
        });
    })
    .then(function (user) {

        return new Promise(function (resolve, reject) {
            var store = {};

            if (req.body.store_name) {
                store.name = req.body.store_name
            }

            conn.query('insert into store set ?', [store], function (err, result) {

                if (err) {
                    reject({ rollback: true, message: err.code });
                    return;
                }

                resolve({
                    user_id: user.user_id,
                    store_id: result.insertId
                });
            });
        });
    })
    .then(function (list) {

        return new Promise(function (resolve, reject) {

            conn.query('insert into store_list set ?', [list], function (err, result) {

                if (err) {
                    reject({ rollback: true, message: err.code });
                    return;
                }

                resolve(list);
            });
        });
    })
    .then(function (list) {
        // commit
        return new Promise(function (resolve, reject) {

            conn.commit(function (err) {
                if (err) {
                    reject({ rollback: true, message: err.code });
                    return;
                }

                resolve(list);
            });
        });
    })
    .then(function (list) {

        var obj = {
            "message": "OK",
            "store_id": list.store_id
        };

        res.status(200).json(obj);
    })
    .catch(function (error) {

        if (error.rollback) {
            conn.rollback(function () {
                if (conn) {
                    conn.release();
                    conn = null;
                }
            });
        }
        else if (conn) {
            conn.release();
            conn = null;
        }

        res.status(error.code || 500).json({ message: error.message });
        console.log('catch error', error);
    });
}

var postImageHandler = function (req, res, next) {

    var token = req.query.auth_token;
    var store_id = req.params.store_id;

    if (token == undefined) {
        var obj = { message: "no token" };

        res.status(400).json(obj);
        return
    }

    if (!req.file) {
        var obj = { message: "no file" };

        res.status(400).json(obj);
        return
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
        // save store image to disk
        var image_name = 'store_image.jpg';
        var image_folder = '/images/stores/' + store_id;
        var image_path = image_folder + '/' + image_name;
        var source_path = req.file.path;
        var target_folder = __dirname + '/../../public' + image_folder
        var target_path = target_folder + '/' + image_name;

        return new Promise(function (resolve, reject) {

            mkdirp(target_folder, function (err) {

                if (err) {
                    reject({ message: "mkdirp failed" });
                    return;
                }

                fs.rename(source_path, target_path, function (err) {

                    if (err) {
                        reject({ message: err.code });
                        return;
                    }

                    resolve({ image_path: config.imageHost + image_path + '?' + req.file.filename });
                });
            });
        });
    })
    .then(function (store) {
        // update store image path to DB
        return new Promise(function (resolve, reject) {

            connPool.query('update store set ? where id = ?', [store, store_id], function (err, result) {

                if (err) {
                    reject({ message: err.code });
                    return;
                }

                if (result.affectedRows == 0) {
                    reject({ code: 500, message: 'no affected rows' });
                    return;
                }

                resolve(store);
            });
        });
    })
    .then(function (store) {

        var obj = {
            "message": "OK",
            "image_path": store.image_path
        };

        res.status(200).json(obj);
    })
    .catch(function (error) {

        if (req.file.path) {
            fs.unlink(req.file.path, function (err) {});
        }

        res.status(error.code || 500).json({ message: error.message });
        console.log('catch error', error);
    });
};

var putHandler = function (req, res, next) {

    var token = req.query.auth_token;
    var store_id = req.params.store_id;
    var store = {};

    if (token == undefined) {
        var obj = { message: "no token" };

        res.status(400).json(obj);
        return;
    }

    if (req.body.store_name) {
        store.name = req.body.store_name;
    }

    if (req.body.description) {
        store.description = req.body.description;
    }

    if (req.body.address) {
        store.address = req.body.address;
    }

    if (req.body.longitude) {
        store.longitude = req.body.longitude;
    }

    if (req.body.latitude) {
        store.latitude = req.body.latitude;
    }

    if (Object.getOwnPropertyNames(store).length == 0) {
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
        // update store
        return new Promise(function (resolve, reject) {

            connPool.query('update store set ? where id = ?', [store, store_id], function (err, result) {

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

