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

var bus_reset = false;
var last_bus_reset = false;
var log_bus_reset = false;

for(var i = 0; i < config.sensors.length; i++) {
    sensors[i] = { 
        label: config.sensors[i].label, 
        device: "/sys/bus/w1/devices/" + config.sensors[i].id + "/w1_slave" ,
        status: 'UNDETECTED'
    };
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
                        bus_reset = true;
			last_bus_reset = Date.now();
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

    var i, err, req = 0, res = 0;

    for(i = 0; i < sensors.length; i++) {

        sensor = sensors[i];

        if(sensor.status !== 'NOT_PRESENT') {

            //temp[sensor.label] =  "reading";
            
            req++;
            
            fs.readFile(sensor.device, (function(err, data) {
                if(err) {
                    this.value = undefined;

                    if(this.status === 'UNDETECTED') {
                        this.status = 'NOT_PRESENT';
                    } else {
                        if(this.error) {
                            this.error++;
                        } else {
                            this.error = 1;
                        }

			if(bus_reset || this.error === 1) {
                            console.error("Failed to read sensor: " + this.label + ", device: " + this.device + ", date: " + new Date());
			}
                    }

                } else {
                    //console.log("got sensor data for: " + this.label + ", value: " + data);
                    var val = /t=([-\d]+)/.exec(data)[1];

                    if(bus_reset && 1*val === 85000) {
                        this.value = undefined;
                    } else {
                        this.value = 1*val/1000;
                    }

                    if(this.status === 'UNDETECTED') {
			console.log("Detecting sensor: " + this.label);
                        this.status = 'PRESENT';
                    }                

                    this.error = 0;
                }

                res++;
                
                if(res >= req) {
                    var temp = {};
                    var num_failed = 0;
                    for(var i = 0; i < sensors.length; i++) {
                        if(typeof sensors[i].value !== "undefined") {
                            temp[sensors[i].label] = sensors[i].value;
                        }

                        if(sensors[i].error) {
                          num_failed++;
                        } 
                    }

                    bus_reset = false;

                    if(num_failed) {
                        err = { num_failed: num_failed };
                    }

                    cb && cb(err, temp);
                }
            }).bind(sensor)); 
        } 
    }
}



function showSensors() {
    console.log("Reading all sensors");
    readSensors(sensors, function(err, values) {
        console.log("timestamp\t" + Date.now());
        for(var l in values) {
            console.log(l + "\t"+ values[l]);
        }
        setTimeout(showSensors, nextInterval());
    });
}



    // start logging process
    
function startLogging() {
        var timestamp = Date.now();
        if(bus_reset || log_bus_reset) {
          console.error("startLogging, bus has been reset at time: " + new Date(last_bus_reset) + ", read sensors at time: " + new Date(timestamp));
        } else {
          console.log("read sensors: " + new Date(timestamp));
        }

        readSensors(sensors, function(err, values) {
            if(err && err.num_failed) {
               console.error("Failed to read sensors: " + err.num_failed);
	       var now = Date.now();
	       var reset_wait = config.bus_reset_wait_timeout || 600*1000;
               if(last_bus_reset && (now < last_bus_reset + reset_wait)) {
                 var wait_delay = last_bus_reset + reset_wait - now;
                 console.error(""+new Date() + ", w1 bus was reset: " + new Date(last_bus_reset) + ", wait: " + (wait_delay/1000) + "s");
	         setTimeout(startLogging, wait_delay);
               } else {
 	         resetBus(function(err) {
	           if(err) {
                     console.error("Failed to reset bus: " + err);
                     process.exit(1);
                   }
     
		   console.error("w1 bus has been reset, wait 10s and dummy read sensors: " + new Date());
                   setTimeout(function() {
		     readSensors(sensors, function(err, values) {
			 console.error("dummy read done, err: ", err, ", timestamp: " +  new Date());
			 log_bus_reset = true;
			 setTimeout(startLogging, 1000);
		     });
                   }, 10000);
                 });
               }
               return;           
            }


            if(values) {
                console.log("sensors: ", values);
            } else {
                return;
            }

            var url = logserver;

            var data = {
                timestamp: timestamp
            };

            if(log_bus_reset) {
              data.bus_reset = true;
              log_bus_reset = false;
            }

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
                    setTimeout(startLogging, delay);
                });
            });
            
            req.write(JSON.stringify(data));
	    req.end();

            req.on('error', function(err) {
                console.error("failed to send data to logserver: " + url + ", err: " + err);
                var delay = nextInterval();
                console.log("Wait: " + delay + "ms");
                setTimeout(startLogging, delay);
            });
        });

    }


var argv = process.argv.slice(2);

for(var i = 0; i < argv.length; i++) {
    if(argv[i] === '-s') {
        config.showSensors = true;
    } else if(argv[i] === '-r') {
        config.resetBus = true;
    } 
}

if(config.resetBus) {
    resetBus(function(err) {
        if(err) {
            console.log("reset bus failed: " + err);
        }
        readSensors(sensors, function(err, values) {
            for(var l in values) {
                console.log(l + "\t"+ values[l]);
            }
        });
    });
} else if(config.showSensors) {
    showSensors();
} else {
    startLogging();
}
