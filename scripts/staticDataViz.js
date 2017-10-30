$(function(){
    $("body").width(window.innerWidth).height(window.innerHeight);
    var genereator = new graphGenerator();

    var settings = {
        collaboratorToCompare: window.dataStore.authors[0].id,
        maxCollaborators: 10
    };

    var select = $("#vizForm select");
    var maxCollaborator = $("#vizForm input");

    window.dataStore.authors.forEach(function(d){
        select.append("<option value='" + d.id + "' " + (settings.collaboratorToCompare === d.id ? "selected='selected'" : "") + ">" + d.id + "</option>");
    });

    maxCollaborator.val(settings.maxCollaborators);

    $("#update-settings").on("click", function(){
        settings.maxCollaborators = Math.min(Math.max(maxCollaborator.val(), 3), 100);
        maxCollaborator.val(settings.maxCollaborators);
        settings.collaboratorToCompare = select.val();
        genereator.generate(window.dataStore.processedData, settings);
    });

    $("#update-settings").trigger("click")
});

function graphGenerator(){
    var boundary = Math.min($("#vizContainer").width(), $("#vizContainer").height()),
        margins = boundary * 0.062,
        diameter = boundary - (2 * margins),
        outerRadius = diameter / 2,
        radiusDelta = diameter * 0.229,
        innerRadius = outerRadius - radiusDelta;

    var pie = d3.layout.pie()
        .sort(null)
        .padAngle(.01)
        .value(function(d) {
            return 1;
        });

    var linearScale = d3.scale.linear();

    var logScale = d3.scale.log();

    var bundle = d3.layout.bundle();

    var edgeBundles = d3.svg.line.radial()
        .interpolate("bundle")
        .tension(.95)
        .radius(function(d) {
            return d.radius;
        })
        .angle(function(d) {
            return d.angle;
        });

    var line = d3.svg.line.radial().interpolate("cardinal");
    var area = d3.svg.area.radial().interpolate("cardinal");

    var arc = d3.svg.arc();

    var svg = d3.select("#contributor-chart")
        .attr("width", diameter + (2 * margins))
        .attr("height", diameter + (2 * margins))
            .append("g")
            .attr("transform", "translate(" + (outerRadius + margins) + "," + (outerRadius + margins) + ")")
            .append("g");


    var d3ContributorNodes = svg.selectAll(".contributor");
        svg.append("g").attr("class", "links");


    this.generate = function(contributorEvents, settings) {
        var weekOnly = true;
        var slicedInput = contributorEvents.slice(0, settings.maxCollaborators);
        var author = slicedInput.find(function(d){ return d.author === settings.collaboratorToCompare;})

        if (!author) {
            slicedInput.pop();
            author = contributorEvents.find(function(d){ return d.author === settings.collaboratorToCompare;});
            slicedInput.unshift(author);
        }

        var nodes = getEventNodes({name: "root", children: slicedInput}, 0, true);

        var maxWeekEvent = 0, maxCommit = 0, maxAddition = 0, maxDeletion = 0;

        var contributorNodesData = nodes.filter(function(d){ return d.depth === 1; });

        svg.transition().duration(1500)
            .attr("transform", "rotate(" + (-author.angle * (180/Math.PI)) + ")");


        var weekNodesData = nodes.filter(function(d){
                if (d.depth === 2){
                    maxWeekEvent = Math.max(maxWeekEvent, d.singleActors + d.doubleActors);
                    maxCommit = Math.max(d.commits, maxCommit);
                    maxAddition = Math.max(d.additions, maxAddition);
                    maxDeletion = Math.max(d.deletions, maxDeletion);
                    return true;
                }
                return false;
            });

        var eventNodesData = nodes.filter(function(d){ return d.depth === 3; });

        /**** Contributor ****/
        arc.innerRadius(innerRadius).outerRadius(outerRadius);

        d3ContributorNodes = d3ContributorNodes.data(contributorNodesData, function(d){
            return d.author;
        });

        var d3ContributorNodesEnter = d3ContributorNodes.enter()
                .append("g")
                .attr("class", "contributor");

        d3ContributorNodesEnter
                .append("path")
                .attr("class", "contributorBG")
                .attr("id", function(d){
                    return d.author + "contributorBorder"
                });

        d3ContributorNodesEnter.append("path").attr("class", "commitBG");
        d3ContributorNodesEnter.append("path").attr("class", "commitAxis");
        d3ContributorNodesEnter.append("path").attr("class", "addDelAxis");

        d3ContributorNodesEnter.append("text")
            .attr("class", "authors")
            .attr("dy", -10)
            .append("textPath")
            .attr("xlink:href", function(d){
                return "#" + d.author + "contributorBorder"
            });

        d3ContributorNodes.selectAll("text").selectAll("textPath")
            .attr("startOffset", function(d){
                return (d.angle - d.startAngle) * outerRadius;
            })
            .text(function(d){
                return d.author.substring(0,Math.round((d.endAngle - d.startAngle) * outerRadius / 10));
            });

        d3ContributorNodes.selectAll(".contributorBG")
                .attr("class", function(d){
                    return "contributorBG" + (d.author === settings.collaboratorToCompare? " comparing" : "");
                })
                .transition()
                .duration(750)
                .style("stroke-width", function(d){
                    return 106 * d.padAngle;
                })
                .attr("d", arc);

        d3ContributorNodes.exit().remove();
        /**** Contributor ****/


        /**** Contributor Commits/Additions/Deletions ****/
        logScale.domain([1, maxDeletion]).range([innerRadius + (radiusDelta * 0.47), innerRadius + (radiusDelta * 0.28)]);

        d3ContributorNodes.selectAll(".addDelAxis")
            .attr("d", function(d){
                var perAngle = (d.endAngle - d.startAngle - d.padAngle)/d.weeks.length;
                var halfAngle = perAngle/2;
                var startAngle = d.startAngle + halfAngle + d.padAngle/2;

                line.radius(function(week, i){
                    return logScale(1);
                }).angle(function(week, i){
                    return startAngle + (perAngle * i);
                });
                return line(d.weeks);
            });

        d3ContributorNodesEnter.append("path").attr("class", "deletions");
        d3ContributorNodes.selectAll(".deletions")
            .transition().duration(750)
            .attr("d", function(d){
                var perAngle = (d.endAngle - d.startAngle - d.padAngle)/d.weeks.length;
                var halfAngle = perAngle/2;
                var startAngle = d.startAngle + halfAngle + d.padAngle/2;

                area.innerRadius(function(week, i){
                    return logScale(1);
                }).outerRadius(function(week, i){
                    return logScale(week.deletions + 1);
                }).angle(function(week, i){
                    return startAngle + (perAngle * i);
                });

                return area(d.weeks);
            });

        logScale.domain([1, maxAddition]).range([innerRadius + (radiusDelta * 0.47), innerRadius + (radiusDelta * 0.66)]);
        d3ContributorNodesEnter.append("path").attr("class", "additions");
        d3ContributorNodes.selectAll(".additions")
            .transition().duration(750)
            .attr("d", function(d){
                var perAngle = (d.endAngle - d.startAngle - d.padAngle)/d.weeks.length;
                var halfAngle = perAngle/2;
                var startAngle = d.startAngle + halfAngle + d.padAngle/2;

                area.innerRadius(function(week, i){
                    return logScale(1);
                }).outerRadius(function(week, i){
                    return logScale(week.additions + 1);
                }).angle(function(week, i){
                    return startAngle + (perAngle * i);
                });

                return area(d.weeks);
            });

        logScale.domain([1, maxCommit]).range([innerRadius + (radiusDelta * 0.75), innerRadius + (radiusDelta * 0.95)]);
        arc.innerRadius(innerRadius + (radiusDelta * 0.70)).outerRadius(innerRadius + radiusDelta);
        d3ContributorNodes.selectAll(".commitBG")
            .attr("d", arc);

        d3ContributorNodes.selectAll(".commitAxis")
            .attr("d", function(d){
                var perAngle = (d.endAngle - d.startAngle - d.padAngle)/d.weeks.length;
                var halfAngle = perAngle/2;
                var startAngle = d.startAngle + halfAngle + d.padAngle/2;

                line.radius(function(week, i){
                    return logScale(1);
                }).angle(function(week, i){
                    return startAngle + (perAngle * i);
                });
                return line(d.weeks);
            });

        d3ContributorNodesEnter.append("path").attr("class", "commits");
        d3ContributorNodes.selectAll(".commits")
            .transition().duration(750)
            .attr("d", function(d){
                var perAngle = (d.endAngle - d.startAngle - d.padAngle)/d.weeks.length;
                var halfAngle = perAngle/2;
                var startAngle = d.startAngle + halfAngle + d.padAngle/2;

                line.radius(function(week, i){
                    return logScale(week.commits + 1);
                }).angle(function(week, i){
                    return startAngle + (perAngle * i);
                });

                return line(d.weeks);
            });
        /**** Contributor Commits/Additions/Deletions ****/


        /**** Week Events ****/
        logScale.domain([1, maxWeekEvent]).range([innerRadius, innerRadius + (radiusDelta * 0.25)]);

        var d3WeekNodes = d3ContributorNodes.selectAll(".weekNode").data(function(d){
            return d.children;
        }, function(d){
            return d.parent.author + d.week;
        });

        d3WeekNodes
                .enter().append("g")
                .attr("class", "weekNode")
                .each(function(d, i){
                    var week = d3.select(this);

                    if (d.doubleActors > 0){
                        week.append("path")
                            .attr("class", "doubleActors weeklyEvent");
                    }

                    if (d.singleActors > 0) {
                        week.append("path")
                            .attr("class", "singleActors weeklyEvent");
                    }

                    week.append("path")
                        .attr("class", "noWeekEvent weeklyEvent");
                });

        d3WeekNodes
            .each(function(d, i){
                var week = d3.select(this);

                var lower = logScale(1);
                if (d.doubleActors > 0){
                    week.select(".doubleActors").transition().duration(750)
                        .attr("d", arc.innerRadius(lower).outerRadius(lower = logScale(d.doubleActors + 1)));
                }

                if (d.singleActors > 0) {
                    week.select(".singleActors").transition().duration(750)
                        .attr("d", arc.innerRadius(lower).outerRadius(lower = logScale(d.doubleActors + d.singleActors + 1)));
                }

                week.select(".noWeekEvent").transition().duration(750)
                    .attr("d", arc.innerRadius(lower).outerRadius(logScale(maxWeekEvent)));
            });

        d3WeekNodes.exit().remove();
        /**** Week Events ****/


        /**** Week Event Links ****/
        var d3EventLinks = svg.select(".links").selectAll(".eventLink")
            .data(bundle(getLinks(nodes, weekOnly)), function(d){
                d.source = d[0], d.target = d[d.length - 1];
                return d.source.parent.author + " " + d.target.parent.author + " " + (d.source[weekOnly ? "week" : "timestamp"]);
            });

        d3EventLinks.enter()
            .append("path")
            .attr("class", "eventLink");

        d3EventLinks
            .transition().duration(750)
            .attr("stroke", function(d){
                return "url(#" + d.source.parent.author + d.target.parent.author + d.source.week + ")";
            })
            .style("stroke-width", function(d){
                return (d.source.endAngle - d.source.startAngle) * 100;
            })
            .attr("d", edgeBundles);

        d3EventLinks.exit().remove();

        /*** link gradients ***/

        var d3EventLinksGradients = d3.select("#contributor-chart defs").selectAll(".linearGradients")
            .data(bundle(getLinks(nodes, weekOnly)), function(d){
                d.source = d[0], d.target = d[d.length - 1];
                return d.source.parent.author + " " + d.target.parent.author + " " + (d.source[weekOnly ? "week" : "timestamp"]);
            });

        d3EventLinksGradients.enter()
            .append("linearGradient")
            .attr("class", "linearGradients")
            .attr("id", function(d){
                return d.source.parent.author + d.target.parent.author + d.source.week;
            })
            .attr("xlink:href", "#linear");

        d3EventLinksGradients
            .attr("x1", function(d){
                return Math.ceil(Math.cos(d.source.angle - Math.PI/2));
            })
            .attr("y1", function(d){
                return Math.ceil(Math.sin(d.source.angle - Math.PI/2));
            })
            .attr("x2", function(d){
                return Math.ceil(Math.cos(d.target.angle - Math.PI/2));
            })
            .attr("y2", function(d){
                return Math.ceil(Math.sin(d.target.angle - Math.PI/2));
            })

        d3EventLinksGradients.exit().remove();
        /**** Week Event Links ****/



        d3WeekNodes.on("mouseover", function(d) {
            var link = d3EventLinks.filter(function(link){
                return (link.source.parent.author === d.parent.author || link.target.parent.author === d.parent.author) && link.source.week === d.week;
            });
            svg.select(".links").attr("class", "links highlighting");
            link.attr("class", "eventLink highlight");
        }).on("mouseout", function(d){
            svg.select(".links").attr("class", "links");
            d3EventLinks.attr("class", "eventLink");
        });

        d3ContributorNodes.on("mouseover", function(d){
            var text = d3.select(this).selectAll("text");
            text.select("textPath").remove("textPath");
            text
                .attr("transform", "rotate(" + (d.angle * 180 / Math.PI) + ")")
                .attr("y", -(outerRadius + (boundary * 0.025)))
                .text(function(d){
                    return d.author;
                });
        }).on("mouseout", function(d){
            var text = d3.select(this).selectAll("text");
            text.text(null);
            text.attr("transform", null)
                .attr("y", null)
            text.attr("dy", -(boundary * 0.012))
                .append("textPath")
                .attr("xlink:href", "#" + d.author + "contributorBorder")
                .attr("startOffset", (d.angle - d.startAngle) * outerRadius)
                .text(d.author.substring(0,Math.round((d.endAngle - d.startAngle) * outerRadius / 10)));
        });
        /*********** Chart complete **********/

        makeLegend({
            startAngle: 0,
            endAngle: 0.6283185307179587,
            padAngle: 0.01884955592153876,
            angle: 0.31415926535897937,
            maxDeletion: maxDeletion,
            maxAddition: maxAddition,
            maxCommit: maxCommit,
            maxWeekEvent: maxWeekEvent,
            innerRadius: innerRadius,
            outerRadius, outerRadius,
            margins: margins,
            boundary: boundary,
            radiusDelta: radiusDelta
        });

    }

    function makeLegend(lData) {
        var legend = d3.select("#legendContainer")
            .attr("width", $("#vizForm").width())
            .attr("height", lData.outerRadius - 2 * lData.margins);

        legend.select("g").remove();
        legend = legend.append("g").attr("transform", "translate(" + ($("#vizForm").width()/2) + ", " + (lData.outerRadius + lData.margins) + ")");
        legend = legend.append("g").attr("transform", "rotate(" + (-lData.angle * (180/Math.PI)) + ")");

        arc.innerRadius(innerRadius).outerRadius(outerRadius);
        legend.append("path")
            .attr("id", "legendContibutorBG")
            .attr("class", "contributorBG")
            .attr("d", arc(lData));
        legend.append("text")
            .attr("class", "authors")
            .attr("dy", -(lData.boundary * 0.012))
            .append("textPath")
             .attr("xlink:href", "#legendContibutorBG")
             .attr("startOffset", (lData.angle - lData.startAngle) * lData.outerRadius)
             .text("Contributor's ID");

        arc.innerRadius(lData.innerRadius).outerRadius(lData.innerRadius + (lData.radiusDelta * 0.25));
        legend.append("path")
            .attr("id", "legendWeeklyEvent")
            .attr("class", "noWeekEvent weeklyEvent")
            .attr("d", arc(lData));

        //
        legend.append("path")
            .attr("id", "legendWeeklyEvent")
            .attr("class", "singleActors weeklyEvent")
            .attr("d", arc({
                startAngle: 0,
                endAngle: lData.endAngle * 0.1
            }));

        legend.append("path")
            .attr("id", "legendWeeklyEvent")
            .attr("class", "doubleActors weeklyEvent")
            .attr("d", arc({
                startAngle: lData.endAngle - lData.endAngle * 0.1,
                endAngle: lData.endAngle
            }));

        legend.append("text")
            .attr("dy", (boundary * 0.046))
            .append("textPath")
             .attr("xlink:href", "#legendWeeklyEvent")
             .attr("startOffset", (lData.angle - lData.startAngle) * (lData.innerRadius + (lData.radiusDelta * 0.25)))
             .text("0 Events");
        legend.append("text")
            .attr("transform", "rotate(" + (lData.angle * (180/Math.PI)) + ")")
            .attr("x", lData.innerRadius * Math.cos(lData.startAngle - Math.PI/2))
            .attr("y", lData.innerRadius * Math.sin(lData.startAngle - Math.PI/2))
            .attr("dx", (-lData.boundary * 0.08))
            .attr("dy", (lData.boundary * 0.01))
            .style("text-anchor", "end")
            .text("Single Actor Events");

        legend.append("text")
            .attr("transform", "rotate(" + (lData.angle * (180/Math.PI)) + ")")
            .attr("x", lData.innerRadius * Math.cos(lData.startAngle - Math.PI/2))
            .attr("y", lData.innerRadius * Math.sin(lData.startAngle - Math.PI/2))
            .attr("dx", (lData.boundary * 0.08))
            .attr("dy", (lData.boundary * 0.01))
            .style("text-anchor", "start")
            .text("Double Actor Events");

        legend.append("text")
            .attr("dy", (lData.boundary * 0.013))
            .append("textPath")
             .attr("xlink:href", "#legendWeeklyEvent")
             .attr("startOffset", (lData.angle - lData.startAngle) * (lData.innerRadius + (lData.radiusDelta * 0.25)))
             .text(lData.maxWeekEvent + " Events");

        arc.innerRadius(lData.innerRadius + (lData.radiusDelta * 0.28)).outerRadius(lData.innerRadius + (lData.radiusDelta * 0.47));
        legend.append("path")
            .attr("id", "legendDeletions")
            .attr("class", "deletions")
            .attr("d", arc(lData));

        legend.append("text")
            .attr("dy", (lData.boundary * 0.035))
            .append("textPath")
             .attr("xlink:href", "#legendDeletions")
             .attr("startOffset", (lData.angle - lData.startAngle) * (lData.innerRadius + (lData.radiusDelta * 0.47)))
             .text(lData.maxDeletion + " Deletions");

        arc.innerRadius(lData.innerRadius + (lData.radiusDelta * 0.47)).outerRadius(lData.innerRadius + (lData.radiusDelta * 0.66));
        legend.append("path")
            .attr("id", "legendAdditions")
            .attr("class", "additions")
            .attr("d", arc(lData));
        legend.append("text")
            .attr("dy", (lData.boundary * 0.014))
            .append("textPath")
             .attr("xlink:href", "#legendAdditions")
             .attr("startOffset", (lData.angle - lData.startAngle) * (lData.innerRadius + (lData.radiusDelta * 0.66)))
             .text(lData.maxAddition + " Additions");
        legend.append("text")
            .append("textPath")
             .attr("xlink:href", "#legendDeletions")
             .attr("startOffset", (lData.angle - lData.startAngle) * (lData.innerRadius + (lData.radiusDelta * 0.47)))
             .text("0 Addition/Deletion");


        arc.innerRadius(lData.innerRadius + (lData.radiusDelta * 0.70)).outerRadius(lData.outerRadius);
        legend.append("path")
            .attr("id", "legendCommitBg")
            .attr("class", "commitBG")
            .attr("d", arc(lData));

        arc.innerRadius(lData.innerRadius + (lData.radiusDelta * 0.75)).outerRadius(lData.innerRadius + (lData.radiusDelta * 0.95));
        legend.append("path")
            .attr("id", "commitAxis")
            .attr("class", "commitAxis")
            .attr("d", arc(lData));
        legend.append("text")
            .attr("dy", (lData.boundary * 0.035))
            .append("textPath")
             .attr("xlink:href", "#commitAxis")
             .attr("startOffset", (lData.angle - lData.startAngle) * (lData.innerRadius + (lData.radiusDelta * 0.95)))
             .text(0 + " Commits");
        legend.append("text")
            .attr("dy", (boundary * 0.015))
            .append("textPath")
             .attr("xlink:href", "#commitAxis")
             .attr("startOffset", (lData.angle - lData.startAngle) * (lData.innerRadius + (lData.radiusDelta * 0.95)))
             .text(lData.maxCommit + " Commits");
    }

    function getEventNodes(tree, depth, weekOnly){
        var nodes = [tree];

        tree.depth = depth;

        if(depth === 0) {
            tree.radius = 0;
            tree.angle = 0;
        } else if (depth === 1){
            tree.angle = (tree.startAngle + tree.endAngle)/2;
            tree.radius = weekOnly ? (innerRadius/2) : innerRadius;
        } else if (depth === 2 || depth === 3) {
            tree.angle = (tree.startAngle + tree.endAngle)/2;
            tree.radius = weekOnly ? innerRadius : outerRadius + (boundary * 0.044);
        }

        if (tree.children != null && typeof tree.children === "string") {
            tree.children = tree[tree.children];
        }

        if (tree.children != null && tree.children.length === 0) {
            delete tree.children;
        }

        if (tree.children != null){
            var startAngle = tree.startAngle || 0;
            var endAngle = tree.endAngle || (2 * Math.PI);
            var padAngle = 0.03 * (endAngle - startAngle)/tree.children.length;

            if (depth === 0) {
                pie.startAngle(0).endAngle(2 * Math.PI).padAngle(padAngle);
                tree.children = pie(tree.children);
            } else if (depth === 1) {
                pie.startAngle(tree.startAngle + tree.padAngle).endAngle(tree.endAngle - tree.padAngle).padAngle(padAngle);
                tree.children = pie(tree.children);
            } else if (depth === 2) {
                if (weekOnly) {
                    pie.startAngle(tree.parent.startAngle + tree.padAngle).endAngle(tree.parent.endAngle - tree.padAngle).padAngle(padAngle);
                } else {
                    pie.startAngle(tree.parent.startAngle - (Math.PI/4)).endAngle(tree.parent.endAngle + (Math.PI/4)).padAngle(padAngle);
                }
                tree.children = pie(tree.children);
            }

            for(var i=0; i < tree.children.length; i++) {
                if (tree.children[i].data != null) {
                    tree.children[i].data.startAngle = tree.children[i].startAngle;
                    tree.children[i].data.endAngle = tree.children[i].endAngle;
                    tree.children[i].data.padAngle = tree.children[i].padAngle;
                    tree.children[i] = tree.children[i].data;
                }

                tree.children[i].parent = tree;
                nodes = nodes.concat(getEventNodes(tree.children[i], depth + 1, weekOnly));
            }
        }
        return nodes;
    }

    function getLinks(nodes, weekOnly) {
        var fNodes = nodes.filter(function(d){return d.depth === 3 && d.category === "doubleActor" && d.assignee == null && d.to == null;});
        var links = [];
        fNodes.forEach(function(node){
            var source = node.parent.parent.parent;
            source = source.children.find(function(contributor){ return contributor.author === (node.from || node.assigner); });
            if (source != null) {
                source = source.children.find(function(week){ return week.week === node.parent.week; });
                // if (weekOnly !== true && source != null) {
                //     source = source.children.find(function(event){ return event.timestamp === node.timestamp && (node.from || node.assigner) === (event.to || event.assignee); });
                // }
            }

            if (source != null){
                links.push({source: source, target: (weekOnly === true ? node.parent : node)});
            }
        });
        return links;
    }
}

























