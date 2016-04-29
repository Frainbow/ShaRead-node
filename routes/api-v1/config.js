// Database
var mysql = require('mysql');
var mysqlPool = mysql.createPool({
    host: process.env.ShaDBHost,
    database: process.env.ShaDBName,
    user: process.env.ShaDBUser,
    password: process.env.ShaDBPassword
});

module.exports = {
    connPool: mysqlPool
};

