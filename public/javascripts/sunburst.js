const width = 975;
const radius = width / 2;
const svg0 = d3.select('#sunburst');
const g = svg0.append('g');

d3.json("data/flare.json").then(function(data){
    let partition = data => d3.partition()
        .size([2 * Math.PI, radius])
        (d3.hierarchy(data)
            .sum(d => d.value)
            .sort((a, b) => b.value - a.value));

    function autoBox() {
        const {x, y, width, height} = this.getBBox();
        return [x, y, width, height];
    }

    const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, data.children.length + 1));
    const format = d3.format(",d");

    const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
        .padRadius(radius / 2)
        .innerRadius(d => d.y0)
        .outerRadius(d => d.y1 - 1);

    const root = partition(data);

    let svg = d3.create("svg")
        .style("max-width", "100%")
        .style("height", "1200")
        .style("font", "10px sans-serif")
        .style("margin", "5px");

    // let svg = d3.selectAll("#sunburst");
    g.append(() => svg.node());

    svg.append("g")
        .attr("fill-opacity", 0.6)
        .selectAll("path")
        .data(root.descendants().filter(d => d.depth))
        .enter().append("path")
        .attr("fill", d => { while (d.depth > 1) d = d.parent; return color(d.data.name); })
        .attr("d", arc)
        .append("title")
        .text(d => `${d.ancestors().map(d => d.data.name).reverse().join("/")}\n${format(d.value)}`);

    svg.append("g")
        .attr("pointer-events", "none")
        .attr("text-anchor", "middle")
        .selectAll("text")
        .data(root.descendants().filter(d => d.depth && (d.y0 + d.y1) / 2 * (d.x1 - d.x0) > 10))
        .enter().append("text")
        .attr("transform", function(d) {
            const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
            const y = (d.y0 + d.y1) / 2;
            return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
        })
        .attr("dy", "0.35em")
        .text(d => d.data.name);

    function flatten(root) {
        let nodes = [],
            i = 0;

        function recurse(node) {
            if (node.children) node.children.forEach(recurse);
            if (!node.id) node.id = ++i;
            nodes.push(node);
        }

        recurse(root);
        return nodes;
    }

    let gg = d3.selectAll("g");
    const box = gg.node().getBBox();
    const t = 1200 / box.width;
    const x0 = -1 * box.x * t;
    const y0 = -1 * box.y * t;

    let tooltip = d3.select("body")
        .append("div")
        .style("position", "fixed")
        .style("z-index", "10")
        .style("left", x0 + "px")
        .style("top", y0 + "px")
        // .style("visibility", "hidden")
        // .style("background", "#000")
        .text("");

    svg.selectAll("path").on('mouseover',function(d){
        let nodes = flatten(data);
        let n = nodes.find(function(d1){ return (d1.name === d.data.name)});
        console.log(n.name);
        tooltip.text(n.name);
    });

    svg.attr("viewBox", autoBox);
    // svg.attr("viewBox", [0,0,300,300]);
    // svg.node();
});