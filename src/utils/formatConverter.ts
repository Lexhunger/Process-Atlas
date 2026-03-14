
/**
 * Utility to convert project data between JSON and XML
 */

export const formatConverter = {
  /**
   * Converts project JSON object to XML string
   */
  jsonToXml(data: any): string {
    const { project, graphs, nodes, edges } = data;
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<process-atlas>\n';
    
    // Project info
    xml += `  <project id="${project.id}" name="${this.escapeXml(project.name)}" createdAt="${project.createdAt}" updatedAt="${project.updatedAt}" />\n`;
    
    // Graphs
    xml += '  <graphs>\n';
    graphs.forEach((g: any) => {
      xml += `    <graph id="${g.id}" projectId="${g.projectId}" parentNodeId="${g.parentNodeId || ''}" />\n`;
    });
    xml += '  </graphs>\n';
    
    // Nodes
    xml += '  <nodes>\n';
    nodes.forEach((n: any) => {
      xml += `    <node id="${n.id}" graphId="${n.graphId}" type="${n.type}" parentId="${n.parentId || ''}">\n`;
      xml += `      <position x="${n.position.x}" y="${n.position.y}" />\n`;
      xml += `      <dimensions width="${n.width || ''}" height="${n.height || ''}" />\n`;
      xml += `      <data>\n`;
      xml += `        <title>${this.escapeXml(n.data.title)}</title>\n`;
      xml += `        <description>${this.escapeXml(n.data.description)}</description>\n`;
      xml += `        <nodeType>${n.data.nodeType}</nodeType>\n`;
      xml += `        <shape>${n.data.shape || 'rectangle'}</shape>\n`;
      xml += `        <isExpanded>${n.data.isExpanded}</isExpanded>\n`;
      xml += `        <isCollapsed>${n.data.isCollapsed || false}</isCollapsed>\n`;
      xml += `      </data>\n`;
      xml += `    </node>\n`;
    });
    xml += '  </nodes>\n';
    
    // Edges
    xml += '  <edges>\n';
    edges.forEach((e: any) => {
      xml += `    <edge id="${e.id}" graphId="${e.graphId}" source="${e.source}" target="${e.target}" sourceHandle="${e.sourceHandle || ''}" targetHandle="${e.targetHandle || ''}" type="${e.type}" relationshipType="${e.relationshipType || ''}" hasArrow="${e.hasArrow !== false}">\n`;
      xml += `      <label>${this.escapeXml(e.label)}</label>\n`;
      xml += `    </edge>\n`;
    });
    xml += '  </edges>\n';
    
    xml += '</process-atlas>';
    return xml;
  },

  /**
   * Converts XML string to project JSON object
   */
  xmlToJson(xmlString: string): any {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    
    const projectEl = xmlDoc.getElementsByTagName('project')[0];
    const project = {
      id: projectEl.getAttribute('id'),
      name: projectEl.getAttribute('name'),
      createdAt: parseInt(projectEl.getAttribute('createdAt') || '0'),
      updatedAt: parseInt(projectEl.getAttribute('updatedAt') || '0'),
    };
    
    const graphEls = xmlDoc.getElementsByTagName('graph');
    const graphs = Array.from(graphEls).map(el => ({
      id: el.getAttribute('id'),
      projectId: el.getAttribute('projectId'),
      parentNodeId: el.getAttribute('parentNodeId') || undefined,
    }));
    
    const nodeEls = xmlDoc.getElementsByTagName('node');
    const nodes = Array.from(nodeEls).map(el => {
      const posEl = el.getElementsByTagName('position')[0];
      const dimEl = el.getElementsByTagName('dimensions')[0];
      const dataEl = el.getElementsByTagName('data')[0];
      
      return {
        id: el.getAttribute('id'),
        graphId: el.getAttribute('graphId'),
        type: el.getAttribute('type'),
        parentId: el.getAttribute('parentId') || undefined,
        position: {
          x: parseFloat(posEl.getAttribute('x') || '0'),
          y: parseFloat(posEl.getAttribute('y') || '0'),
        },
        width: dimEl.getAttribute('width') ? parseFloat(dimEl.getAttribute('width')!) : undefined,
        height: dimEl.getAttribute('height') ? parseFloat(dimEl.getAttribute('height')!) : undefined,
        data: {
          title: dataEl.getElementsByTagName('title')[0]?.textContent || '',
          description: dataEl.getElementsByTagName('description')[0]?.textContent || '',
          nodeType: dataEl.getElementsByTagName('nodeType')[0]?.textContent || 'default',
          shape: dataEl.getElementsByTagName('shape')[0]?.textContent || 'rectangle',
          isExpanded: dataEl.getElementsByTagName('isExpanded')[0]?.textContent === 'true',
          isCollapsed: dataEl.getElementsByTagName('isCollapsed')[0]?.textContent === 'true',
        }
      };
    });
    
    const edgeEls = xmlDoc.getElementsByTagName('edge');
    const edges = Array.from(edgeEls).map(el => ({
      id: el.getAttribute('id'),
      graphId: el.getAttribute('graphId'),
      source: el.getAttribute('source'),
      target: el.getAttribute('target'),
      sourceHandle: el.getAttribute('sourceHandle') || undefined,
      targetHandle: el.getAttribute('targetHandle') || undefined,
      type: el.getAttribute('type'),
      relationshipType: el.getAttribute('relationshipType') || undefined,
      hasArrow: el.getAttribute('hasArrow') !== 'false',
      label: el.getElementsByTagName('label')[0]?.textContent || '',
    }));
    
    return { project, graphs, nodes, edges };
  },

  escapeXml(unsafe: string): string {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&"']/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '"': return '&quot;';
        case "'": return '&apos;';
        default: return c;
      }
    });
  }
};
