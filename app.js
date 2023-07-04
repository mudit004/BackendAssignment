const express = require("express");
require("dotenv").config();
var path = require("path");
const app = express();
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const db = require("./database.js");
const jwt = require("jsonwebtoken");
const { error } = require("console");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
//setup public folder
app.use(express.static("./public"));
// connecting to port

app.listen(3000, (error) => {
  if (!error) {
    console.log("Server Succesfully connected to PORT: 3000");
  } else {
    console.log("Error in connecting to server " + error.Error);
  }
});

// HOME PAGE
app.get("/", (req, res) => {
  res.render("Hello World");
});

//LOGIN Page

function saltGen() {
  const saltRounds = 10;
  const salt = bcrypt.genSaltSync(saltRounds);
  return salt;
}

function hashpassword(pass, salt) {
  let a = pass;
  let b = salt;
  const hashPWD = bcrypt.hashSync(a, b);
}
function messages(req, res, next) {
  var message;
  res.locals.message = message;
  next();
}

app.get("/login", messages, (req, res) => {
  res.render("loginPage");
});
app.post("/login", (req, res) => {
  var usrname = req.body.username;
  var pwd = req.body.pwd;

  let cmd = ` SELECT salt, hash, userID, admin from user where Uname=${db.escape(
    usrname
  )};`;
  db.query(cmd, async (error, results, fields) => {
    console.log(results);
    if (error) {
      res.send("User Not Found");
    } else {
      let hash = bcrypt.hashSync(pwd, results[0].salt);
      if (hash === results[0].hash) {
        let userID = results[0].userID;
        let isAdmin = results[0].admin;
        console.log(`${usrname} logged in`);
        //JWT Authentication
        const creds = { userID: userID, userName: usrname, admin: isAdmin };
        const token = jwt.sign(creds, process.env.ACCESS_TOKEN_SECRET);
        res.cookie("token", token, {
          maxAge: 360000,
        });

        //END of JWT
        if (results[0].admin === 1) {
          res.redirect("/dashboard");
        } else {
          res.redirect("/browse");
        }
      } else if (hash !== results[0].hash) {
        console.log(`Incorrect login attempt for ${usrname}`);
        res.send("Incorrect ID or PWD");
      } else {
        console.log("Some Unexpected Error Occured!");
      }
    }
  });
});

app.get("/register", (req, res) => {
  res.render("Register");
});
app.post("/register", async (req, res) => {
  let username = req.body.username;
  let password = req.body.password;
  let passwordC = req.body.confirmPassword;
  let saltReg = saltGen();
  console.log(saltReg);
  var hashReg = await bcrypt.hashSync(password, saltReg);
  db.query(
    "select * from user where Uname = " + db.escape(username) + ";",
    (err, result, field) => {
      if (err) {
        throw err;
      } else {
        if (result[0] === undefined) {
          if (password === passwordC) {
            db.query(
              `INSERT INTO user (uname,HASH,salt,ADMIN) VALUES(${db.escape(
                username
              )},'${hashReg}', '${saltReg}', 0);`
            );
            res.render("loginPage");
          } else if (password !== passwordC) {
            res.send("Passwords didn't match");
          } else {
            res.send("Password must not be empty");
          }
        } else {
          res.send("Username is not unique");
        }
      }
    }
  );
});
function validation(req, res, next) {
  // JWT Middleware
  // console.log(req.headers.cookie.slice(6));
  const accessToken = req.headers.cookie.slice(6);

  if (accessToken == null) {
    res.render("loginPage");
  } else {
    jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
      console.log(err);
      if (err) return res.render("loginPage");
      req.user = user;
      next();
    });
  }
}
//function to verify it's admin for admin specific routes
function isAdmin(req, res, next) {
  if (req.user.admin === 1) {
    next();
  } else {
    res.status(403).send({ msg: "Not Authenticated" });
  }
}

function renderBrowse(req, res) {
  let q1 = `Select * from books where quantity>0;`;
  var obj = {};
  db.query(q1, (err, results, field) => {
    if (err) {
      throw err;
    } else {
      let q2 = `Select * from request where UID=${db.escape(req.userID)}`;
      db.query(q2, (errors, result, fields) => {
        if (errors) {
          throw errors;
        } else {
          obj = {
            bookList: results,
            reqList: result,
          };

          res.render("browse", obj);
        }
      });
    }
  });
}
app.get("/browse", validation, (req, res) => {
  renderBrowse(req, res);
});
app.post("/user_side/checkin", validation, (req, res) => {
  let checkInReq = req.body.checkInID;
  let user = res.user.userID;
  console.log("identified user is" + user);
  console.log(user);
  let checker = `select * from request where bookID=${db.escape(
    checkInReq
  )} and UID=${db.escape(user)};`;
  let quanOfBook = 0;
  db.query(checker, (erro, resul, fiel) => {
    if (resul === undefined) {
      let q1 = `select quantity from books where bookID=${db.escape(
        checkInReq
      )};`;
      db.query(q1, (err, result, field) => {
        if (err) {
          throw err;
        } else {
          console.log(result[0].quantity);
          quanOfBook = result[0].quantity;
          console.log(quanOfBook);
        }

        if (quanOfBook > 0) {
          let q2 = `Insert into request (UID, BookID, Status) values (${db.escape(
            user
          )}, ${db.escape(checkInReq)}, 0)`;
          db.query(q2, (err, result, fields) => {
            let q3 = `Update books set quantity = quantity-1 where bookID = ${db.escape(
              checkInReq
            )}`;
            db.query(q3, (error, result, field) => {
              renderBrowse(req, res);
            });
          });
        } else {
          res.send("Book Not Available");
        }
      });
    } else {
      renderBrowse(req, res);
    }
  });
});

