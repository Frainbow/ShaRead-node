var Promise = require('promise');
var request = require('request');
var MRTStation;

var getHandler = function (req, res, next) {

    new Promise(function (resolve, reject) {

        if (MRTStation) {
            resolve(MRTStation);
            return;
        }

        request('http://data.taipei/opendata/datalist/apiAccess?scope=resourceAquire&rid=7c7875a3-cfed-4d32-8cde-5ad22f237265', { timeout: 5 * 1000}, function (err, response, body) {

            if (err) {
                reject({ message: err });
                return;
            }


            var result = JSON.parse(body).result;
            var station = {};

            if (result && result.results) {
                var list = result.results;

                for (var i = 0; i < list.length; i++) {
                    var fullname = list[i]['出入口名稱'].split('出口');

                    if (fullname.length >= 2)
                        fullname[1] = '出口' + fullname[1];

                    if (fullname.length == 1) {
                        fullname = list[i]['出入口名稱'].split('M');

                        if (fullname.length >= 2)
                            fullname[1] = 'M' + fullname[1];
                    }

                    var name = fullname[0];
                    var exit = {
                        exit: fullname.length >= 2 ? fullname[1] : '0',
                        longitude: parseFloat(list[i]['經度']),
                        latitude: parseFloat(list[i]['緯度'])
                    };

                    if (station[name] == undefined)
                        station[name] = [];

                    station[name].push(exit);
                }

                for (var name in station) {
                    station[name].sort(function (a, b) {
                        if (a.exit > b.exit)
                            return 1;
                        if (a.exit < b.exit)
                            return -1;
                        return 0;
                    });
                }

                MRTStation = station;
                resolve(MRTStation);
                return;
            }

            reject({ message: "parse response body failed"});
        });
    })
    .then(function (station) {

        var obj = {
            "message": "OK",
            "data": station
        };

        res.status(200).json(obj);
    })
    .catch(function (error) {
        res.status(error.code || 500).json({ message: error.message });
        console.log('catch error', error);
    });
}

module.exports = {
    GET: getHandler
}

