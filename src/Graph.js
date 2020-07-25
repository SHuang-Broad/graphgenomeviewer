import React, { useMemo, useEffect } from 'react'
import * as d3 from 'd3'
function reprocessGraph(G, blockSize = 500) {
  const Gp = { nodes: [], links: [] } // G'

  for (let i = 0; i < G.nodes.length; i++) {
    const { id, sequence, ...rest } = G.nodes[i]
    const nodes = []
    let pos = 0
    for (pos = 0; pos < sequence.length - blockSize; pos += blockSize) {
      if (pos === 0) {
        nodes.push({ ...rest, id: `${id}-start`, pos })
      } else {
        nodes.push({ ...rest, id: `${id}-${pos}`, pos })
      }
    }
    nodes.push({ ...rest, id: `${id}-end`, pos })
    for (let j = 0; j < nodes.length - 1; j++) {
      const source = nodes[j].id
      const target = nodes[j + 1].id
      Gp.links.push({
        ...rest,
        source,
        target,
        id,
        linkNum: i,
        length: sequence.length,
        sequence, // could put actual sequence here if needed
      })
    }
    Gp.nodes = Gp.nodes.concat(nodes)
  }
  for (let i = 0; i < G.links.length; i++) {
    const { strand1, strand2, source, target, ...rest } = G.links[i]

    // enumerates cases for which end of source connects to
    // which end of the target
    if (strand1 === '+' && strand2 === '+') {
      Gp.links.push({
        source: `${source}-end`,
        target: `${target}-start`,
        ...rest,
      })
    }
    if (strand1 === '-' && strand2 === '+') {
      Gp.links.push({
        source: `${source}-start`,
        target: `${target}-start`,
        ...rest,
      })
    }
    if (strand1 === '-' && strand2 === '-') {
      Gp.links.push({
        source: `${source}-start`,
        target: `${target}-end`,
        ...rest,
      })
    }
    if (strand1 === '+' && strand2 === '-') {
      Gp.links.push({
        source: `${source}-end`,
        target: `${target}-end`,
        ...rest,
      })
    }
  }
  return Gp
}

const Graph = React.forwardRef((props, ref) => {
  const {
    graph,
    blockSize = 500,
    thickness = 10,
    color = 'Rainbow',
    width = 1000,
    height = 1000,
    steps = 2000,
    onFeatureClick = () => {
      console.log('no feature click configured')
    },
  } = props
  const data = useMemo(() => {
    return reprocessGraph(graph, blockSize)
  }, [blockSize, graph])
  const total = graph.nodes.length

  const links = useMemo(() => {
    const links = data.links.map(d => Object.create(d))
    const nodes = data.nodes.map(d => Object.create(d))
    let max = 0
    for (let i = 0; i < data.links.length; i++) {
      max = Math.max(max, (data.links[i].sequence || {}).length || 0)
    }

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink(links)
          .id(d => d.id)
          .distance(link => {
            return link.sequence ? 1 : 10
          }),
      )
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(width / 2, height / 2))

    /// run a 1000 simulation node ticks
    for (let i = 0; i < steps; ++i) {
      simulation.tick()
    }
    return links
  }, [data.links, data.nodes, height, steps, width])

  useEffect(() => {
    ref.current.innerHTML = ''
    // Define the div for the tooltip
    const div = d3
      .select('body')
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)

    const svg = d3.create('svg').attr('viewBox', [0, 0, width, height])
    const g = svg
      .append('g')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', d => {
        return d.sequence ? thickness * 1.5 : 3
      })
      .attr('stroke', d => {
        return d.sequence
          ? d3.hsl(d3[`interpolate${color}`](d.linkNum / total)).darker()
          : 'grey'
      })
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y)
      .on('mouseover', (d, i) => {
        const link = data.links[i]
        div.transition().style('opacity', 0.9)

        const text =
          link.id ||
          `${link.source.replace(/-start|-end/, '')}-${link.target.replace(
            /-start|-end/,
            '',
          )}`
        div
          .html(text)
          .style('left', `${d3.event.pageX}px`)
          .style('top', `${d3.event.pageY - 28}px`)
      })
      .on('mouseout', () => {
        div.transition().style('opacity', 0)
      })
      .on('click', (d, i) => {
        div.transition().style('opacity', 0)
        const link = data.links[i]
        onFeatureClick(link)
      })

    // zoom logic, similar to https://observablehq.com/@d3/zoom
    function zoomed() {
      g.attr('transform', d3.event.transform)
    }
    svg.call(
      d3
        .zoom()
        .extent([
          [0, 0],
          [width, height],
        ])
        .scaleExtent([0.1, 8])
        .on('zoom', zoomed),
    )

    ref.current.appendChild(svg.node())
  }, [
    color,
    data.links,
    data.nodes,
    graph.links,
    height,
    links,
    onFeatureClick,
    ref,
    thickness,
    total,
    width,
  ])

  return <div ref={ref} />
})

export { Graph }
