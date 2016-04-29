var express = require('express');
var router = express.Router();
var loginHandler = require('./api-v1/login');

/* GET api listing. */
router.get('/', function(req, res, next) {
    var obj = {
        message: "OK"
    };

    res.send(JSON.stringify(obj));
});

router.post('/login', loginHandler);

module.exports = router;

