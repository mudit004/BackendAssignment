require('dotenv').config();
const mysql = require('mysql');
module.exports = mysql.createConnection({
    host: process.env.MYSQL_HOST || "0.0.0.0",
    user: process.env.USER || "root",
    password: process.env.PASSWORD,
    database: "Library",
    port: process.env.MYSQL_PORT || 3306,
});
