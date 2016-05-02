var express = require('express');
var router = express.Router();
var multer = require('multer');
var upload = multer({ dest: __dirname + '/../public/uploads/' });
var loginHandler = require('./api-v1/login');
var storesHandler = require('./api-v1/stores');

/* GET api listing. */
router.get('/', function(req, res, next) {
    var obj = {
        message: "OK"
    };

    res.send(JSON.stringify(obj));
});

router.post('/login', loginHandler.POST);
router.get('/stores', storesHandler.GET);
router.post('/stores', storesHandler.POST);
router.post('/stores/:store_id/images', upload.single('store_image'), storesHandler.POST);
router.put('/stores/:store_id', storesHandler.PUT);

module.exports = router;

