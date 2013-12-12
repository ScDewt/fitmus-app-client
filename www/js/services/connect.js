'use strict';

app.factory('connect',function ($rootScope){
    var rootUrl = "http://dev.fitmus.com/api/v3/",
        app_id = "1",
        app_key = "1",
        app_sign = "1",//md5(app_id + app_key);
        userData = {
            user: null,
            data: null,
            train: null,
            note: null
        }, loginListeners = [];

    function saveToLocalStorage(){
        window.localStorage["fitmus-app-user-data"] = JSON.stringify(userData);
    }

    function loadFromLocalStorage(){
        if(window.localStorage["fitmus-app-user-data"]){
            userData = JSON.parse(window.localStorage["fitmus-app-user-data"]);
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


    function connectExerciseToMuscle(data){
        angular.forEach(data.musclegroup_exercise,function(values, id_muscle_group){
            for(var i=0;i< values.length;i++){
                var id_exercise = values[i];
                data.exercise[id_exercise].id_muscle_group = id_muscle_group;
            }
        });
    }

    function markRecord(collection){
        _.forEach(collection,function(item){
            item.$$_status = "sync";
        });
        return collection;
    }

    return {
        isLogin: function(){
            loadFromLocalStorage();
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
            if(userData.data){
                callback(null, userData.data);
                return;
            }
            getJSON("syncdata/",function(err, data){
                connectExerciseToMuscle(data||{});
                userData.data = data;
                callback(err, data);
            });
        },
        getTrain: function(callback){
            if(userData.train){
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
            if(userData.note){
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
                        callback(err, data);
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
                        callback(err, data);
                    });
                }
            },function(err, data){
                saveToLocalStorage();
                callback(err,data);
            });
        }
    };
});