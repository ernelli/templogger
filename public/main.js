define(function(["partials"]) {
  console.log("main loaded");
    
  function get(url, cb) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.onreadystatechange = function() {
          if(xhr.readyState === 4) {
              if(xhr.status === 200 || xhr.status === 204) {
                  cb(false, JSON.parse(xhr.responseText));
              } else {
                  cb( { status: xhr.status, text: xhr.responseText } );
              }
          }
      };
      xhr.send();
  }

   get("/current", cb(err, data) {
       var values = [];

       var div = document.getElementById('content');

       if(err) {
           div.innerHTML = "Failed to get data: " + err.status + "\n" + err.text;
           return;
       }

       for(var v in data) {
           values.push( { label: v, value: data[v] });
       }

       div.innerHTML = partials['status.hbar'](data);

   });


});
