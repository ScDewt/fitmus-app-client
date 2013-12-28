'use strict';

app.factory('connect',function ($rootScope){
    var rootUrl = "http://dev.fitmus.com/api/v3/",
        rand = Math.random(),
        app_id = "1",
        app_key = "1",
        app_sign = "1",//md5(app_id + app_key);
        sourcePath,
        exerciseSources = {},
        defaultSettings = {
            is_show_time: true,
            is_auto_update: true,
            weight_unit: 1,
            distance_unit: 1
        },
        userData = {
            user: null,
            data: null,
            train: null,
            note: null,
            settings: defaultSettings
        }, loginListeners = [];

    $rootScope.settings = defaultSettings;

    function censor(censor) {
        var i = 0;
        return function(key, value) {
            if(i !== 0 && typeof(censor) === 'object' && typeof(value) == 'object' && censor == value)
                return '[Circular]';
            if(i >= 29) // seems to be a harded maximum of 30 serialized objects?
                return '[Unknown]';
            ++i; // so we know we aren't using the original object anymore
            return value;
        }
    }

    localStorage["console-log"] = "";
    console.log = (function(oldFunc){
        return function(){
            var args = [].slice.call(arguments),
                strArgs = JSON.stringify(args,censor(args));
            localStorage["console-log"] += "|" + strArgs;
            //$.ajax("http://192.168.1.95:3000/log?" +strArgs);
            oldFunc.apply(this, args);
        };
    })(console.log);

    function saveToLocalStorage(){
        window.localStorage["fitmus-app-user-data"] = JSON.stringify(_.cloneCleaner(userData));
    }

    function loadFromLocalStorage(){
        if(window.localStorage["fitmus-app-user-data"]){
            userData = JSON.parse(window.localStorage["fitmus-app-user-data"]);
            if(!userData.settings){
                userData.settings = defaultSettings;
            }
        }
    }

    function saveExerciseUri(){
        window.localStorage["fitmus-app-exercises"] = JSON.stringify(_.cloneCleaner(exerciseSources));
    }

    function loadExerciseUri(){
        if(window.localStorage["fitmus-app-exercises"]){
            exerciseSources = JSON.parse(window.localStorage["fitmus-app-exercises"]);
        }
    }

    function getJSON(url,callback){
        if(!userData.user){
            callback({
                message: "неавторизированный доступ"
            },null);
            return ;
        }
        $.getJSON(rootUrl + url,{
            app_id: app_id,
            app_sign: app_sign,
            user_id: userData.user.id,
            token: userData.user.token
        }).done(function(data){
            callback(data.error,data.data);
        }).fail(function(jqXHR, textStatus, errorThrown){
            callback({
                message: errorThrown
            },null);
        });
    }

    function postJSON(url,data,callback){
        if(!userData.user){
            callback({
                message: "неавторизированный доступ"
            },null);
            return ;
        }
        var url = rootUrl + url + "?" + $.param({
            app_id: app_id,
            app_sign: app_sign,
            user_id: userData.user.id,
            token: userData.user.token
        });
        $.ajax({
            url:url,
            type:"POST",
            data: data,//{ data:JSON.stringify(data) },
            //contentType:"application/json; charset=utf-8",
            dataType:"json"
        }).done(function(data){
            callback(data.error,data.data);
        }).fail(function(jqXHR, textStatus, errorThrown){
            callback({
                message: errorThrown
            },null);
        });
    }

    function downloadSource(id_exercise, cb){
        var exercise = userData.data.exercise[id_exercise];
        var run = function(){
            fUtils.downloadFile(exercise.img + "?"+rand, sourcePath + id_exercise + ".jpg", function(err, uri){
                if(err){
                    cb(null);
                    return
                }
                setTimeout(function(){
                    exerciseSources[id_exercise] = uri;
                    saveExerciseUri();
                    cb(null);
                },300);
            });
        };
        if(!exercise ){
            cb(null);
            return;
        }
        if(exerciseSources[exercise]){
            var img = document.createElement("img");
            img.onerror = run;
            img.onload = function(){cb(null)};
            img.src = exerciseSources[exercise];
            return;
        }
        run();
    }

    function startDownloadSource(data){
        fUtils.getFileSystem(function(err, fileSystem){
            if(err){
                console.log("getFileSystem",err);
                return ;
            }
            fUtils.getRootPath(fileSystem,function(err, path){
                if(err){
                    console.log("getRootPath",err);
                    console.log(err);
                    return ;
                }
                sourcePath = path + "fitmus/res/excs/";
                console.log("getRootPath",sourcePath);
                var keys = Object.keys(data.exercise);
                setTimeout(function(){
                    async.eachSeries(keys,downloadSource,function(err){
                        console.log("downloadSource end",err);
                        return ;
                    });
                },0);
            })
        });
    }

    function markRecord(collection){
        _.forEach(collection,function(item){
            item.$$_status = "sync";
        });
        return collection;
    }

    return {
        getLocalExerciseUri: function(){
           return exerciseSources;
        },
        isLogin: function(){
            loadFromLocalStorage();
            loadExerciseUri();
            $rootScope.settings = userData.settings;
            return !!userData.user;
        },
        onLogin:function(callback){
            loginListeners.push(callback);
        },
        login: function (login, pass, callback){
            $.getJSON(rootUrl+"login/",{
                app_id: app_id,
                app_sign: app_sign,
                login:login,
                passwd:pass
            }).done(function(data){
                userData.user = data.data;
                userData.user.pass = pass;
                saveToLocalStorage();
                callback(data.error,data.data);
                loginListeners.forEach(function(callback){
                    callback(null,data.data);
                });
            }).fail(function(jqXHR, textStatus, errorThrown){
                callback({
                  message: errorThrown
                },null);
            });
        },
        logout: function (callback){
            userData = {
                user: null,
                data: null,
                train: null,
                note: null
            };
            saveToLocalStorage();
            callback && callback();
        },
        getData: function(callback){
            if(userData.data && !navigator.onLine){
                startDownloadSource(userData.data||{});
                callback(null, userData.data);
                return;
            }
            getJSON("syncdata/",function(err, data){
                startDownloadSource(data||{});
                userData.data = data;
                callback(err, data);
            });
        },
        getTrain: function(callback){
            if(userData.train && !navigator.onLine){
                callback(null, userData.train);
                return;
            }
            getJSON("train/",function(err, data){
                data = markRecord(data||{});
                userData.train = data;
                callback(err, data);
            });
        },
        getNote: function(callback){
            if(userData.note && !navigator.onLine){
                callback(null, userData.note);
                return;
            }
            getJSON("note/",function(err, data){
                data = markRecord(data||{});
                userData.note = data;
                callback(err, data);
            });
        },
        getAll:function(callback){
            async.parallel({
                data: this.getData,
                train: this.getTrain,
                note: this.getNote
            },function(err,data){
                console.log(data);
                saveToLocalStorage();
                $rootScope.musclegroups = data.data.musclegroup;
                $rootScope.exercises = data.data.exercise;
                $rootScope.musclegroup_exercises = data.data.musclegroup_exercise;
                $rootScope.units = data.data.units;
                $rootScope.mode = data.data.mode;
                $rootScope.mode_names = Object.keys(data.data.mode);
                callback(err,data);
            });
        },
        sync: function(callback){
            async.parallel({
                note: function(cb){
                    var toUpdate = {};
                    _.forEach(userData.note, function(item, key){
                        if(item.$$_status == "updated"){
                            this[key] = item;
                        }
                    },toUpdate);
                    postJSON("note/",{ data: _.cloneCleaner(toUpdate)},function(err, data){
                        markRecord(data);
                        userData.note = data;
                        cb(err, data);
                    });
                },
                train: function(cb){
                    var toUpdate = {};
                    _.forEach(userData.train, function(item, key){
                        if(item.$$_status == "updated"){
                            this[key] = item;
                        }
                    },toUpdate);
                    postJSON("train/",{ data: _.cloneCleaner(toUpdate)},function(err, data){
                        markRecord(data);
                        userData.train = data;
                        cb(err, data);
                    });
                }
            },function(err, data){
                $rootScope.$broadcast('sync', true);
                saveToLocalStorage();
                callback(err,data);
            });
        }
    };
});