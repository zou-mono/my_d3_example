var bData = null;
var bookToChapter = {};
var bookToChapterCount = {};
var maxLength = 250;

var contra = null;
var contraFilters = {
    source: window._contraSource ? window._contraSource : 'sab', /* Source of data, default SAB */
    book: null,         /* Specific book name */
    chapter: null,      /* Specific absolute chapter */
    type: null,         /* Specific contradiction type */
    search: null,       /* Text to search for via regex */
    refCount: null,     /* Specific range of references */
    crossBook: false,   /* Only show cross-book contradictions */
    colorize: 'Crimson' /* Colorize the arcs */
};

if (!window.maxArcs) {
    var maxArcs = 10;
}

// Available contradiction types
var contraTypeFilters = {
    'All': null,
    'Count': /(how (many|old))|(sixth)/i,
    'People': /(^\s*who)|(whom)|(whose)|(sons? of)|(mother)|(father)|(offspring)|(genealogy)|(related)/i,
    'Time': /(^\s*when)|(what day)|(which came first)/i,
    'Location': /(where)|(road)|(mountain)|(from the)/i,
    'Death': /(heaven)|(hell)|(die)|(death)|(lifespan)|(congregation of the lord)|(live long)/i,
    'Love': /(marry)|(marriage)|(love)|(sex)|(homosexual)|(conceive)|(wife)|(childbearing)|(adulterer)/i,
    'God': /god/i,
    'Jesus': /jesus/i,
    'Other': null
};

// Returns true if a new tab should be opened from a click
function newTab() {
    return (window.event && ((event.which == 1 && (event.ctrlKey === true || event.metaKey === true) || (event.which == 2))));
}

function getAbsoluteChapter(verse) {
    var parts = /^(\d?\s?[a-z]+)[\s.:]*(\d*):?(\d*)[-]?(\d*)/i.exec(verse);
    //console.log(parts);
    if (parts === null) return;

    var chapter = bookToChapter[parts[1]];
    chapter = (chapter === undefined) ? bookToChapter[parts[1] + 's'] : chapter;

    return chapter + parseInt(parts[2]);
}


// Chooses a color for an arc from start to end
function colorize(start, end) {
    var color = 'crimson';
    var distance;

    if (contraFilters.colorize == 'Rainbow') {
        distance = Math.abs(end - start);
        color = d3.hsl(distance / 1189 * 360, 0.7, 0.35);
    }

    return color;
}

/*
    Make sure we have a flat list of refs to filter or render.
    This handles the following two cases and returns a flat,
    plain list:

    ['Ref 1', 'Ref 2', ...]

    {
        'Some desc': ['Ref 1', 'Ref 2'],
        'Another': ['Ref 3', ...]
    }
*/
function flatRefs(refs) {
    var i, j, keys;

    if (refs instanceof Array) {
        refList = refs;
    } else {
        // This is an object with more info, so let's pull
        // out all the refs.
        refList = [];

        keys = Object.keys(refs);
        for (i = 0; i < keys.length; i++) {
            for (j = 0; j < refs[keys[i]].length; j++) {
                refList.push(refs[keys[i]][j]);
            }
        }
    }

    return refList;
}

