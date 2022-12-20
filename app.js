const express = require("express")
const mysql = require("mysql2");
const bodyParser = require("body-parser")
const { sendCallBackRequest } = require("./public/telegram");
const urlencodedParser = bodyParser.urlencoded({
    extended: false
})

class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ValidationError"
    }
}

const db = mysql.createConnection({
    host: "localhost",  
    user: "root",
    database: "nodemysql",
    password: '1234'
})

db.connect((err) => {
    if(err){
        throw err;
    }

    console.log('browser db success')
})

const app = express();

app.listen(3500, () => {
    console.log("success")
})

app.use(express.static(__dirname + '/public'))

app.get("/", (req, res) => {
    res.sendFile("/index.html")
})

const checkValidPhoneNumber = function(phone) {
    if(phone.length < 18) {
        return false;
    }
    return true;
}


app.post('/addClient', urlencodedParser, (req, res) => {
    const { name, phoneNumber, body } = req.body;
    const sql = `INSERT INTO test2 (name, phone, body) VALUES (?, ?, ?)`;
    const isValidNumber = checkValidPhoneNumber(phoneNumber);

    try {
        if(!isValidNumber) {
            res.sendStatus(403)
            throw new ValidationError("Number field is ircorrect")
        } else if (!!!name) {
            res.sendStatus(403)
            throw new ValidationError("Name field is empty");
        }
        db.query(sql, [name, phoneNumber, body], (err, result, field) => {
            if(err) throw err;
            res.send("user added")
            sendCallBackRequest()
        })
    } catch(e) {
        console.log(e.message)
    }
})

app.get("/requests", (req, res) => {
    const sql = "SELECT * FROM test2";
    db.query(sql, (err, result, fields) => {
        res.send(result)
    })
})

app.get("/requests/status/:status", (req, res) => {
    const sql = "SELECT * FROM test2 WHERE status = ?";
    
    db.query(sql, [req.params.status], (err, result, fields) => [
        res.send(result)
    ])
})

app.get("/requests/:id", (req, res) => {
    const sql = "SELECT * FROM test2 WHERE id = ?"
    db.query(sql, [req.params.id], (err, result, fields) => {
        if(err) throw err;

        res.send(...result);
    })
})
