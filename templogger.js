var fs = require('fs');

var http = require('http');
var URL = require('url');

var config = JSON.parse(fs.readFileSync("./config.json"));

var interval = 10000;

var argv = process.argv.slice(2);

for(var i = 0; i < argv.length; i++) {
    if(argv[i] === '-s') {
        config.showSensors = true;
    } else if(argv[i] === '-r') {
        console.log("do reset bus");
        resetBus(function(err) {
            if(err) {
                process.exit(1);
            } else {
                process.exit(0);
            }
        });
    }
}

function nextInterval() {
    var now = Date.now();
    var delay = interval - (now % interval);
    return delay;
}

var logserver = config.logserver;

var sensors = [];

var bus_reset = false;

for(var i = 0; i < config.sensors.length; i++) {
    sensors[i] = { label: config.sensors[i].label, device: "/sys/bus/w1/devices/" + config.sensors[i].id + "/w1_slave" };
}


function resetBus(cb) {
    console.log("reset bus");
    if(config.vdd) {
        console.log("vdd present in config");
        try {
            var value = ""+fs.readFileSync(config.vdd);
            console.log("vdd value: " + value + " " + typeof value + ", length: " + value);
            if(value !== "1\n") { // bus allready low
               console.log("vdd already low");
            } else {
                console.log("set vdd low");
                fs.writeFileSync(config.vdd, "0");
            }
                setTimeout(function() {
                    try {
		        console.log("set vdd high");
                        fs.writeFileSync(config.vdd, "1");
	                console.log("vdd set high, alldone, wait 100ms");
                    } catch(e) {
                        cb("Failed to write vdd pin: " + config.vdd + ", error:" + e);
                        return;
                    }
                    
                    setTimeout(function() {
                        console.log("wait done, cb");
                        cb(false);
                    }, 100);

                }, 100);

        } catch(e2) {
            cb("Failed to read or write vdd pin: " + config.vdd + ", error:" + e2);
        }
    } else {
        cb("vdd pin not defined, cannot reset w1 bus");
    }
}

function readSensors(sensors, cb) {
    var sensor; //, temp = {};

    var i, err, res = 0;

    for(i = 0; i < sensors.length; i++) {
        sensor = sensors[i];
        //temp[sensor.label] =  "reading";
        fs.readFile(sensor.device, (function(err, data) {
            if(err) {
                //temp[this.label] = "[failed]" + err;

                this.value = undefined;
                this.error = this.errors ? this.errors + 1 : 1;

            } else {
                //console.log("got sensor data for: " + this.label + ", value: " + data);
                var val = /t=([-\d]+)/.exec(data)[1];

                if(bus_reset && 1*val === 85000) {
                    this.value = undefined;
                } else {
                    this.value = 1*val/1000;
                }

                this.error = 0;
//                temp[this.label] = 1*val/1000;
            }

            res++;
            
            if(res >= sensors.length) {
                var temp = {};

                for(var i = 0; i < sensors.length; i++) {
                    if(typeof sensors[i].value !== "undefined") {
                        temp[sensors[i].label] = sensors[i].value;
                    }
                }

                cb && cb(err, temp);
            }
        }).bind(sensor));
    }
}

if(config.showSensors) {

    (function showSensors() {
    console.log("Reading all sensors");
    readSensors(sensors, function(err, values) {
        console.log("timestamp\t" + Date.now());
        for(var l in values) {
            console.log(l + "\t"+ values[l]);
        }
        setTimeout(showSensors, nextInterval());
    });
    })();
} else {
    // start logging process
    
   (function timerCb() {
        var timestamp = Date.now();
        console.log("read sensors: " + new Date(timestamp));

        readSensors(sensors, function(err, values) {



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
                if(res.statusCode !== 200) {
                    console.error("failed to send data to logserver: " + url + ", status: " + res.statusCode);
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
                console.error("failed to send data to logserver: " + url + ", err: " + err);
                var delay = nextInterval();
                console.log("Wait: " + delay + "ms");
                setTimeout(timerCb, delay);
            });
        });

    })();
}