function renderContra() {
    var textSearch = null;

    if (contraFilters.search) {
        textSearch = new RegExp(contraFilters.search, 'gi');
    }

    var chart = d3.select('#contradictions-chart')
        .selectAll('.arc')
        .data(contra[contraFilters.source].contradictions.filter(function (d) {
                var i, found, match, refList;

                refList = flatRefs(d.refs);

                // Filter out items that don't touch this chapter
                if (contraFilters.chapter !== null) {
                    found = false;

                    for (i = 0; i <= Math.min(refList.length - 1, 10); i++) {
                        if (getAbsoluteChapter(refList[i]) == contraFilters.chapter) {
                            found = true;
                            break;
                        }
                    }

                    if (!found) {
                        return false;
                    }
                }

                // Filter out items that don't touch this book
                if (contraFilters.book !== null) {
                    found = false;

                    for (i = 0; i < Math.min(refList.length - 1, 10); i++) {
                        match = /(\d?\s*\w+)/.exec(refList[i]);

                        if (match && (match[1] == contraFilters.book || match[1] + 's' == contraFilters.book)) {
                            found = true;
                            break;
                        }
                    }

                    if (!found) {
                        return false;
                    }
                }

                // Filter out the wrong type of item
                var regex;
                if (contraFilters.type !== null) {
                    if (contraFilters.type == 'Other') {
                        // Exclude any of the listed types except 'All' and 'Other'
                        var keys = Object.keys(contraTypeFilters);
                        for (i = 0; i < keys.length; i++) {
                            regex = contraTypeFilters[keys[i]];
                            if (regex && regex.test(d.desc)) {
                                return false;
                            }
                        }
                    } else {
                        // Include only this type
                        regex = contraTypeFilters[contraFilters.type];
                        if (regex && !regex.test(d.desc)) {
                            return false;
                        }
                    }
                }

                if (textSearch !== null) {
                    if (!textSearch.test(d.desc)) {
                        return false;
                    }
                }

                return true;
            }),
            // Key function to compare values on insert/update/remove
            function (d) {
                return d.desc;
            });

    chart.enter().append('g')
        .attr('class', 'arc')
        .on('click', function (d) {
            var url = '/' + slugg(d.desc) + '-' + contraFilters.source + '.html';
            //var url = 'http://www.skepticsannotatedbible.com/contra/' + d.url;

            // Handle [cmd/ctrl]+click and middle click to open a new tab
            if (newTab()) {
                window.open(url);
            } else {
                window.location = url;
            }
        })
        .on('mouseover', function (d) {
            var refList = flatRefs(d.refs);

            d3.select('#contradictions-chart')
                .selectAll('.arc')
                .sort(function (a, b) {
                    return (a == d) ? 1 : -1;
                });

            d3.select('#selected')
                .html(d.desc + '<br/><span class="subdued">' + refList.join(', ').substr(0, maxLength) + '</span>');
        })
        .each(function (d, i) {
            var group = d3.select(this);
            var refList = flatRefs(d.refs);

            if (refList.length > 1) {
                // Only show up to 10 refs, some have over 100...
                for (x = 0; x <= Math.min(maxArcs, refList.length - 2); x++) {
                    var start = getAbsoluteChapter(refList[x]);
                    var end = getAbsoluteChapter(refList[x + 1]);

                    if (start > end) {
                        var tmp = end;
                        end = start;
                        start = tmp;
                    }

                    var r = (end - start) * 0.51;
                    var ry = Math.min(r, 490);

                    if (!isNaN(start) && !isNaN(end) && !isNaN(r) && !isNaN(ry)) {
                        var path = 'M ' + start + ',399 A ' + r + ',' + ry + ' 0 0,1 ' + end + ',399 ';
                        group.append('path')
                            .attr('d', path)
                            .style('stroke', function (start, end) {
                                return colorize(start, end);
                            }(start, end));
                    }
                }
            }
        });

    chart.exit()
        .transition()
        .duration(350)
        .style('opacity', 0)
        .remove();

    // Update any highlighting from filters
    d3.select('#contradictions-chart')
        .selectAll('rect')
        .classed('selected', false);

    if (contraFilters.book !== null) {
        d3.select('#contradictions-chart')
            .selectAll('.b' + contraFilters.book.replace(/\s+/g, '').toLowerCase())
            .classed('selected', true);
    }
}

d3.select('#selected').transition().delay(7000).duration(1000).style('opacity', 1.0);

d3.json('data/kjv.json').then(function (json) {
    // if (err) {
    //     console.log(err);
    // }

    bData = json;

    var bookSelect = d3.select('#book-select');
    var chapters = [];
    var chapterCount = 0;

    for (var x = 0; x < json.sections.length; x++) {
        for (var y = 0; y < json.sections[x].books.length; y++) {
            bookSelect.append('option')
                .text(json.sections[x].books[y].shortName);
            bookToChapter[json.sections[x].books[y].shortName] = chapterCount;
            bookToChapterCount[json.sections[x].books[y].shortName] = 0;
            for (var z = 0; z < json.sections[x].books[y].chapters.length; z++) {
                chapterCount++;
                chapters.push({
                    section: json.sections[x].name,
                    book: json.sections[x].books[y].shortName,
                    chapter: json.sections[x].books[y].chapters[z]
                });
                bookToChapterCount[json.sections[x].books[y].shortName]++;
            }
        }
    }

    var svg = d3.select('#contradictions-chart');

    svg.selectAll('rect')
        .data(chapters)
        .enter().append('rect')
        .attr('class', function (d, i) {
            var testament = d.section == 'New Testament' ? 'nt' : '';
            var book = 'b' + d.book.replace(/\s+/g, '').toLowerCase();

            return testament + ' ' + book;
        })
        .attr('x', function (d, i) {
            return i;
        })
        .attr('y', 400)
        .attr('width', 1)
        .attr('height', function (d, i) {
            return d.chapter.relativeLength * 100;
        })
        .on('click', function (d) {
            var chapterNum = parseInt(d.chapter.name.split(' ')[1]);
            window.location = 'http://www.biblegateway.com/passage/?search=' + d.book + ' ' + chapterNum + '&version=KJV';
        })
        .on('mouseover', function (d) {
            /*contraFilters.book = null;
            contraFilters.chapter = getAbsoluteChapter(d.book + ' ' + d.chapter.name.split(' ')[1]);
            renderContra();*/
            d3.select('#selected')
                .html(d.section + ' - ' + d.book + ' - ' + d.chapter.name + '<br/><span class="subdued">' +
                    d.chapter.wordCount + ' words, ' + d.chapter.charCount + ' characters</span>');
        });


    if (window._contradictions !== undefined) {
        contra = _contradictions;

        renderContra();
    } else {
        d3.json('data/contra.json').then(function (json) {
            contra = json;

            // var sourceSelect = d3.select('#source-select');
            //
            // sourceSelect.selectAll('option')
            //     .data(Object.keys(contra))
            //     .enter().append('option')
            //     .attr('value', function (d) {
            //         return d;
            //     })
            //     .text(function (d) {
            //         return d;
            //     });
            //
            // sourceSelect.on('change', function () {
            //     updateHash({source: this.value});
            // });

            // Initial call to setup the filters from the URL
            // setFiltersFromHash();

            renderContra();
        });
    }
});