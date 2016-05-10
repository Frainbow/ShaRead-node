var express = require('express');
var router = express.Router();
var multer = require('multer');
var upload = multer({ dest: __dirname + '/../public/uploads/' });
var loginHandler = require('./api-v1/login');
var storesHandler = require('./api-v1/stores');
var shelfsHandler = require('./api-v1/shelfs');
var booksHandler = require('./api-v1/books');
var mrtHandler = require('./api-v1/mrt');

/* GET api listing. */
router.get('/', function(req, res, next) {
    var obj = {
        message: "OK"
    };

    res.send(JSON.stringify(obj));
});

// login
router.post('/login', loginHandler.POST);
// stores
router.get('/stores', storesHandler.GET);
router.get('/stores/:store_id', storesHandler.GET_DETAIL);
router.get('/stores/:store_id/:item', storesHandler.GET_DETAIL);
router.post('/stores', storesHandler.POST);
router.post('/stores/:store_id/images', upload.single('store_image'), storesHandler.POST);
router.put('/stores/:store_id', storesHandler.PUT);
// shelves
router.get('/stores/:store_id/shelfs', shelfsHandler.GET);
router.post('/stores/:store_id/shelfs', shelfsHandler.POST);
router.put('/shelfs/:shelf_id', shelfsHandler.PUT);
// books
router.get('/books', booksHandler.GET);
router.get('/books/:book_id', booksHandler.GET_DETAIL);
router.get('/books/:book_id/images', booksHandler.GET_IMAGES);
router.post('/books', booksHandler.POST);
router.post('/books/:book_id/images', upload.single('book_image'), booksHandler.POST_IMAGES);
router.put('/books/:book_id', booksHandler.PUT);
router.delete('/books/:book_id', booksHandler.DELETE);
router.delete('/books/:book_id/images/:image_id', booksHandler.DELETE_IMAGES);
// mrt
router.get('/mrt', mrtHandler.GET);

module.exports = router;

