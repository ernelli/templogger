var express = require('express');
var bodyParser = require('body-parser')
var fs = require('fs');

var config = JSON.parse(fs.readFileSync("./config.json"));

var port = 10091;

var app = express();

var currentTemp  = {};

function currentDate(ts) {
  var d = new Date(ts);

  return d.getFullYear() + "." + ("00" + (1+d.getMonth())).slice(-2) + "." +  ("00" + (d.getDate())).slice(-2);
}

function nextDate(ts) {
  var d = new Date(ts);


  d.setMilliseconds(0);
  d.setSeconds(0);
  d.setMinutes(0);
  d.setHours(24);


  return d.getTime();
}

var now = Date.now();

var filename = "temp." + currentDate(Date.now()) + ".log";
var nextDay = nextDate(now);

app.use(express.static('public'));

app.use(bodyParser.json()); 

app.post("/store", function(req, res) {
    //console.log("req.ip: " + req.ip);

    if( (""+req.ip).indexOf("192.168.1.") === -1 &&  (""+req.ip).indexOf(config.allowed) === -1) {
        // silently die
        console.log("ignore request from: " + req.ip);
        return;
    }

    console.log("json: ", req.body);
	
    var data = req.body;

    var updated = false;

    for(temp in data) {
        if(currentTemp[temp] !== data[temp]) {
            currentTemp[temp] = data[temp];
            updated = true;
        }
    }
    
    var ts = data.timestamp;

    if(ts > nextDay) {
        filename = "temp." + currentDate(ts) + ".log";
        nextDay = nextDate(ts);
    }

    fs.appendFile(filename, JSON.stringify(data) + "\n");

    res.send("OK");
});

app.get("/current", function(req,res) {
    res.send(currentTemp);
});

app.listen(port, function () {

});
