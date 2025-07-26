taxon_data = FileAttachment("chordatacsv.csv").csv();

viewof common_or_scientific = Inputs.radio(["Common Name Specified Root Taxon", "Scientific Name Specified Root Taxon"], {value: "Common Name Specified Root Taxon"});

common_chosen = common_or_scientific === "Common Name Specified Root Taxon";

viewof common_name_or_top_rank = {
  if (common_chosen) {
    return Inputs.search(taxon_data);
  } else {
    return Inputs.select(included_ranks);
  }
}

viewof top_taxon = {
  if (common_chosen) {
    return Inputs.select(common_name_or_top_rank.filter(taxon => taxon.common_name !== ""), {format: taxon => taxon.common_name});
  } else {
    return Inputs.select(taxon_data.filter(taxon => taxon.rank === common_name_or_top_rank).map(taxon => taxon.name).sort());
  }
}

top_taxon_name = {
  if (common_chosen) {
    return top_taxon ? top_taxon.name : "Chordata";
  } else {
    return top_taxon;
  }
}

included_ranks = ["phylum", "subphylum", "infraphylum", "parvphylum", "megaclass", "class", "subclass", "infraclass", "order", "suborder", "infraorder", "superfamily", "family", "subfamily", "tribe", "subtribe", "genus", "subgenus", "species"];

taxon_hierarchy = d3.stratify()
    .id((d) => d.id)
    .parentId((d) => d.parent)
  (taxon_data);

map = {
  const map = new Map();
  taxon_hierarchy.each(node => map.set(node.data.name, node));
  return map;
}

top_node = map.get(top_taxon_name);

included_ranks_indexed = [
  { index: 0, label: 'phylum' },
  { index: 1, label: 'subphylum' },
  { index: 2, label: 'infraphylum' },
  { index: 3, label: 'parvphylum' },
  { index: 4, label: 'megaclass' },
  { index: 5, label: 'class' },
  { index: 6, label: 'subclass' },
  { index: 7, label: 'infraclass' },
  { index: 8, label: 'order' },
  { index: 9, label: 'suborder' },
  { index: 10, label: 'infraorder' },
  { index: 11, label: 'superfamily' },
  { index: 12, label: 'family' },
  { index: 13, label: 'subfamily' },
  { index: 14, label: 'tribe' },
  { index: 15, label: 'subtribe' },
  { index: 16, label: 'genus' },
  { index: 17, label: 'subgenus' },
  { index: 18, label: 'species' }
];

// mapping between node taxonomical rank and color
// rank = ordinal value, class is the highest, species is the lowest
color_scale = d3.scaleOrdinal()
    .range(["#f59051", "#ffa44a", "#ffc547", "#f5db76", "#f2ef9b", "#e0f0dd", "#d1e7cb", "#a3d4a1", "#86c483", "#4eb86c", "#7ad5bb", "#4eb0c6", "#0868ac", "#084081", "#ccdcec", "#abbfd1", "#90acc8", "#a1a9d2", "#8856a7"])
    .domain(["phylum", "subphylum", "infraphylum", "parvphylum", "megaclass", "class", "infraclass", "subclass", "order", "infraorder", "suborder", "superfamily", "family", "subfamily", "tribe", "subtribe", "genus", "subgenus", "species"]);

function colorLegend(container) {
  const titlePadding = 14;  // padding between title and entries
  const entrySpacing = 16;  // spacing between legend entries
  const entryRadius = 5;    // radius of legend entry marks
  const labelOffset = 4;    // additional horizontal offset of text labels
  const baselineOffset = 4; // text baseline offset, depends on radius and font size

  const title = container.append('text')
    .attr('x', 0)
    .attr('y', 0)
    .attr('fill', 'black')
    .attr('font-family', 'Helvetica Neue, Arial')
    .attr('font-weight', 'bold')
    .attr('font-size', '13px')
    .text('Rank');

  const entries = container.selectAll('g')
    .data(included_ranks_indexed)
    .join('g')
    .attr('transform', d => `translate(0, ${titlePadding + d.index * entrySpacing})`);

  const symbols = entries.append('circle')
    .attr('cx', entryRadius) // <-- offset symbol x-position by radius
    .attr('r', entryRadius)
    .attr('fill', d => color_scale(d.label));

  const labels = entries.append('text')
    .attr('x', 2 * entryRadius + labelOffset) // <-- place labels to the left of symbols
    .attr('y', baselineOffset) // <-- adjust label y-position for proper alignment
    .attr('fill', 'black')
    .attr('font-family', 'Helvetica Neue, Arial')
    .attr('font-size', '13px')
    .style('user-select', 'none') // <-- disallow selectable text
    .text(d => d.label);
}

