var express = require('express');
var bodyParser = require('body-parser')
var fs = require('fs');

var router = express.Router();

var config = JSON.parse(fs.readFileSync("./config.json"));

var port = 10091;

var app = express();

var currentTemp  = {};

var dataPath = "./data/";

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

function getFileName(ts) {
    return dataPath + "temp." + currentDate(ts) + ".log";
}

function getData(from, to, cb) {
    var filename = getFileName(from);

    console.log("open: " + filename);

    var ins = fs.createReadStream(filename);

    var last = "";

    var numlines = 0;

    var start = Date.now();

    var res = [];

    var alldone = false;

    ins.on('data', function(chunk) {
        var lines, i;

        lines = (last+chunk).split("\n");

//        if(lines.length > 1 && JSON.parse(lines[0]).timestamp > from {
//
//        }

//        | 0 1 2 3  from 4 5 6 7 to 8 9 10 | 0 1 2 3 4 5 to 6 7 8 9 10 |

        if(lines.length > 1 && JSON.parse(lines.slice(-2, -1)).timestamp < from ) {
//            console.log("skip leading data...");
            i = lines.length - 1;
        } else if (JSON.parse(lines[0].timestamp > to )) {
//            console.log("skip trailing data...");
            i = lines.length - 1;
        } else {
//            console.log("parse lines: " + lines.length);
            for(i = 0; i < lines.length - 1; i++) {
                var data;
                try {
                    data = JSON.parse(lines[i]);
                } catch(e) {
                    console.log("failed: " + e);
                    console.log("line: " + i  + " of lines: " + lines.length);
                    console.log("line: " + lines[i]);
                    process.exit(1);
                }
                if(data.timestamp >= from && data.timestamp <= to) {
                    res.push(data);
                } else {
                    if(res.length) {
                        alldone = true;
                    }
                }
            }
        }

        numlines += lines.length - 1;

        last = lines[i];
    });
    
    ins.on('end', function() {
        numlines++;
        if(!alldone) {
            console.log("got data, read next file, total lines processed: " + numlines);
        } else {
            console.log("alldone, res lines: " + res.length);
        }
        cb(false, res);
    });

    ins.on('error', function(err) {
        cb(err);
    });
    
}

/*
console.log("read data from ts: " + 1*process.argv[2]);
var startTime = Date.now();
getData(1*process.argv[2], 1*process.argv[3], 
        function(err, res) { 
            if(err) 
                console.log("Failed: " + err); 
            console.log("alldone, res: ");
            console.log("total time: "  + (Date.now() - startTime) );
            process.exit() 
        } );

return;
*/

var now = Date.now();

var filename = getFileName(Date.now()); //"temp." + currentDate(Date.now()) + ".log";
var nextDay = nextDate(now);

app.use(express.static('public'));

//app.use(bodyParser.urlencoded({ extended: true }));
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
        filename = getFileName(ts); //"temp." + currentDate(ts) + ".log";
        nextDay = nextDate(ts);
    }

    fs.appendFile(filename, JSON.stringify(data) + "\n");

    res.send("OK");
});

app.get("/current", function(req,res) {
    res.send(currentTemp);
});


//app.use("/series", router);

router.series = function(req,res) {
/*
    console.log("got series request, fields: " + req.params.fields);
    console.log("start: " + req.params.start);
    console.log("stop: " + req.params.stop);
    console.log("num: " + req.params.num);
*/
    getData(1*req.params.start, 1*req.params.stop, function(err, data) {
        if(err) {
            res.send(err);
            return;
        }

        console.log("got data, N entries: ", data.length);

        res.send(data);
    });

};


app.get("/series/:start/:stop/:num?/:fields?", router.series);

// /series/start/stop/num
/*
app.get("/series/:start/:stop/:num", function(req, res) {

    var start = params[0];
    var stop = params[1];
    var num = params[2];

    console.log("get series");
    console.log(start, stop, num);
});
*/
app.listen(port, function () {

});
