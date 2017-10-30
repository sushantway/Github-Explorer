function breakToParams(string) {
    var getParams = {};
    string.split("&").forEach(function(param){
        var parameter = param.split("=");
        getParams[parameter[0]] = parameter[1];
    });
    return getParams;
}

function checkLogin() {
    var clientID = "9cb7025ed27bcb021edb";
    var redirectUri = "http://localhost:8000";
    var clientSecret = "04033f0e912f80a14686098bde5e2a1b183e71e9";
    var accessToken = localStorage.getItem("access_token");

    if (accessToken === "undefined") {
        accessToken = null;
    }

    var promise = $.Deferred();

    if (accessToken != null) {
        $.ajax({
            url: "https://api.github.com/applications/" + clientID + "/tokens/" + accessToken,
            success: function(data){
                promise.resolve({accessToken: accessToken});
            },
            error: function(data){
                localStorage.removeItem("access_token");
                window.location = "https://github.com/login/oauth/authorize?client_id=" + clientID + "&" +
                    "redirect_uri=" + redirectUri;
            }
        })
    } else {
        var getParams = breakToParams(window.location.search.substring(1));

        if (getParams.code == null) {
            window.location = "https://github.com/login/oauth/authorize?client_id=" + clientID + "&" + "redirect_uri=" +
            redirectUri;
            return;
        }

        $.ajax({
            url: "https://github.com/login/oauth/access_token",
            method: "POST",
            data: {
                client_id: clientID,
                client_secret: clientSecret,
                code: getParams.code
            }
        }).then(function(data){
            var params = breakToParams(data);

            if (params.error === "bad_verification_code") {
                window.location = "https://github.com/login/oauth/authorize?client_id=" + clientID + "&" +
                    "redirect_uri=" + redirectUri;
                return;
            }

            localStorage.setItem("access_token", params.access_token);
            promise.resolve({accessToken: params.access_token});
        });
    }

    return promise;
}

$(function() {
    $("body").height(window.innerHeight).width(window.innerWidth);

    checkLogin().then(function(params){
        statStorage = new StatStorage();

        settings = {
            repoName: "tensorflow",
            repoOwner: "tensorflow",
            maxCollaborators: 10,
            collaboratorToCompare: "vrv",
            weeksInTimeline: 8,
            cacheEnabled: true,
            accessToken: params.accessToken
        };

        // var contributorChart = contributorStats(settings);

        $("#vizForm :input").each(function(i, d){
            input = $(d);
            if (input.attr("type") == "checkbox") {
                input.prop("checked", settings[input.attr("name")]);
            } else {
                input.val(settings[input.attr("name")]);
            }
        });

        $('#update-settings').on('click', function() {
            $("#vizForm input").each(function(i, d){
                input = $(d);
                if (input.attr("type") == "checkbox") {
                    settings[input.attr("name")] = input.prop("checked");
                } else {
                    settings[input.attr("name")] = isNaN(input.val()) ? input.val() : parseInt(input.val());
                }
            });

            statStorage.setSettings(settings).then(function(data){
                contributorStats(settings, data);
            });
            // getProcessedData(settings).then(contributorChart.update);
        });

        $('#update-settings').trigger("click");
    });
});

function contributorStats(settings, dataPromise) {
    var width = $("#vizContainer").width(),
        height = window.innerHeight,

    chartRadius = Math.min(width, height) / 2.5;
    chartInnerRadius = chartRadius/4;
    radiusDelta = chartRadius - chartInnerRadius;

    chart = d3.select("#contributor-chart");
    chart.attr("width", width).attr("height", height);
    chart.empty();

    var radiusScale = d3.scale.linear().domain([0,1]).range([chartInnerRadius, chartRadius]);

    var radius = {
        events: [radiusScale(0), radiusScale(0.4)],
        addDel: [radiusScale(0.4), radiusScale(0.7)],
        commit: [radiusScale(0.7), radiusScale(1)],
    };

    var pie = d3.layout.pie()
        .sort(null)
        .padAngle(.01)
        .value(function(d) {
            return 1;
        });

    var dArc = d3.svg.arc();
    var d3LinearScale = d3.scale.linear();
    var d3RadialScale = d3.scale.linear();
    var d3AngularScale = d3.scale.linear().domain([0, settings.weeksInTimeline - 1]);

    function arc(radiusType) {
        return dArc.innerRadius(function(d,i){
            return radius[radiusType][0];
        }).outerRadius(function(d, i){
            return radius[radiusType][1];
        });
    }

    function radialScale(radiusType, startDomain, endDomain) {
        return d3RadialScale.range[radius[radiusType][0], radius[radiusType][1]]
            .domain([startDomain, endDomain]);
    }

    function linearScale(radiusType, startDomain, endDomain, startAngle, endAngle){
        return d3LinearScale.range[radius[radiusType][0], radius[radiusType][1]]
            .angle(function(d) { return angle(d.time); })
            .radius(function(d) { return radialScale(radiusType, startDomain, endDomain)});
    }

    function angularScale(startAngle, endAngle){
        return d3AngularScale.range(startAngle, endAngle);
    }

    var contributorArcs = d3.svg.arc()
            .innerRadius(function(d, i){
                return chartInnerRadius;
            })
            .outerRadius(function(d, i) {
                return chartRadius;
            });

    var line = d3.svg.line.radial()
        .interpolate("cardinal-closed")
        .angle(function(d) {
            return angle(d.time);
        })
        .radius(function(d) {
            return radius(d.y0 + d.y);
        });

    dataPromise.then(function(data){
        var color = d3.scale.category20();

        var contributors = chart.selectAll(".contributors").data(pie(data), function(d){
            return d.data.name;
        });

        contributors.enter().append("g")
            .attr("class", "contributors")
            .attr("transform", "translate(" + (width/2) + "," + (height/2) + ")");

        contributors.exit().remove();

        contributors.selectAll("path").remove();

        contributors.each(function(d, i){
            var pie = d3.select(this);
            for(var key in radius){
                pie.append("svg:path")
                    .attr("class", "boundary " + key)
                    .style('stroke', "#000000")
                    .style('stroke-width', "1px")
                    .style("stroke-opacity", "0.2")
                    .style("fill", "transparent")
                    .attr('d', arc(key));
            }
        });

        var commits = contributors.selectAll(".commits")
            .data(function(d){
                return d.data.commits;
            })

    });

    return this;
}