path_taken = {
  const path_taken = [];
  top_node.ancestors().reverse().forEach(node => {path_taken.push(node.data.name)});
  return path_taken;
}

function make_path_string(path) {
  let base = "";
  path.forEach(node => {base += node + " ->"});
  return base.substring(0, base.length - 3);
}

function max_displayable_rank(root) {
  var rank_index = included_ranks.indexOf(root.data.rank);
  var num_displayed = 0;
  while(rank_index < included_ranks_indexed.length) {
    num_displayed += root.descendants().filter(d => included_ranks.indexOf(d.data.rank) === rank_index).length;
    if(num_displayed > 1400) {
      break;
    }
    rank_index++;
  }
  return (rank_index > included_ranks.indexOf(root.data.rank) + 1 ? rank_index : rank_index + 1);
}

chart = {
  const width = 2900;
  const height = 900;
  const cx = width * 0.5; 
  const cy = height * 0.5; 
  let radius = Math.min(width - 550, height - 375) / 2;

  let show_label = true; // show labels for nodes
  let show_button = true; // show button to "back up"

  let path_to_chordata = [] // current path from chordata -> ... -> root node
  top_node.ancestors().reverse().forEach(node => {path_to_chordata.push(" " + node.data.name)}); // populate the path

  
  // make radial cluster layout
  // reference: d3 docs, https://d3js.org/d3-hierarchy/cluster
  // x = angle
  // y = radius 
  const tree = d3.cluster()
      .size([2 * Math.PI, radius])
      .separation((a, b) => (a.parent == b.parent ? 1 : 2) / a.depth);

  // function that renders the cluster with the given "center" node
  function render(root_node) {
    // update the chart's root
    mutable chart_root = root_node;
    
    // Apply the cluster layout with the given root node
    let root = tree(d3.hierarchy(root_node)
      .sort((a, b) => d3.ascending(a.data.data.height, b.data.data.height)));

    // if we are at the highest rank, do not show the button to go up a rank
    show_button = !(root_node.data.rank === "phylum");
    
    // these are the lowest ranks we want to hide when examining root nodes with high ranks to prevent rendering lag
    var lower_ranks = included_ranks.slice(max_displayable_rank(root_node));
    const hidden_ranks = new Set(lower_ranks);
  
    // clean up previous labels, tooltips, and button elements
    svg.selectAll(".labels").remove();
    svg.selectAll(".title").remove();
    svg.selectAll(".button").remove();
    d3.selectAll(".tooltip").remove();

    // conditionally filter out lower ranked nodes and paths when we need to filter
    const filtered_nodes = root.descendants().filter(d => (!lower_ranks.includes(d.data.data.rank)));
  
    const filtered_paths = root.links().filter(d => (!lower_ranks.includes(d.target.data.data.rank)));

    // labels depend on how many values there are in the tree to prevent clutter
    let show_above_species_label = (filtered_nodes.length > 300) ? false : true;
    show_label = (filtered_nodes.length > 400) ? false : true;

    // ranks = the set of ranks currently in the tree
    let ranks = new Set();
    filtered_nodes.sort((a, b) => (included_ranks.indexOf(a.data.data.rank) - included_ranks.indexOf(b.data.data.rank)));
    filtered_nodes.forEach(node => {ranks.add(node.data.data.rank)});
    // get a sorted list of these ranks
    const indexed_ranks = Array.from(ranks);

    // for each value in the tree, set its radius to an even increment from the root * the rank
    root.each(d => {
      d.y = (d.data.data.name === root.data.data.namefilter) ? 0 : 
        (ranks.size === 1 ? 0 : (radius / (ranks.size - 1)) * (indexed_ranks.indexOf(d.data.data.rank)));
    });

    // paths between nodes
    let paths = svg.selectAll(".path")
      .data(filtered_paths, d => d.target.data.data.name);

    // d3 intro example
    // we need different transitions for enter and update, so no modularity here
    paths = paths.join(
      enter =>
        enter.append("path")
          .attr("class", "path")
          .attr('stroke', d => color_scale(d.target.data.data.rank))
          .attr("stroke-width", 0.63)
          .attr("fill", "none")
          .attr("d", d => {
            const prev_pos = { x: 0, y: 0 };
            return d3.linkRadial()
              .angle(() => prev_pos.x)
              .radius(() => prev_pos.y);
          })
          .attr('opacity', 0) // have new paths fade in
          .transition()
          .delay(250)
          .duration(650)
          .attr('opacity', 1)
          .attr("d", d3.linkRadial()
            .angle(d => d.x)
            .radius(d => d.y)),
      update => update
        .attr('opacity', 0.5) // have updated paths fade a bit
        .transition()
        .duration(900)
        .attr('opacity', 1)
        .attr("d", d3.linkRadial()
          .angle(d => d.x)
          .radius(d => d.y)),
      exit => exit.transition()
        .duration(300)
        .attr('opacity', 0)
        .remove()
    );
  
    // select nodes
    let selected_nodes = svg.selectAll(".nodes")
      .data(filtered_nodes, d => d.data.data.name)
      .join(
        enter => enter
          .append("circle")
          .attr("class", "nodes")
          .attr("fill", d => color_scale(d.data.data.rank))
          .attr("r", d => (root_node.data.name === d.data.data.name ? 6 : 3)) // root should be the biggest node
          .attr("transform", d => {
            const prev_pos = { x: root.x, y: root.y };
            return `rotate(${prev_pos.x * 180 / Math.PI - 90}) translate(${prev_pos.y},0)`;  // new nodes come from center
          }),
        update => update,
        exit => exit.transition()
          .duration(1300)
          .attr('opacity', 0)
          .remove()
      );
  
    selected_nodes.transition() // update radius if root status changes and move
      .attr("r", d => (root_node.data.name === d.data.data.name ? 6 : 3))
      .duration(900)
      .attr("transform", d => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`);


    // tooltip using html element for multiline and box appearance
    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("background", "#d8e2e6")
      .style("color", "#3b4245")
      .style("border-radius", "3px")
      .style("pointer-events", "none")
      .style("font-size", "12px")
      .style("font-family", "Helvetica")
      .style("padding", "8px")
      .style("display", "none"); // set this to not be visible at first

    // event listeners for nodes
    selected_nodes
      .on('mouseover', function(event, d) {
        // darken node on hover
        d3.select(this)
          .style('filter', 'brightness(50%)')
          .attr("r", d => (root_node.data.name === d.data.data.name ? 7 : 4));
        // value for displayed common name:
        // if it has a name, show that
        // else, if its parent has a name, show that
        // if not, display unknown
        const displayed_common_name = d.data.data.common_name === "" ? 
          (d.data.parent.data.common_name === "" ? "unknown" : "sub-rank of " + d.data.parent.data.common_name) :
          d.data.data.common_name;
        if (d.data.data.rank === "species") {
          tooltip.style("display", "block")
            // double lines: first for common name, second for taxonomic rank
            .html(`<p> <strong>${d.data.data.name}</strong> <br> <b>Common Name:</b> ${displayed_common_name} <br> <b> Taxonomic Rank:</b> ${d.data.data.rank} <br> <b>Location:</b> ${d.data.data.area}<p>`)
            .style("left", (event.pageX + 5) + "px") // have to use pageX and pageY for html elements
            .style("top", (event.pageY + 5) + "px");
        } else {
          tooltip.style("display", "block")
            // double lines: first for common name, second for taxonomic rank
            .html(`<p> <strong>${d.data.data.name}</strong> <br> <b>Common Name:</b> ${displayed_common_name} <br> <b> Taxonomic Rank:</b> ${d.data.data.rank}<p>`)
            .style("left", (event.pageX + 5) + "px") // have to use pageX and pageY for html elements
            .style("top", (event.pageY + 5) + "px");
        }
      })
      .on('click', function(event, d) {
        if (root_node.data.name !== d.data.data.name) { // if we're not just re-clicking the root
          // update the path to display
          path_to_chordata = [];
          svg.selectAll(".title_path").remove();
          d.data.ancestors().reverse().forEach(node => {path_to_chordata.push(" " + node.data.name)});
          // when a node is clicked, re-render the graph with the clicked node as our root
          render(d.data); 
        }
      })
      .on('mouseout', function(event, d) {
        // restore brightness, size, and remove tooltip
        d3.select(this)
          .style('filter', 'brightness(100%)')
          .attr("r", d => (root_node.data.name === d.data.data.name ? 6 : 3));
        tooltip.style("display", "none");
      });

  // labels displayed for each node
  const labels = svg.append("g")
    .selectAll()
    .data(filtered_nodes) // no key function since we are re-writing all labels for every render
    .join("text")
      .attr('class', 'labels')
      // referenced d3 docs
      .attr("transform", d => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0) rotate(${d.x >= Math.PI ? 180 : 0})`) 
      .attr("dy", "0.31em")
      .attr("x", d => d.x < Math.PI === (!d.children || d.children.every(child => hidden_ranks.has(child.data.data.rank))) ? 9 : -9) 
      .attr("text-anchor", d => d.x < Math.PI === (!d.children || d.children.every(child => hidden_ranks.has(child.data.data.rank))) ? "start" : "end")
      //.attr("text-anchor", d => d.x < Math.PI === (!d.children) ? "start" : "end")
      .attr("paint-order", "stroke")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", '5')
      .attr("fill", "#1c1b1b")
      .attr("visibility", d => { // because the number of labels varies greatly on height, have different visibility settings
        if (d.data.height <= 2) {
          return show_label ? "visible" : "hidden"
        } else {
          return show_above_species_label ? "visible" : "hidden"
        }
      })
      .text(d => (d.data.data.name)) // set to scientific name
      .attr('opacity', 0) // transition and fade as for each update
      .transition()
      .delay(600)
      .duration(1000)
      .attr('opacity', 1);


    // drill up button
    const button = svg.append('g')
      .attr("class", "button")

    const button_rect = button // rectangle for button
      .append('rect')
        .attr('x', -100)
        .attr('y', cy - 70)
        .attr('width', 200)
        .attr('height', 25)
        .attr('fill', '#b7c1c4')
        .attr('rx', 3)
        .attr("visibility", show_button ? "visible" : "hidden")

    const button_text = button.append('text') // text for button
      .attr('x', 0) 
      .attr('y', cy - 55) 
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#3b4245') // text color
      .style('font-family', 'Helvetica, sans-serif')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      //.attr("visibility", show_button ? "visible" : "hidden")
      .text(show_button ? "Go Up One Rank": "You are viewing the taxonomy of the Chordata phylum. Click any node in the tree to view a more specific taxonomy."); // change text based on if we can even drill up

    // button event listeners
    button
      .on('mouseover', function(d) {
        // darken text and rect to simulate shadow
        button_rect.attr('fill', '#96a6ab');
        button_text.attr('fill', '#262b2e'); // text color
      })
      .on('click', function(event, d) {
        // darken button
        button_rect
          .attr('fill', '#7f9399') 
          .transition()
          .duration(500)
          .attr('fill', '#96a6ab')
        // when a node is clicked, re-render the graph with the parent of the root node
        path_to_chordata.pop();
        svg.selectAll(".title_path").remove();
        render(root.data.parent);
      })
      .on('mouseout', function(event, d) {
        // remove shadow
        button_rect.attr('fill', '#b7c1c4');
        button_text.attr('fill', '#3b4245');
      });

    // title displaying root
    const title = svg.append('g')
      .attr("class", "title")
      .append('text') // text for button
        .attr('x', 0) 
        .attr('y', -cy + 30) 
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#3b4245') // text color
        .style('font-family', 'Helvetica, sans-serif')
        .style('font-size', '39px')
        .style('font-weight', 'bold')
        .text(root.data.data.name + " " + root.data.data.rank); 

    // title displaying common name
    const root_common_name = svg.append('g')
      .attr("class", "title")
      .append('text') // text for button
        .attr('x', 0) 
        .attr('y', -cy + 65) 
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#3b4245') // text color
        .style('font-family', 'Helvetica, sans-serif')
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .text("Common Name: " + (root.data.data.common_name === "" ? 
          (root.data.parent.data.common_name === "" ? "Unknown" : "sub-rank of " + root.data.parent.data.common_name) :
          root.data.data.common_name));

    // title displaying path
    const title_path = svg.append('g')
      .attr("class", "title_path")
      .append('text') // text for button
        .attr('x', 0) 
        .attr('y', -cy + 90) 
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#3b4245') // text color
        .style('font-family', 'Helvetica, sans-serif')
        .style('font-size', '18px')
        .text("Taxonomic path: " + make_path_string(path_to_chordata)); 
  }

  // create svg container
  const svg = d3.create("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [-cx + width / 4, -cy, width, height])
      .attr("style", "width: 150%; height: 150%; font: 8px sans-serif;");

  // create color legend
  const legend = svg.append('g')
    .attr('transform', 'translate(-450, -300)')
    .call(colorLegend);

  // render initial node
  render(top_node);
  return svg.node();
}

mutable chart_root = top_node;

// The following code is responsible for creating the descendant species chart.
species_proportion_chart = {
  const width = 1000;
  const height = width;
  const cx = width / 2; 
  const cy = height / 2;
  
  // Create the species chart color scale.
  const species_chart_color = d3.scaleOrdinal()
      .domain(child_distribution.map(d => d.name))
      .range(d3.quantize(t => d3.interpolateSpectral(t * 0.8 + 0.1), child_distribution.length + 1).reverse())
  
  // Create the pie layout and arc generator.
  const pie = d3.pie()
      .sort(null)
      .value(d => d.num_children);
  
  const arc = d3.arc()
      .innerRadius(0)
      .outerRadius(Math.min(width, height) / 3 - 1);

  const largeArcLabelRadius = arc.outerRadius()() * 0.8;
  
  const smallArcLabelRadius = arc.outerRadius()() * 1.1;

  const tinyArcLabelRadius = arc.outerRadius()() * 1.2
  
  // A separate arc generator for labels for large arcs.
  const largeArcLabel = d3.arc()
      .innerRadius(largeArcLabelRadius)
      .outerRadius(largeArcLabelRadius);

  // A separate arc generator for labels for small arcs.
  const smallArcLabel = d3.arc()
      .innerRadius(smallArcLabelRadius)
      .outerRadius(smallArcLabelRadius);

  // A separate arc generator for labels for tiny arcs.
  const tinyArcLabel = d3.arc()
      .innerRadius(tinyArcLabelRadius)
      .outerRadius(tinyArcLabelRadius);
  
  const arcs = pie(child_distribution);

  // tooltip using html element for multiline and box appearance
    const tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("background", "#d8e2e6")
      .style("color", "#3b4245")
      .style("border-radius", "3px")
      .style("pointer-events", "none")
      .style("font-size", "14px")
      .style("font-family", "Helvetica")
      .style("padding", "8px")
      .style("display", "none"); // set this to not be visible at first
  
  // Create the SVG container.
  const species_chart_svg = d3.create("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [-cx, -cy, width, height])
      .attr("style", "width: 50%; height: 50%; font: 10px sans-serif;");
  
  // Add a sector path for each value.
  species_chart_svg.append("g")
      .attr("stroke", "white")
    .selectAll()
    .data(arcs)
    .join("path")
      .attr("fill", d => species_chart_color(d.data.name))
      .attr("d", arc)
    .on('mouseover', function(event, d) {
      tooltip.style("display", "block")
          // double lines: first for common name, second for taxonomic rank
          .html(`<b>${d.data.name}:</b> ${d.data.num_children} species`)
          .style("left", (event.pageX + 5) + "px") // have to use pageX and pageY for html elements
          .style("top", (event.pageY + 5) + "px");
    })
    .on('mousemove', function (event) {
        tooltip.style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY + 10) + "px");
    })
    .on('mouseout', function(event, d) {
      tooltip.style("display", "none")
    });
  
  // Create a new arc generator to place a label inside the edge for large arcs.
  species_chart_svg.append("g")
      .attr("text-anchor", "middle")
    .selectAll()
    .data(arcs)
    .join("text")
      .attr("transform", d => `translate(${largeArcLabel.centroid(d)})`)
      .call(text => text.filter(d => (d.endAngle - d.startAngle) > 0.25).append("tspan")
          .attr("y", "-0.4em")
          .attr("font-weight", "bold")
          .text(d => d.data.name))
      .call(text => text.filter(d => (d.endAngle - d.startAngle) > 0.25).append("tspan")
          .attr("x", 0)
          .attr("y", "0.7em")
          .attr("fill-opacity", 0.7)
          .text(d => d.data.num_children));

  // Create a new arc generator to place a label outside the edge for small arcs.
  species_chart_svg.append("g")
      .attr("text-anchor", "middle")
    .selectAll()
    .data(arcs)
    .join("text")
      .attr("transform", d => `translate(${smallArcLabel.centroid(d)})`)
      .call(text => text.filter(d => ((d.endAngle - d.startAngle) <= 0.25 && (d.endAngle - d.startAngle) > 0.1)).append("tspan")
          .attr("y", "-0.4em")
          .attr("font-weight", "bold")
          .text(d => d.data.name))
      .call(text => text.filter(d => ((d.endAngle - d.startAngle) <= 0.25 && (d.endAngle - d.startAngle) > 0.1)).append("tspan")
          .attr("x", 0)
          .attr("y", "0.7em")
          .attr("fill-opacity", 0.7)
          .text(d => d.data.num_children));

  // Create a new arc generator to place a label outside the edge for tiny arcs.
  /*species_chart_svg.append("g")
      .attr("text-anchor", "middle")
    .selectAll()
    .data(arcs)
    .join("text")
      .attr("transform", d => `translate(${tinyArcLabel.centroid(d)})`)
      .call(text => text.filter(d => ((d.endAngle - d.startAngle) <= 0.1 && (d.endAngle - d.startAngle) > 0.03)).append("tspan")
          .attr("y", "-0.4em")
          .attr("font-weight", "bold")
          .text(d => d.data.name))
      .call(text => text.filter(d => ((d.endAngle - d.startAngle) <= 0.1 && (d.endAngle - d.startAngle) > 0.03)).append("tspan")
          .attr("x", 0)
          .attr("y", "0.7em")
          .attr("fill-opacity", 0.7)
          .text(d => d.data.num_children));*/

  // Add a name to the chart.
  const chart_name = species_chart_svg.append('g')
      .attr("class", "title")
      .append('text') // text for button
        .attr('x', 0) 
        .attr('y', -cy + 20) 
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#3b4245') // text color
        .style('font-family', 'Helvetica, sans-serif')
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .text("Number of Species Descending From " + chart_root.data.name + "'s Children"); 
  
  return species_chart_svg.node();
}

// Helper function for the species distribution chart. Counts the number of child species descending from a taxon. Returns 1 if the taxon is a species itself.
function count_child_species(taxon){
  var num_species = 0;
  if(!taxon.children) {
    return 0;
  }
  if(taxon.data.rank !== "species"){
      for(var child = 0; child < taxon.children.length; child++){
          if (taxon.children[child].data.rank !== "species"){
              num_species += count_child_species(taxon.children[child]);
          }
          else{
              num_species++;
          }
      }
  } else {
    return 1;
  }
  return num_species;
}

// Helper function for the species distribution chart. Takes a taxon name and a number of children and returns a JSON object including both fields.
function createChildDataJSON(name, num_children){
  const object = {};
  object["name"] = name;
  object["num_children"] = num_children
  return object;
}

// An array of JSON objects to be used by the species distribution chart. Each object represents a direct child of the current top node and contains the number of descendant species from each of those children.
child_distribution = {
  if (chart_root.data.rank === "species") {
    return [createChildDataJSON("Taxon Has No Children", 0)];
  } else {
    return chart_root.children.map(taxon => createChildDataJSON(taxon.data.name, count_child_species(taxon)));
  }
}