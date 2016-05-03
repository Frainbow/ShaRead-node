var Promise = require('promise');
var config = require('./config');
var connPool = config.connPool;
var request = require('request');
var fs = require('fs');
var mkdirp = require('mkdirp');

var getHandler = function (req, res, next) {

    var token = req.query.auth_token;

    if (token == undefined) {
        var obj = { message: "no token" };

        res.status(400).json(obj);
        return
    }

}

var postHandler = function (req, res, next) {
    var token = req.query.auth_token
    var isbn = req.body.isbn;
    var user_id = 0;

    if (token == undefined) {
        var obj = { message: "no token" };

        res.status(400).json(obj);
        return;
    }

    if (isbn == undefined) {
        var obj = { message: "no necessary colums" };

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

            user_id = result[0].id;

            resolve();
        });
    })
    .then(function () {

        return new Promise(function (resolve, reject) {
            // get isbn
            connPool.query('select * from book where isbn = ?', [isbn], function (err, result) {

                if (err) {
                    reject({ message: err.code });
                    return;
                }

                var books = []

                for (var i = 0; i < result.length; i++) {
                    books.push({
                        id: result[i].id,
                        isbn: result[i].isbn,
                        name: result[i].name,
                        author: result[i].author,
                        publisher: result[i].publisher,
                        publish_date: result[i].publish_date,
                        price: result[i].price
                    });
                }

                resolve(books);
            });
        });
    })
    .then(function (books) {

        if (books.length > 0) {
            return books;
        }

        return new Promise(function (resolve, reject) {
            var yql = "select * from html where url='http://search.books.com.tw/exep/prod_search.php?key="+ isbn +"&cat=all' and xpath='//*[@id=\"searchlist\"]/ul'"
            var param = {
                q: yql,
                format: 'json'
            };

            request({ url: 'https://query.yahooapis.com/v1/public/yql', qs: param }, function (err, response, body) {

                if (err) {
                    reject({ message: err });
                    return;
                }

                try {
                    var results = JSON.parse(body).query.results;
                    var li_tag = results.ul.li

                    function parseContent(root) {
                        var name = root.h3.a.content;
                        var author = [];
                        var publisher = [];
                        var date;
                        var match = root.content.match(/(\d+)-(\d+)-(\d+)/);
                        var price;
                        var image;

                        if (match && match.length > 0)
                            date = match[0]; 

                        if (root.a instanceof Array) {
                            for (var i = 0; i < root.a.length; i++) {
                                var a_tag = root.a[i];

                                if (a_tag.rel) {
                                    if (a_tag.rel.indexOf('author') >= 0) {
                                        author.push(a_tag.content);
                                    } else if (a_tag.rel.indexOf('publish') >= 0) {
                                        publisher.push(a_tag.content);
                                    } else if (a_tag.rel.indexOf('image') >= 0) {
                                        image = a_tag.img['data-original'];
                                    }
                                }
                            }
                        }

                        if (root.span instanceof Array) {
                            for (var i = 0; i < root.span.length; i++) {
                                if (root.span[i].class == "price") {
                                    if (root.span[i].b)
                                        price = root.span[i].b
                                    else if (root.span[i].strong && root.span[i].strong.b instanceof Array)
                                        price = root.span[i].strong.b[1];
                                    else if (root.span[i].strong && root.span[i].strong.b)
                                        price = root.span[i].strong.b
                                }
                            }
                        }

                        books.push({
                            isbn: isbn,
                            name: name,
                            author: author.join(', '),
                            publisher: publisher.join(', '),
                            publish_date: date,
                            price: price,
                            image_path: image
                        });
                    }

                    if (li_tag instanceof Array) {
                        for (var i = 0; i < li_tag.length; i++) {
                            parseContent(li_tag[i]);
                        }
                    } else {
                        parseContent(li_tag);
                    }

                    if (books.length > 0) {
                        resolve(books);
                    } else {
                        reject({ code: 400, message: 'isbn not found' });
                    }
                } catch(err) {

                    reject({ message: err.message });
                }
            });
        });
    })
    .then(function (books) {

        if (books.length == 0 || books[0].id) {
            return books;
        }

        // update to database
        return new Promise(function (resolve, reject) {

            function insertTable(index) {

                if (index >= books.length) {
                    resolve(books);
                    return;
                }

                connPool.query('insert into book set ?', [books[index]], function (err, result) {

                    if (err) {
                        reject({ message: err.code });
                        return;
                    }

                    books[index].id = result.insertId;
                    insertTable(index + 1);
                });
            }

            insertTable(0);
        });
    })
    .then(function (books) {

        return new Promise(function (resolve, reject) {

            function getBookID(index) {

                if (index >= books.length) {
                    resolve(books);
                    return;
                }

                var book_list = {
                    book_id: books[index].id,
                    user_id: user_id
                };

                connPool.query('select id from book_list where book_id = ? and user_id = ?', [book_list.book_id, book_list.user_id], function (err, result) {

                    if (err) {
                        reject({ message: err.code });
                        return;
                    }

                    if (result.length == 0) {

                        connPool.query('insert into book_list set ?', [book_list], function (err, result) {

                            if (err) {
                                reject({ message: err.code });
                                return;
                            }

                            books[index].id = result.insertId;
                            getBookID(index + 1);
                        });

                        return;
                    }

                    books[index].id = result[0].id;
                    getBookID(index + 1);
                });
            }

            getBookID(0);
        });
    })
    .then(function (books) {
        var obj = {
            "message": "OK",
            "data": books
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
    var book_id = req.params.book_id;
    var book = {};

    if (token == undefined) {
        var obj = { message: "no token" };

        res.status(400).json(obj);
        return;
    }

    if (req.body.rent) {
        book.rent = req.body.rent;
    }

    if (req.body.comment) {
        book.comment = req.body.comment;
    }

    if (req.body.status) {
        book.status = req.body.status;
    }

    if (req.body.category) {
        book.category = req.body.category;
    }

    if (req.body.style) {
        book.style = req.body.style;
    }

    if (Object.getOwnPropertyNames(book).length == 0) {
        var obj = { message: "no update colums" };

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

        return new Promise(function (resolve, reject) {

            connPool.query('update book_list set ? where id = ? and user_id = ?', [book, book_id, user.user_id], function (err, result) {

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

