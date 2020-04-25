// used to color node by depth
// var color = d3.scaleOrdinal();
var color;
// accessor functions for x and y
var x = function(d) {
  return d.x;
};
var y = function(d) {
  return d.y;
};

// normal line generator
var line = d3.line()
  .curve(d3.curveLinear)
  .x(x)
  .y(y);

// configure size, margin, and circle radius
var config = {
  w: 960,
  h: 500,
  r: 5,
  pad: 10
};

// maximum diameter of circle is minimum dimension
config.d = Math.min(config.w, config.h);

// const end = d3.timeDay.floor(d3.timeDay.offset(new Date(), -1));
// const start = d3.timeDay.floor(d3.timeDay.offset(end, -7));
const end = d3.timeDay(new Date(2020, 1, 29));
const start = d3.timeDay(new Date(2020, 1, 1));
const format = d3.timeFormat("%Y-%m-%dT%H:%M:%S");
console.log(format(start), format(end));

//var file = "https://gist.githubusercontent.com/mbostock/4339184/raw/aa24e1009864fc911a76935a740c9481a91cfc16/flare.csv";
var file = "https://data.sfgov.org/resource/nuek-vuh3.csv";
file += "?$limit=3000&$where=supervisor_district='10'"; //$limit=1&
file += " AND received_dttm between '" + format(start) + "'";
file += " and '" + format(end) + "'";
file += " AND battalion not like 'B99'";
file += " AND call_type_group not like ''";
file += " AND city like 'San Francisco' AND station_area not like ''";

console.log(file);

d3.csv(file).then(groupData).then(callback);

function formatData(data) {
  var result = [];
  var elements = [];

  //console.log(data);

  let incidentcountperSD = 0;
  let incidentcountperSA = 0;
  let incidentcountperB = 0;
  Object.keys(data).forEach(function(supervisor_district, index) {
    elements.push(supervisor_district);

    incidentcountperSD = 0;
    Object.keys(data[supervisor_district]).sort(function(a, b) {
      return d3.ascending(a, b);
    }).forEach(function(battalion, index) {
      elements.push(battalion);
      incidentcountperB = 0;
      Object.keys(data[supervisor_district][battalion]).forEach(function(station_area, index) {
        elements.push(station_area);
        incidentcountperSA = 0;
        Object.keys(data[supervisor_district][battalion][station_area]).forEach(function(call_type_group, index) {
          elements.push(call_type_group);
          incidentcountperSA += parseInt(data[supervisor_district][battalion][station_area][call_type_group]);
          result.push({
            'id': elements.join('.'),
            'value': parseInt(data[supervisor_district][battalion][station_area][call_type_group]),
            'isleaf': true
          })

          elements.pop();
        });

        incidentcountperB += incidentcountperSA;
        incidentcountperSD += incidentcountperB;
        result.push({
          'id': elements.join('.'),
          'value': incidentcountperSA,
          'isleaf': false
        })

        elements.pop();
      });
      incidentcountperSD += incidentcountperB;
      result.push({
        'id': elements.join('.'),
        'value': incidentcountperB,
        'isleaf': false
      })

      elements.pop();
    });

    result.push({
      'id': elements.join('.'),
      'value': incidentcountperSD,
      'isleaf': false
    })

    elements.pop();
  });

  result.forEach((item, i) => {
    convertRow(item);
  });

  return result;
}

function groupData(data) {
  //console.log(data);
  let dataGroup = d3.nest()
    .key(function(d) {
      return "SupervisorDistrict_" + d.supervisor_district;
    })
    .key(function(d) {
      return d.battalion;
    })
    .key(function(d) {
      return "StationArea_" + d.station_area;
    })
    .key(function(d) {
      return d.call_type_group;
    })
    .rollup(function(v) {
      return v.length;
    })
    .object(data);

  console.log(dataGroup);

  return formatData(dataGroup);
}

function convertRow(row) {
  var parts = row.id.split(".");
  row.name = parts[parts.length - 1];
  row.value = +row.value;
  return row;
}

function callback(data) {

  console.log("data:", data.length, data);

  // used to create hierarchies
  // https://github.com/d3/d3-hierarchy#stratify
  var stratify = d3.stratify()
    .id(function(d) {
      return d.id;
    })
    .parentId(function(d) {
      // should match existing id (except for root)
      return d.id.substring(0, d.id.lastIndexOf("."));
    });

  // convert csv into hierarchy
  var root = stratify(data);

  // sort by height then value
  // https://github.com/d3/d3-hierarchy#node_sort
  root.sort(function(a, b) {
    if (a.height != b.height) {
      return d3.ascending(a.height, b.height);
    } else {
      return d3.ascending(a.value, b.value);
    }
  });

  console.log("root:", root);

  // setup color scale
  // color.domain(d3.range(root.height + 1));
  // color.range(d3.schemeYlGnBu[root.height + 1]);
  color = d3.scaleSequential([root.height, 0], d3.interpolateViridis);

  drawTraditionalStraight("traditional", root.copy());
  drawCirclePacking("circle_packing", root.copy());

  //add legend
  const legendWidth = 200;
  const legendHeight = 200;
  let legendsvg = d3.select("#d3ImplementationSection").select("#legend-svg");
  // .attr("width", legendWidth)
  // .attr("height", legendHeight);
  legendsvg.append("g").call(
    d3.legendColor()
    .shapeWidth(30)
    .cells(root.height + 1)
    .orient("horizontal")
    .scale(color));
}

