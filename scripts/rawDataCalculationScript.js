    var authorsList = dataStore.contributorStats.map(function(d){return d.author;});
    var weeks = dataStore.contributorStats[0].weeks.map(function(week){return week.week;});
    var eventsTrackers = {
        singleActor: ["closed", "reopened", "subscribed", "merged", "labeled", "unlabeled", "milestoned",
            "demilestoned", "renamed", "locked", "unlocked"],
        doubleActor: ["assigned", "unassigned", "mentioned"],
        // doubleActorCommenting: ["mentioned"]
    };
    var availableWeeks = weeks.slice(0);
    var runningWeek = null;
    var cutoffTime = null;

    //Arrange in chronological order
    dataStore.events.reverse();

    runningWeek = new Date(Date.parse(availableWeeks[0]) - (1000 * 60 * 60 * 24 * 7)).toISOString().replace(/\.[0-9]{1,3}Z/, 'Z');
    cutoffTime = new Date(Date.parse(availableWeeks[0]) - (1000 * 60 * 60 * 24 * 7 * 2)).toISOString().replace(/\.[0-9]{1,3}Z/, 'Z');

    while(runningWeek < dataStore.events[0].timestamp){
        cutoffTime = runningWeek;
        runningWeek = availableWeeks.shift();
    }

    if (Math.ceil((Date.parse(runningWeek) - Date.parse(dataStore.events[0].timestamp))/(1000 * 60 * 60 * 24)) < 7){
        cutoffTime = runningWeek;
        runningWeek = availableWeeks.shift();
    }

    var period = [runningWeek, availableWeeks[availableWeeks.length - 1]];

    console.log("Consistent available timeline : " + period[0] + "  ->  " + period[1]);
    console.log("trimming");

    dataStore.events = dataStore.events.filter(function(event){
        return event.timestamp >= period[0] && event.timestamp < period[1] &&
        (authorsList.indexOf(event.actor) !== -1 || (event.assigner !== null && authorsList.indexOf(event.assigner) !== -1));
    });

    dataStore.contributorStats.forEach(function(contributor) {
        var total = 0;
        contributor.weeks = contributor.weeks.filter(function(week){
            if (week.week >= runningWeek && week.week <= period[1]){
                total += week.commits;
                return true;
            }
            return false;
        });

        contributor.total = total;
    });

    weeks = [runningWeek].concat(availableWeeks.slice(0));

    var events = [];

    authorsList.forEach(function(author){
        var authorObject = {
            author: author,
            weeks: weeks.map(function(week){
                    var weekObject = {
                        event: [],
                        week: week,
                        doubleActors: 0,
                        singleActors: 0,
                        children: "event"
                    };
                    return weekObject;
                }),
            children: "weeks"
        };

        events.push(authorObject);
    });

    dataStore.events.forEach(function(event){
        while(runningWeek == null || runningWeek < event.timestamp){
            runningWeek = availableWeeks.shift();
        }

        if (runningWeek != null && event.timestamp < runningWeek) {
            var authorIndex = authorsList.indexOf(event.actor);
            if (authorIndex === -1) {
                authorIndex = authorsList.indexOf(event.assigner)
            }
            var weekObject = events[authorIndex].weeks[weeks.indexOf(runningWeek)];

            if (eventsTrackers.singleActor.indexOf(event.type) !== -1){
                event.category = "singleActor";
                weekObject.singleActors++;
            } else if (eventsTrackers.doubleActor.indexOf(event.type) !== -1){
                // v         Temporary addition
                if (event.type === "mentioned") {
                    event.from = event.actor === "vrv" ? "mrry" : "vrv";
                }
                // ^         Temporary addition
                weekObject.doubleActors++;
                event.category = "doubleActor";
            }

            weekObject.event.push(event);
        }
    });

    events.forEach(function(contributor){
        var author = dataStore.contributorStats.find(function(d){ return d.author === contributor.author; });
        contributor.totalCommits = author.total;
        contributor.weeks.forEach(function(week, i){
            $.extend(week, author.weeks[i]);
        });
    });

    //Calculated Arrays events, contributorStats