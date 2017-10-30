function StatStorage(){

    var settings = null;
    var topContributors = [];
    var cIndex = {};
    var startTime = null;
    var startTimeISO = null;
    var cache = true;
    var endTime = null;
    var endTimeISO = null;
    var millisInWeek = 7 * 24 * 60 * 60 * 1000;

    var eventsTrackers = {
        singleActor: ["closed", "reopened", "subscribed", "merged", "labeled", "unlabeled", "milestoned",
            "demilestoned", "renamed", "locked", "unlocked"],
        doubleActor: ["assigned", "unassigned"],
        doubleActorCommenting: ["mentioned"]
    };

    function getRequest(url, noCache) {
        var promise = $.Deferred();

        setTimeout(function(){
            var data = cache ? JSON.parse(localStorage.getItem(url)) : null;
            if (cache && data) {
                promise.resolve(data, url);
            } else {
                $.ajax({
                    type: "GET",
                    contentType: "application/json; charset=utf-8",
                    dataType: 'json',
                    async: true,
                    cache: noCache != null ? !noCache : cache,
                    headers: {
                        Authorization: "token " + settings.accessToken
                    },
                    url: url
                }).then(function(data, status, xhr) {
                    if (status == "success") {
                        if ((noCache == null || !noCache) && cache){
                            setTimeout(function() {
                                localStorage.setItem(url, JSON.stringify(data));
                            }, 0);
                            localStorage.setItem("lastUpdate", new Date().getTime());
                        }
                        promise.resolve(data, url, xhr.getAllResponseHeaders());
                    } else {
                        promise.reject("API failure!!");
                        alert("API failure!!");
                    }
                }, function(data, status){
                    promise.reject("API failure!!");
                    alert(status);
                });
            }
        });

        return promise;
    }

    function setTopContributors() {
        topContributors = [];
        var url = "https://api.github.com/repos/" + settings.repoOwner + "/" + (settings.repoName) + "/stats/contributors";
        return getRequest(url).then(function(data){
            var lower = data.length - settings.maxCollaborators - 1;
            contributorInComparison = data.find(function(d){ return d.author.login === settings.collaboratorToCompare; });
            topContributors.push({
                name: settings.collaboratorToCompare,
                contributorUrl: contributorInComparison.author.html_url,
                commits: [],
                events: []
            });
            cIndex[settings.collaboratorToCompare] = 0;

            for(var i = data.length - 1; i >= lower; i--) {
                if (data[i].author.login !== settings.collaboratorToCompare) {
                    topContributors.push({
                        name: data[i].author.login,
                        contributorUrl: data[i].author.html_url,
                        commits: [],
                        events: []
                    });
                    cIndex[data[i].author.login] = topContributors.length - 1;
                } else {
                    lower++;
                }
            }
        });
    }

    function setCommitData() {
        var url = "https://api.github.com/repos/" + settings.repoOwner + "/" + (settings.repoName) + "/stats/contributors";
        return getRequest(url).then(function(data){
            data = data.filter(function(d){
                return Object.keys(cIndex).indexOf(d.author.login) !== -1;
            });

            data.forEach(function(contributorData) {
                var contributor = topContributors[cIndex[contributorData.author.login]];
                var startTimeSec = startTime/1000;

                for (var i = contributorData.weeks.length - 1; contributorData.weeks[i].w >= startTimeSec && i >= 0; i--) {
                    contributor.commits.unshift({
                        week: contributorData.weeks[i].w * 1000,
                        additions: contributorData.weeks[i].a,
                        deletions: contributorData.weeks[i].d,
                        commits: contributorData.weeks[i].c
                    });
                }
            });

            return topContributors;
        });
    }

    function prepareEvents() {
        var url = "https://api.github.com/repos/" + settings.repoOwner + "/" + (settings.repoName) +
                    "/issues/events?page=";

        topContributors.forEach(function(cont) {
            for(var i=0; i < settings.weeksInTimeline; i++) {
                cont.events[i] = {
                    week: parseInt((new Date(startTime + (i * millisInWeek))).getTime()),
                    events: []
                };
            }
        });

        var events = []
        var promise = $.Deferred();

        function buildEventList(page) {
            getRequest(url + page, true).then(function(data) {
                var pageEvent = [];
                var limitHit = data.some(function(event) {
                    console.log(startTimeISO + " | " + event.created_at);
                    if (event.created_at >= startTimeISO && event.created_at <= endTimeISO && cIndex[event.actor.login] != null) {
                        var eventObj = {
                            time: event.created_at,
                            event: event.event,
                            issueID: event.issue.number,
                            issueUrl: event.issue.html_url,
                            actor: event.actor.login,
                            actorUrl: event.actor.html_url,

                        };

                        // topContributors[cIndex[event.actor.login]].events[week].events.unshift(eventObj);
                        pageEvent.unshift(eventObj);

                        if (eventsTrackers.singleActor.indexOf(event.event) !== -1) {
                            eventObj.category = "singleActor";
                        } else if (eventsTrackers.doubleActor.indexOf(event.event) !== -1) {
                            eventObj.category = "doubleActor";
                            eventObj.from = event.assigner.login;
                        } else if (eventsTrackers.doubleActorCommenting.indexOf(event.event) !== -1) {
                            eventObj.category = "doubleActorCommenting";
                            // getRequest(event.issue.comments_url + "?since=" + event.created_at).then(function(d) {
                            //     comment = d.find(function(comment) {
                            //         return comment.created_at === eventObj.time;
                            //     });
                            //     if (comment != null) {
                            //         eventObj.from = comment.user.login;
                            //     }
                            // });
                        }
                    } else if (event.created_at < startTimeISO){
                        return true;
                    }
                });

                events[page - 1] = pageEvent;

                if (!limitHit) {
                    return buildEventList(++page);
                } else {
                    promise.resolve(events);
                }
            });
        }

        setTimeout(function(){
            data = JSON.parse(localStorage.getItem("events"));
            if(data == null){
                buildEventList(1);
            } else {
                promise.resolve(data);
            }
        },0);

        return promise.then(function(data){
            localStorage.setItem("events", JSON.stringify(data));
            data = data.reduce(function(a, b) {
                return a.concat(b);
            }, []);
            data.forEach(function(event){
                var week = Math.floor((Date.parse(event.time) - startTime)/millisInWeek);
                topContributors[cIndex[event.actor]].events[week].events.unshift(event);
            })
            return topContributors;
        });
    }

    function buildAllEvents(){
        var resultCounter = 0;
        var last = 1334;
        var ratelimit = 1338;
        var event = [];
        var authors = window.dataStore.authors.map(function(d){ return d.login; });
        var issues = {};
        var promises = [];
        var breakNow = false;
        window.results = {
            event: event,
            issues: issues
        };

        function queueEvent(page) {
            setTimeout(function(){
                console.log("Hitting page " + page);

                promises.push(getRequest("https://api.github.com/repos/tensorflow/tensorflow/issues/events?page=" + page , true)
                    .then(function(data, url){
                        resultCounter++;
                        console.log("Got page " + page);
                        if (data.message != null) {
                            console.error("Breaking at " + i);
                            breakNow = true;
                        } else {
                            var pageNumer = +url.split('?')[1].split('=')[1];
                            var eventSubArray = [];
                            var recordHit = 0;
                            data.forEach(function(d){
                                var eventObj = {
                                    actor: d.actor.login,
                                    type: d.event,
                                    timestamp: d.created_at,
                                    issue: d.issue.number
                                };

                                if (d.assigner != null) {
                                    eventObj.assigner = d.assigner.login;
                                }

                                eventSubArray.push(eventObj);
                                recordHit++;

                                if (issues[d.issue.number] == null) {
                                    var authorsRef = false;
                                    console.log("One of the author involved in a new issue encounter #" + d.issue.number);
                                    issues[d.issue.number] = {
                                        number: d.issue.number,
                                        url: d.issue.html_url,
                                        title: d.issue.title,
                                        body: d.issue.body,
                                        user: d.issue.user.login,
                                        state: d.issue.state,
                                        assignees: d.issue.assignees.map(function(user){return user.login;}),
                                        createdAt: d.issue.created_at,
                                        updatedAt: d.issue.updated_at,
                                        closedAt: d.issue.closed_at
                                    };
                                }
                            });
                            if (event[pageNumer] != null){
                                console.error("overwriting");
                            }

                            event[pageNumer] = eventSubArray;
                            console.log("Record Complete, Total records on page " + pageNumer + ": " + recordHit);
                        }
                    }, function(){
                        resultCounter++;
                    })
                );
            }, ratelimit * page);
        }

        for (var i = 1; !breakNow && i <= last; i++) {
            console.log("Queuing page " + i);
            queueEvent(i);
        }

        var interval = setInterval(function(){
            if (resultCounter == last) {
                clearInterval(interval);
                window.results.event = window.results.event.reduce(function(a, b) {
                    return a.concat(b);
                }, []);
            }
        }, 1338);
    };

    this.setSettings = function(newSettings) {
        settings = newSettings;
        var promise = $.Deferred();

        // cache = false;

        // buildAllEvents();

        // setTimeout(function(){
        //     promise.reject();
        // }, 1000);
        // return promise;

        var lastUpdate = new Date(parseInt(localStorage.getItem("lastUpdate")));
        endTime = new Date();

        if (!(endTime.getUTCDay() <= lastUpdate.getUTCDay() && (endTime - lastUpdate) <= millisInWeek)){
            cache = false;
        } else {
            cache = settings.cacheEnabled;
        }

        endTime.setDate(endTime.getUTCDate() - endTime.getUTCDay());
        endTime.setUTCHours(0); endTime.setUTCMinutes(0); endTime.setUTCSeconds(0); endTime.setUTCMilliseconds(0);
        endTimeISO = endTime.toISOString().replace(/\.[0-9]{1,3}Z/, 'Z');
        endTime = endTime.getTime();
        startTime = new Date(endTime - (settings.weeksInTimeline * millisInWeek));
        startTimeISO = startTime.toISOString().replace(/\.[0-9]{1,3}Z/, 'Z');
        startTime = startTime.getTime();
        setTopContributors().then(function(){
            var commitPromise = setCommitData();
            var eventPromise = prepareEvents();
            promise.resolve(eventPromise);
        });

        return promise;
    }
}














