function drawNodes(g, nodes, raise) {
  g.selectAll("circle")
    .data(nodes)
    .enter()
    .append("circle")
    .attr("r", function(d) {
      return d.r ? d.r : config.r;
    })
    .attr("cx", x)
    .attr("cy", y)
    .attr("id", function(d) {
      return d.data.name;
    })
    .attr("incidentcount", function(d) {
      return d.data.value;
    })
    .attr("isleaf", function(d) {
      return d.data.isleaf;
    })
    .attr("class", "node")
    .style("fill", function(d) {
      return color(d.depth)
    })
    .on("mouseover.tooltip", function(d) {
      show_tooltip(g, d3.select(this));
      d3.select(this).classed("selected", true);
      if (raise) {
        d3.select(this).raise();
      }
    })
    .on("mouseout.tooltip", function(d) {
      g.select("#tooltip").remove();
      d3.select(this).classed("selected", false);
    });
}

function drawLinks(g, links, generator) {
  var paths = g.selectAll("path")
    .data(links)
    .enter()
    .append("path")
    .attr("d", generator)
    .attr("class", "link");
}

function drawTraditionalStraight(id, root) {
  var svg = d3.select("body").select("#" + id);
  svg.attr("width", config.w);
  svg.attr("height", config.h);

  var g = svg.append("g");
  g.attr("id", "plot");
  g.attr("transform", translate(config.pad, config.pad));

  // setup node layout generator
  var tree = d3.tree()
    .size([config.w - 2 * config.pad,
      config.h - 2 * config.pad
    ]);

  // run layout to calculate x, y attributes
  tree(root);

  // create line generator
  var straightLine = function(d) {
    return line([d.source, d.target]);
  }

  drawLinks(g, root.links(), straightLine);
  drawNodes(g, root.descendants(), true);
}

function drawCirclePacking(id, root) {
  var svg = d3.select("body").select("#" + id);
  svg.attr("width", config.w);
  svg.attr("height", config.h);

  var g = svg.append("g");
  g.attr("id", "plot");

  // translate so circle is in middle of plot area
  var xshift = config.w / 2;
  var yshift = config.h / 2;
  g.attr("transform", translate(xshift, yshift));

  // calculate sum for nested circles
  root.sum(function(d) {
    return d.value;
  });

  // setup circle packing layout
  var diameter = config.d - 2 * config.pad;
  var pack = d3.pack().size([diameter, diameter]).padding(1);

  // run layout to calculate x, y, and r attributes
  pack(root);

  var focus = root,
    nodes = pack(root).descendants(),
    view;

  var circle = g.selectAll("circle")
    .data(nodes)
    .enter().append("circle")
    .attr("class", function(d) {
      return d.parent ? d.children ? "node" : "node node--leaf" : "node node--root";
    })
    .style("fill", function(d) {
      return d.children ? color(d.depth) : null;
    })
    .on("click", function(d) {
      if (focus !== d) zoom(d), d3.event.stopPropagation();
    });

  var text = g.selectAll("text")
    .data(nodes)
    .enter().append("text")
    .attr("class", "label")
    .style("fill-opacity", function(d) {
      return d.parent === root ? 1 : 0;
    })
    .style("display", function(d) {
      return d.parent === root ? "inline" : "none";
    })
    .text(function(d) {
      return d.data.name + (d.data.isleaf === true ? "(" + d.data.value + ")" : "");
    });

  var node = g.selectAll("circle,text");

  svg
    .on("click", function() {
      zoom(root);
    });
  zoomTo([root.x, root.y, root.r * 2 + config.pad]);

  function zoom(d) {
    var focus0 = focus;
    focus = d;

    var transition = d3.transition()
      .duration(d3.event.altKey ? 7500 : 750)
      .tween("zoom", function(d) {
        var i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2 + config.pad]);
        return function(t) {
          zoomTo(i(t));
        };
      });

    transition.selectAll("text")
      .filter(function(d) {
        return d.parent === focus || this.style.display === "inline";
      })
      .style("fill-opacity", function(d) {
        return d.parent === focus ? 1 : 0;
      })
      .on("start", function(d) {
        if (d.parent === focus) this.style.display = "inline";
      })
      .on("end", function(d) {
        if (d.parent !== focus) this.style.display = "none";
      });
  }

  function zoomTo(v) {
    var k = diameter / v[2];
    view = v;
    node.attr("transform", function(d) {
      return "translate(" + (d.x - v[0]) * k + "," + (d.y - v[1]) * k + ")";
    });
    circle.attr("r", function(d) {
      return d.r * k;
    });
  }
}
