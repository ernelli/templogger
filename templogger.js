var fs = require('fs');
var http = require('http');
var URL = require('url');

var config = JSON.parse(fs.readFileSync("./config.json"));

var interval = 10000;

function nextInterval() {
    var now = Date.now();
    var delay = interval - (now % interval);
    return delay;
}

var logserver = config.logserver;

var sensors = [];

for(var i = 0; i < config.sensors.length; i++) {
    sensors[i] = { label: config.sensors[i].label, device: "/sys/bus/w1/devices/" + config.sensors[i].id + "/w1_slave" };
}

function readSensors(sensors, cb) {
    var sensor, temp = {};

    var res = 0;

    for(i = 0; i < sensors.length; i++) {
        sensor = sensors[i];
        temp[sensor.label] =  "reading";
        fs.readFile(sensor.device, (function(err, data) {
            if(err) {
                temp[this.label] = "[failed]" + err;
            } else {
                //console.log("got sensor data for: " + this.label + ", value: " + data);
                var val = /t=(\d\d\d\d\d)/.exec(data)[1];
                temp[this.label] = 1*val;
            }

            res++;
            
            if(res >= sensors.length) {
                cb && cb(temp);
            }
        }).bind(sensor));
    }
}


(function timerCb() {
    var timestamp = Date.now();
    console.log("read sensors: " + new Date(timestamp));

    readSensors(sensors, function(values) {
        if(values) {
            console.log("sensors: ", values);
        } else {
            return;
        }

        var url = logserver;

        var data = {
           timestamp: timestamp
        };

        for(var v in values) {
            data[v] = values[v];
        }

        var options = URL.parse(url);
        options.method = "POST";
        options.headers = {  "content-type": "application/json"};

        console.log("send data to logserver: " + logserver);
        
        var req = http.request(options, function(res) {
            var body = "";
            if(res.status !== 200) {
                console.log("failed to send data to logserver: " +  res.status);
            } else {
                console.log("data submitted, result: " + res);
            }

  	    res.on('data', function(chunk) {
               body += chunk;
            });

	    res.on('end', function() {
               console.log("got response: " + body);
               var delay = nextInterval();
               console.log("Wait: " + delay + "ms");
               setTimeout(timerCb, delay);
            });
        });
        
        req.write(JSON.stringify(data));
	req.end();

        req.on('error', function(err) {
            console.log("Failed to send data to logserver: " + err);
        });
    });

})();
