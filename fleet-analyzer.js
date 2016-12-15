//hardcoded parameters
var svg_width   = 1000;
var svg_height  = 3000;
var graph_width  = 800;
var graph_height = 500;
var num_plots = 5;
// var circle_ratio = 1.0 / Math.sqrt(Math.PI);
// var triang_ratio = 2.0 / Math.sqrt(Math.sqrt(3.0));
// var square_ratio = 1.0;
var phi = (1.0 + Math.sqrt(5.0)) / 2.0;
//derived parameters
var margin_x = svg_width - graph_width;
var margin_y = (svg_height - num_plots*graph_height);
var graph_x = margin_x / 2;
var graph_y = [];
for (var i = 0; i < num_plots; i++) {
    graph_y.push(graph_height*i + margin_y*(2*i+1)/(2*num_plots))
}
var title_y = - (margin_y / (4*num_plots));
title_y = title_y > -16 ? -16 : title_y;
//triangle symbol as svg polygon
// function triangle(size) {
//     return       '0.0,'+(-0.578*size)+' '+
//         (-0.5*size)+','+( 0.289*size)+' '+
//         ( 0.5*size)+','+( 0.289*size);
// }//equilateral triangle: '0,-0.578 -0.5,0.289 0.5,0.289';

/**
 * Relative positions and margins in <svg> (for num_plots=2)
 *+--------------------------------------------------------------+
 *|0,0(svg)->x  ^                          +                     |
 *||            |                          +                     |
 *|v            |graph_y[0]                +vertical margin      |
 *|y            |                          +                     |
 *|             v                          +                     |
 *|<--graph_x-->0,0(graphs[0] incl. points, axes, title)         |
 *|             ^<-----------graph_width----------->             |
 *|             |                                  |<--graph_x-->|
 *|             |                                  |             |
 *|             |                                  |             |
 *|             |                                  |             |
 *|             |                                  |             |
 *|             |graph_height                      |             |
 *|             |                                  |             |
 *|             |                                  |             |
 *|             |                                  |             |
 *|             |                                  |             |
 *|             |                                  |             |
 *|             v__________________________________|             |
 *|              ^                         +                     |
 *|              |                         +                     |
 *|              |                         +                     |
 *|              |                         +                     |
 *|              |                         +                     |
 *|              |margin_y / 2             +vertical margin      |
 *|              |                         +                     |
 *|              |                         +                     |
 *|              |                         +                     |
 *|              v                         +                     |
 *|<--graph_x-->0,0(graphs[1] incl. points, axes, title)
 *|             ^<-----------graph_width----------->             |
 *|             |                                  |<--graph_x-->|
 *|             |                                  |             |
 *|             |                                  |             |
 *|             |                                  |             |
 *|+++++++++++++|                                  |+++++++++++++|
 *| horizontal  |graph_height                      | horizontal  |
 *|   margin    |                                  |   margin    |
 *|             |                                  |             |
 *|             |                                  |             |
 *|             |                                  |             |
 *|             |                                  |             |
 *|             v__________________________________|             |
 *|              ^                         +                     |
 *|              |                         +                     |
 *|              |graph_y[0]               +vertical margin      |
 *|              |                         +                     |
 *|              v                         +                     |
 *+--------------------------------------------------------------+<svg_width           
 *                                                               ^svg_height
 * The length of all horizontal +'s combined is margin_x.
 * The length of all   vertical +'s combined is margin_y.
 **/

var titles = ['艦種別艦隊詳細（未着工）','艦種別練度分布（工事中）','艦種別救出率（未着工）']
var fleet_db = [];
var loaded_db = false;
var type_db = {};
var loaded_types = false;
var plots_loaded = false;

//load data, specifying parse format
d3.json('fleet.json', function(e, d) {
    if (e) { throw e; }
    fleet_db = d;
    loaded_db = true;
});
d3.json('types.json', function(e, d) {
    if (e) { throw e; }
    type_db = d;
    loaded_types = true;
})

//drawable before data is loaded
var svg = d3.select('body').append('svg')
    .attr('width', svg_width)
    .attr('height', svg_height);

//array of selections on each graph
graphs = [];
for (var i = 0; i < num_plots; i++) {
    graphs.push(svg.append('g')
        .attr('transform', 'translate('+graph_x+','+graph_y[i]+')'));
    graphs[i].append('text')
        .classed('graph-title', true)
        .attr('text-anchor', 'middle')
        .attr('x', graph_width/2)
        .attr('y', title_y)
        .text(titles[i]);
}

document.getElementById('fleet-code-submitter').addEventListener('submit', function() {
    fleet_code = document.getElementById('fleet-code-submitter').fleet.value;
    if (valid_code(fleet_code)) {
        if (loaded_db && loaded_types) {
            if (!plots_loaded) {
                setup_plots(fleet_db, type_db);
                plots_loaded = true;
            }
            draw_plots(code_to_array(fleet_code, fleet_db), fleet_db, type_db);
        } else {
            alert("まだ艦隊情報が読み込めてないっぽい。もうちょっと待ってからやり直すといいっぽい！");
        }
    } else {
        alert("変換コードにミスがあるっぽい？確認してほしいっぽい！");
    }
});

function valid_code(fleet_code) {
    for (var i = fleet_code.length - 1; i >= 0; i--) {
        var c = fleet_code.charAt(i);
        var correct = false;
        if (c == '|' || c == ':' || c == '.' || c == ',') {
            continue;
        }
        for (var j = '9'; j >= '0'; j--) {
            if (c == j) {
                correct = true;
                break;
            }
        }
        if (correct) {
            continue;
        } else {
            return false;
        }
    }
    return true;
}

