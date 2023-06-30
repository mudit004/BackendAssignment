require("dotenv").config();
const mysql = require("mysql");
module.exports = mysql.createConnection({
  host: process.env.MYSQL_HOST || "0.0.0.0",
  user: process.env.MYSQL_USER || "root",
  password: process.env.PASSWORD,
  database: process.env.Database,
  port: process.env.MYSQL_PORT || 3306,
});
