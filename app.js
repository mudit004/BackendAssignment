const express = require("express");
require("dotenv").config();
const app = express();
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const db = require("./database.js");

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

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
    res.send("<h1>HOME PAGE</h1>");
});

//LOGIN Page
app.get("/login", (req, res) => {
    res.render("login");
});

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

app.post("/login", (req, res) => {
    var usrname = req.body.username;
    var pwd = req.body.pwd;
    console.log(usrname);
    console.log(pwd);
    let cmd = ` SELECT salt, hash, userID, admin from user where Uname=${db.escape(usrname)};`;
    db.query(cmd, async (error, results, fields) => {
        console.log(results);
        if (error) {
            throw error;
        } else {
            console.log(pwd);
            let hash = bcrypt.hashSync(pwd, results[0].salt);
            if (hash === results[0].hash) {
                console.log(`${usrname} logged in`);
                let sessionID = crypto.randomUUID();
                res.cookie("sessionID", sessionID, {
                    maxAge: 3600000,
                    httpOnly: true,
                });
                db.query(
                    `Insert Into cookies (userID, sessionID) values (${db.escape(
                        results[0].userID
                    )}, ${db.escape(sessionID)});`
                );
                if (results[0].admin === 1) {
                    res.redirect("/dashboard");
                } else {
                    res.redirect("/browse");
                }
            } else if (hash !== results[0].hash) {
                console.log(`Incorrect login attempt for ${usrname}`);
                res.render(`login`, { data: "Incorrect ID or Password" });
            } else {
                console.log("Some Unexpected Error Occured!");
            }
        }
    });
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
                        res.send("Success");
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
    req.adminAuth = 0;
    const cookie = req.headers.cookie.slice(10);
    if (req.headers.cookie.includes("sessionID")) {
        let sql = `Select cookies.userID, cookies.sessionID, user.admin where sessionID=${db.escape(cookie)} and user.userID=cookies.userID;`;
        db.query(sql, (err, result, field) => {
            if (err) {
                throw err;
            }
            else {
                if (result[0].admin === 1) {
                    req.adminAuth = 1;
                }
                else {
                    req.adminAuth = 0;
                }
            }

            if (cookie === result[0].sessionID) {
                req.userID = result[0].userid;
                next();
            }
            else {
                console.log("cookie: ", cookie);
                console.log("sessionID: ", result[0]);
                res.status(403).send({ 'msg': 'Not Authenticated' });
            }
        })

    }

}
//function to verify it's admin for admin specific routes
function isAdmin(req, res, next) {
    if (req.adminAuth === 1) {
        next();
    }
    else {
        res.status(403).send({ 'msg': 'Not Authenticated' });
    }
}

// function getUserID(req, res){
//     const cookie = req.headers.cookie.slice(10);
//     if (req.headers.cookie.includes("sessionID")) {
//         let sql = `Select  userID from cookies where sessionID=${db.escape(cookie)};`
//         db.query(sql, (err, result, field) =>{
//             if(err){
//                 throw err;
//             }else{
//             return result[0];
//             }
//         })
//     }
// }

app.get('/user_side/checkin', validation, (req, res) => {
    res.render('userInterface');
})
app.post('/user_side/checkin', validation, (req, res) => {
    let checkInReq = req.body.checkInID;
    let user = req.userID;

    let q1 = `select quantity from books where bookID=${db.escape(checkInReq)};`
    let quanOfBook = 0;
    db.query(q1, (err, result, field) => {
        if(err){
            throw err;
        }
        else{
            console.log(result[0]);
            quanOfBook = result[0];
        }

        if(quanOfBook > 0){
            let q2 = `Insert into request (UID, BookID, Status) values (${db.escape(user), $(db.escape(checkInReq)), 0})`
            db.query(q2);
            let q3 = `Update books set quantity = quantity-1 where bookID = ${db.escape(checkInReq)}`;
            db.query(q3);

        }
    })

})
app.get('/user_side/checkout', validation, (req, res) => {
    res.render('userInterface');
})

app.post('/user_side/checkout', validation, (req, res) => {
    var checkOutReq = req.body.checkOutID;
    var user = req.userID;

    let q1 = `Update request Set status = 2 where UID = ${db.escape(user)} AND BookID = ${db.escape(checkOutReq)};`
    db.query(q1);

})

app.get('/admin_side/accept', validation, isAdmin, (req, res) => {
    res.render('adminInterface');
})
app.post('/admin_side/accept', validation, isAdmin, (req,res) => {
    var acceptUID = req.body.acceptUID;
    var acceptBID = req.body.acceptBID;
    let userReq = undefined; 
    let q1 = `Select status from request where UID = ${db.escape(acceptUID)} and BookID = ${db.escape(acceptBID)};`
    db.query(q1, (err,result, fields) => {
        if(err){
            throw err;
        }
        else{
        if(result[0] == 0){
            userReq = Number(0);
        }
        else if(result[0] == 2){
            userReq = Number(2);
        }}
    })
    let q2 = `Update request set status = ${db.escape(userReq+1)} where BookID = ${db.escape(acceptBID)} and UID = ${db.escape(acceptUID)};`
    db.query(q2);
    if(userReq == 2){
        let q3 = `Update books set quantity = quantity+1 where bookID = ${db.escape(acceptBID)};`
        db.query(q3);
    }
})
app.get('/admin_side/reject', validation, isAdmin, (req, res) => {
    res.render('adminInterface');
})
app.post('/admin_side/reject', validation, isAdmin, (req,res) => {
    let rejectUID = req.body.rejectUID;
    let rejectBID = req.body.rejectBID;
    let userReq = undefined;
    let q1 = `Select status from request where UID = ${db.escape(rejectUID)} and BookID = ${db.escape(rejectBID)};`;
    db.query(q1, (err, result, fields) => {
        if(err){
            throw err;
        }
        else{
            if(result[0] == 0){
                userReq = Number(0);
            }
            else if(result[0] == 2){
                userReq = Number(2);
            }
        }
    })
    let q2 = `Delete from request where BookID=${db.escape(rejectBID)} and UID=${db.escape(rejectUID)};`
    db.query(q2);

    if(userReq == 0){
        let q3 = `Update books set quantity = quantity+1 where bookID = ${db.escape(rejectBID)};`
        db.query(q3);
    }

})
app.get('/addbook', validation, isAdmin, (req,res) => {
    res.render('addbooks');
})
app.post('/addbook', validation, isAdmin, (req,res) => {
    let bookname = req.body.bookname;
    let quantity = req.body.quantity;
    let q1 = `Select bookID from books where BookName=${db.escape(bookname)};`
    db.query(q1, (err,result, field) => {
        if(result[0] === undefined){
            let q2=`update books set quantity = quantity+1 where BookName=${db.escape(bookname)};`;
            db.query(q2);
        }else{
            let q3=`Insert into books (BookName, quantity) values (${db.escape(bookname)}, ${db.escape(quantity)});`
            db.query(q3);
        }
    })
})




