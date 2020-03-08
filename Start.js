var _Hostname = require('./Slave.json')[0];
var _Secret = require('./Slave.json')[1];

var exec = require('child_process').exec;

var fs = require('fs');
var express = require('express');
var request = require('request');
var CronJob = require('cron').CronJob;
var whois = require('whois');

var dev = fs.existsSync('./.dev');

var WaitTimes = {
    'COM':      256,
    'NET':      256,
    'ORG':      7125,
    'COMAU':    8125,
    'NETAU':    8125,
    'ORGAU':    8125
};

var Tlds = {
    'COM': 'com',
    'NET': 'net',
    'ORG': 'org',
    'COMAU': 'com.au',
    'NETAU': 'net.au',
    'ORGAU': 'org.au'
};

var Patterns = {
    'COM': ["No match for domain \"{%DOMAIN%}\"."],
    'NET': ["No match for domain \"{%DOMAIN%}\"."],
    'ORG': ["NOT FOUND"],
    'COMAU': ["NOT FOUND"],
    'NETAU': ["NOT FOUND"],
    'ORGAU': ["NOT FOUND"],
}

var app = express();

var Config = {};

var Slave = {
    Run: true,
    Hostname: _Hostname,
    Version: fs.readFileSync(`${__dirname}/.git/refs/heads/master`).toString().substr(0, 7),
    List: {
        'COM':      {Have: false, ID: 0, Count: 0, Done: 0, Left: 0, Words: []},
        'NET':      {Have: false, ID: 0, Count: 0, Done: 0, Left: 0, Words: []},
        'ORG':      {Have: false, ID: 0, Count: 0, Done: 0, Left: 0, Words: []},
        'COMAU':    {Have: false, ID: 0, Count: 0, Done: 0, Left: 0, Words: []},
        'NETAU':    {Have: false, ID: 0, Count: 0, Done: 0, Left: 0, Words: []},
        'ORGAU':    {Have: false, ID: 0, Count: 0, Done: 0, Left: 0, Words: []}
    }
};
 
app.get('/', function(req, res){
    res.send('Hello World');
});
 
app.get('/info', function(req, res){
    res.send({
        Config: Config,
        Slave: Slave
    });
});
 
app.get('/update', function(req, res){
    if(!dev){
        exec('git pull', {
            cwd: __dirname
        }, function(GITerror, GITstdout, GITstderr){
            if(GITerror){console.log(GITerror);}
            exec('npm install', {
                cwd: __dirname
            }, function(NPMerror, NPMstdout, NPMstderr){
                if(NPMerror){console.log(NPMerror);}
                res.send({
                    git: {
                        error: GITerror,
                        stdout: GITstdout,
                        stderr: GITstderr
                    },
                    npm: {
                        error: NPMerror,
                        stdout: NPMstdout,
                        stderr: NPMstderr
                    }
                });

                process.exit(1);
            });
        });
    }
});
 
app.listen(3000);

GetConfig(function(_Config){
    Config = _Config;
    Slave.Run = _Config.Run;

    SetStatus('Slave Started Up!', function(){
        new CronJob('0 * * * * *', function(){
            Ticker('com', 'COM');
            Ticker('net', 'NET');
            Ticker('org', 'ORG');
            Ticker('comau', 'COMAU');
            Ticker('netau', 'NETAU');
            Ticker('org', 'ORGAU');
        }, null, true, 'Australia/Melbourne');

        new CronJob('*/5 * * * * *', function(){
            GetConfig(function(_Config){
                Config = _Config;
                Slave.Run = _Config.Run;
            });
        }, null, true, 'Australia/Melbourne');
    });
});

function DomainStatus(Word, Variant, VAR, Callback){
    var Domain = `${Word}.${Tlds[VAR]}`;

    setTimeout(function(){
        whois.lookup(Domain, {
            'follow': 0,
            'timeout': 0
        }, function(err, data){
            if(err){
                console.log(err);
                data = '';
            }
            var Pattern = Patterns[VAR][0];
    
            Pattern = Pattern.replace('{%DOMAIN%}', Domain.toUpperCase());
    
            if(data.indexOf(Pattern) != -1){
                Callback(true);
            }else{
                Callback(false);
            }
        });
    }, WaitTimes[VAR]);
}

function Q(I, Variant, VAR, Callback){
    if(Slave.List[VAR].Words[I]){
        DomainStatus(Slave.List[VAR].Words[I], Variant, VAR, function(Available){
            if(Available){
                request({
                    method: 'POST',
                    url: 'https://domaining.fadebit.com/slave/domains/add',
                    headers: {
                        'SLAVE-SECRET': 'Secret15121996',
                        'SLAVE-HOSTNAME': 'TestSlave01'
                    },
                    formData: {
                        'Domain': `${Slave.List[VAR].Words[I]}.${Tlds[VAR]}`
                    }
                }, function(error, response){
                    if(error){console.log(error);}
                    Q(I+1, Variant, VAR, Callback);
                });
            }else{
                Q(I+1, Variant, VAR, Callback);
            }
            Slave.List[VAR].Done++;
            Slave.List[VAR].Left = Slave.List[VAR].Count - Slave.List[VAR].Done;
        });
    }else{
        Callback();
    }
}

function Query(Variant, VAR){
    Q(0, Variant, VAR, function(){
        request({
            method: 'POST',
            url: `https://domaining.fadebit.com/slave/lists/${Variant}/finished`,
            headers: {
                'SLAVE-SECRET': _Secret,
                'SLAVE-HOSTNAME': _Hostname
            },
            formData: {
                'List': Slave.List[VAR].ID
            }
        }, function(error, response){ 
            if(error){console.log(error);}
            Slave.List[VAR] = {Have: false, ID: 0, Count: 0, Done: 0, Left: 0, Words: []};
            console.log(VAR, 'Done');
        });
    });
}

function Ticker(Variant, VAR){
    if(Slave.Run){
        if(!Slave.List[VAR].Have){
            console.log(VAR, 'Looking for list');
            request({
                method: 'GET',
                url: `https://domaining.fadebit.com/slave/lists/${Variant}/get`,
                headers: {
                    'SLAVE-SECRET': _Secret,
                    'SLAVE-HOSTNAME': _Hostname,
                },
                json: true
            }, function(error, response){
                if(error){console.log(error);}
                var Data = response.body;
                if(Data.Success == true){
                    Slave.List[VAR].Have = true;
                    Slave.List[VAR].ID = parseInt(Data.List.ID);
                    Slave.List[VAR].Count = parseInt(Data.List.Count);
                    Slave.List[VAR].Left = parseInt(Data.List.Count);
                    Slave.List[VAR].Words = Data.List.Words;
                    console.log(VAR, 'found list');

                    Query(Variant, VAR);
                }else{
                    console.log(VAR, 'no list');
                }
            });
        }
    }
}

function SetStatus(Status, Callback){
    console.log(Status);
    request({
        method: 'POST',
        url: 'https://domaining.fadebit.com/slave/status',
        headers: {
            'SLAVE-SECRET': _Secret,
            'SLAVE-HOSTNAME': _Hostname,
        },
        formData: {
            'Status': Status
        },
        json: true
    }, function(error, response){ 
        Callback();
    });
}

function GetConfig(Callback){
    request({
        method: 'GET',
        url: 'https://domaining.fadebit.com/slave/config',
        headers: {
            'SLAVE-SECRET': _Secret,
            'SLAVE-HOSTNAME': _Hostname,
        },
        json: true
    }, function(error, response){
        if(error){console.log(error);}
        Callback(response.body.Config);
    });
}