/*
 * Level 1: split by | each element is an object for 1 kanmusu lineage
 * Level 2: split by : kanmusu_list_id, entries, db_entry (corresponding fleet_db object)
 * Level 3 (entries): split by , each element is an object for 1 kanmusu
 * Level 4: split by . rank is filled in from fleet_db if nonexistent
 */
function code_to_array(fleet_code, fleet_db) {
    bad_entry_list = [];
    split_code = fleet_code.split("|").filter(function(d) {
        return d.includes(":");
    });
    split_code.forEach(function(d, i, a) {
        d = d.split(":");
        d[0] = +d[0];
        var db_entry = fleet_db.filter(function(e) {
            return e.kanmusu_list_ids.some(function(f) {
                return f == d[0];
            })
        });
        if (db_entry.length > 1 || db_entry.length == 0) {
            console.log("Bad entry at "+i+": "+d);
            bad_entry_list.push(i);
            return;
        }
        db_entry = db_entry[0];
        var db_index = fleet_db.indexOf(db_entry);

        d[1] =  d[1].split(",");
        d[1].forEach(function(e, j, b) {
            e = e.split(".");
            e.forEach(function(f, k, c) { c[k] = +f; });

            if (e.length == 1) {
                var rank = 1;
                for (var i = db_entry.level_borders.length - 1; i >= 0; i--) {
                    if (e[0] >= db_entry.level_borders[i]) {
                        rank = i+1;
                        break;
                    }
                }
                e.push(rank);
            }
            if (e[1] > db_entry.max_rank) {
                console.log("Fixing bad rank: "+b[j]);
                e[1] = db_entry.max_rank;
            }
            b[j] = { 'level':e[0], 'rank':e[1], 'type':db_entry.types[e[1]-1] };
        });
        a[i] = { 'kanmusu_list_id':d[0], 'entries':d[1], 'db_index':db_index };
    });
    for (var i = bad_entry_list.length - 1; i >= 0; i--) {
        split_code.splice(bad_entry_list[i], 1);
    }
    return split_code;
}

function setup_plots(fleet_db, type_db) {
    // graph 0: table
    
    // graph 1: box plot
    // axes
    var scale_x = d3.scaleLinear().domain([0, 155]).range([0,graph_width]).clamp(true);
    var scale_y = d3.scalePoint().domain(type_db.Japanese).range([graph_height,0]).padding(0.5).align(0);
    var axis_x = d3.axisBottom(scale_x).tickValues([0, 87, 99, 140, 155])
    var axis_y = d3.axisLeft(scale_y);
    graphs[1].append('g')
        .classed('x axes', true)
        .attr('transform', 'translate(0,'+graph_height+')')
        .call(axis_x)
        .selectAll('.tick')
        .append('line')
        .classed('grid', true)
        .attr('x1',0.5)
        .attr('x2',0.5)
        .attr('y2',-(graph_height))
        .filter(function(d) { return d > 99; })// ケッコン
        .style('stroke','pink')
        .style('stroke-opacity', 0.7);
    graphs[1].append('g')
        .classed('y axes', true)
        .call(axis_y)
        .selectAll('.tick')
        .append('line')
        .classed('grid', true)
        .attr('y1',0.5)
        .attr('x2',scale_x(99)+0.5)
        .attr('y2',0.5);
    graphs[1].select('.y.axes').selectAll('.tick')
        .append('line')
        .classed('grid', true)
        .attr('x1',scale_x(100)+0.5)
        .attr('y1',0.5)
        .attr('x2',graph_width)
        .attr('y2',0.5)
        .style('stroke','pink')
        .style('stroke-opacity', 0.7);
    // labels
    graphs[1].select('.x.axes')
        .append('text')
        .classed('label', true)
        .text('練度')
        .attr('transform', 'translate('+(graph_width/phi)+','+(graph_height*-0.01)+')');
    graphs[1].select('.y.axes')
        .append('text')
        .classed('label', true)
        .text('艦種')
        .attr('transform', 'translate('+(graph_width*0.04)+','+(graph_height/(phi+1.0))+')');
    // points
    var points = graphs[1].append('g').classed('plot', true);

}

function draw_plots(fleet_array, fleet_db, type_db) {
    var flattened_array = [];
    for (var lineage = 0; lineage < fleet_array.length; lineage++) {
        for (var individual = 0; individual < fleet_array[lineage].entries.length; individual++) {
            flattened_array.push({
                'kanmusu_list_id':fleet_array[lineage].kanmusu_list_id,
                'level':          fleet_array[lineage].entries[individual].level,
                'rank':           fleet_array[lineage].entries[individual].rank,
                'type':           fleet_array[lineage].entries[individual].type,
                'db_index':       fleet_array[lineage].db_index
            });
        }
    }

    // graph 0: table

    // graph 1: box plot
    var scale_x = d3.scaleLinear().domain([0, 155]).range([0,graph_width]).clamp(true);
    var scale_y = d3.scalePoint().domain(type_db.Japanese).range([graph_height,0]).padding(0.5).align(0);
    var points = graphs[1].select('.plot').selectAll('circle').data(flattened_array);
    points.exit().remove();
    points = points.enter()
        .append('circle')
        .classed('points', true)
        .merge(points)
        .attr('transform', function(d) {
            return 'translate('+scale_x(d.level)+','+scale_y(type_db.Japanese[d.type])+')';
        });
    points.filter(function(d) { return d.level <= 99; })
        .style('stroke', 'black')
        .style('fill', 'black');
    points.filter(function(d) { return d.level > 99; })
        .style('stroke', 'pink')
        .style('fill', 'pink');

    // graph 2: bar graph
    scale_x = d3.scaleLinear().range([0,graph_width]).clamp(true);
}