app.post("/user_side/checkout", validation, (req, res) => {
  var checkOutReq = req.body.checkInID;
  var user = req.user.userID;
  console.log(user);
  let q1 = `Update request Set status = 2 where UID = ${db.escape(
    user
  )} AND BookID = ${db.escape(checkOutReq)};`;
  db.query(q1, () => {
    renderBrowse(req, res);
  });
});

function renderDashboard(req, res) {
  let q1 = "Select * from books";
  var obj = {};
  db.query(q1, (err, results, field) => {
    if (err) {
      throw err;
    } else {
      let q2 = `Select * from request where Status=0 or status=2`;
      db.query(q2, (errors, result, fields) => {
        if (errors) {
          throw errors;
        } else {
          obj = {
            bookList: results,
            reqList: result,
          };

          res.render("dashboard", obj);
        }
      });
    }
  });
}
app.get("/dashboard", validation, isAdmin, (req, res) => {
  renderDashboard(req, res);
});
app.post("/admin_side/accept", validation, isAdmin, (req, res) => {
  var acceptUID = req.body.requestUID;
  var acceptBID = req.body.requestBID;
  let userReq;
  let q1 = `Select status from request where UID = ${db.escape(
    acceptUID
  )} and BookID = ${db.escape(acceptBID)};`;
  db.query(q1, (err, result, fields) => {
    console.log(result[0].status);
    if (err) {
      res.send("userid or bookid not found");
    } else {
      if (result[0].status === 0) {
        console.log("0 identified");
        userReq = Number(0);
      } else if (result[0].status === 2) {
        userReq = Number(2);
      } else {
        res.send("userid or bookid not found");
        return;
      }
    }
    var updateduserReq = userReq + 1;
    let q2 = `Update request set status = ${db.escape(
      updateduserReq
    )} where BookID = ${db.escape(acceptBID)} and UID = ${db.escape(
      acceptUID
    )};`;
    db.query(q2, (error, result, fields) => {
      if (userReq == 2) {
        let q3 = `Update books set quantity = quantity+1 where bookID = ${db.escape(
          acceptBID
        )};`;
        db.query(q3, (error, result, fields) => {
          if (error) {
            throw error;
          }
        });
      }
      renderDashboard(req, res);
    });
  });
});

app.post("/admin_side/reject", validation, isAdmin, async (req, res) => {
  let rejectUID = req.body.requestUID;
  let rejectBID = req.body.requestBID;
  let userReq;
  let q1 = `Select status from request where UID = ${db.escape(
    rejectUID
  )} and BookID = ${db.escape(rejectBID)};`;
  db.query(q1, (err, result, fields) => {
    console.log(result[0].status);
    if (err) {
      throw err;
    } else {
      if (result[0].status === 0) {
        console.log("0 identified");
        userReq = Number(0);
      } else if (result[0].status === 2) {
        console.log("2 identified");
        userReq = Number(2);
      }
    }

    let q2 = `Delete from request where BookID=${db.escape(
      rejectBID
    )} and UID=${db.escape(rejectUID)};`;
    db.query(q2, (error, result, fields) => {
      if (userReq === 0) {
        console.log("0 under process");
        let q3 = `Update books set quantity = quantity+1 where bookID = ${db.escape(
          rejectBID
        )};`;
        db.query(q3, (error, result, fields) => {
          renderDashboard(req, res);
        });
      }
    });
  });
});

app.post("/addbook", validation, isAdmin, (req, res) => {
  let bookname = req.body.bookname;
  let quantity = Number(req.body.quantity);
  console.log(req.body.quantity);
  if (quantity > 0) {
    let q1 = `Select bookID from books where BookName=${db.escape(bookname)};`;
    db.query(q1, (err, result, field) => {
      if (!(result[0] == undefined)) {
        let q2 = `update books set quantity = ${db.escape(
          quantity
        )} where BookName=${db.escape(bookname)};`;
        db.query(q2, (error, result, fields) => {
          if (error) {
            throw error;
          } else {
            renderDashboard(req, res);
          }
        });
      } else {
        let q3 = `Insert into books (BookName, quantity) values (${db.escape(
          bookname
        )}, ${db.escape(quantity)});`;
        db.query(q3, (error, result, fields) => {
          if (error) {
            throw error;
          } else {
            renderDashboard(req, res);
          }
        });
      }
    });
  } else {
    res.send("Quantity undefined");
  }
});
app.post("/rembook", validation, isAdmin, (req, res) => {
  let bookname = req.body.bookname;
  let q1 = `Select bookID from books where BookName=${db.escape(bookname)};`;
  db.query(q1, (err, result, field) => {
    console.log(result[0]);
    if (result[0] === undefined) {
      res.send("Book Not Found");
    } else {
      let BID = result["bookID"];
      let q3 = `Delete from books where BookName=${db.escape(bookname)};`;
      let q4 = `Delete from request where bookID=${db.escape(BID)};`;
      db.query(q3, (err, results, field) => {
        if (err) {
          throw err;
        } else {
          db.query(q4, (errors, results, fields) => {
            if (errors) {
              throw errors;
            } else {
              renderDashboard(req, res);
            }
          });
        }
      });
    }
  });
});
