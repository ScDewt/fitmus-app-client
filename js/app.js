(function(global,undefined){
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

    jQuery( function() {
        $(".hide").removeClass("hide");
        jQuery( "body>[data-role='panel']" ).panel();

        $( "#cooment_popup" ).enhanceWithin().popup({
            align: "0.5,0.5"
        });
    });

    $.mobile.loading( 'show', {
        text: "loading",
        textVisible: true,
        theme: "b",
        textonly: false,
        html: ""
    });
    $.mobile.defaultPageTransition = 'none';

    global.app = angular.module('fitApp',[]);
    app.run(function($rootScope,connect){
        var run = _.once(function(){
            if(connect.isLogin()){
                connect.getAll(function(err,data){
                    if(err){
                        $.mobile.loading("hide");
                        alert(err.message);
                        return ;
                    }
                    $.mobile.loader("hide");
                    console.log(data);
                    setTimeout(function(){
                        $.mobile.changePage("#main_page",{transition:"none"});
                    },0)
                });
            }else{
                $.mobile.loader("hide");
                $.mobile.changePage("#auth_page");
            }
        });
        document.addEventListener("deviceready", run, false);
        setTimeout(run, 3000);
    });


    localStorage["error-log"] = "";
    global.onerror = function(){
        var args = [].slice.call(arguments);
        localStorage["error-log"] += "|" + JSON.stringify(args,censor(args));
    }
})(window);