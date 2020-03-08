var _Hostname = require('./Slave.json')[0];
var _Secret = require('./Slave.json')[1];

var fs = require('fs');

var dev = fs.existsSync('./.dev');

var execSync = require('child_process').execSync;

var request = require('request');

if(!dev){
fs.writeFileSync('/etc/rc.local', `#!/bin/sh -e
#
# rc.local
#
# This script is executed at the end of each multiuser runlevel.
# Make sure that the script will "exit 0" on success or any other
# value on error.
#
# In order to enable or disable this script just change the execution
# bits.
#
# By default this script does nothing.

echo '' > /Slave/Log1.log; forever /Slave/Start.js |& tee -a /Slave/Log1.log & 

exit 0`);
console.log(execSync('chmod +x /etc/rc.local').toString());
}
request({
    method: 'POST',
    url: 'https://domaining.fadebit.com/slave/status?=ThisIsTheStatus',
    headers: {
        'SLAVE-SECRET': _Secret,
        'SLAVE-HOSTNAME': _Hostname,
    },
    formData: {
        'Status': 'Running \'FirstRun.js\''
    },
    json: true
}, function(error, response){ 
    console.log(response.body);
});