var express = require('express');
var bodyParser = require('body-parser')
var fs = require('fs');

var port = 10091;

var app = express();


app.use(express.static('public'));

app.use(bodyParser.json()); 

app.post("/temp", function(req, res) {
    //console.log("req.ip: " + req.ip);

    if( (""+req.ip).indexOf("192.168.1.1") === -1 &&  (""+req.ip).indexOf("81.170.140.55") === -1) {
        // silently die
        console.log("ignore request from: " + req.ip);
        return;
    }

    console.log("json: ", req.body);
	
    var data = req.body;
    
    fs.appendFile('temp.log', JSON.stringify(data) + "\n");

    res.send("OK");
    res.end();
});

app.listen(port, function () {

});
