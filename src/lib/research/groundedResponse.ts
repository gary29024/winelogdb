import { parseStructuredJsonText } from '../producers/structuredJson';

type Field={type?:string;nullable?:boolean;enum?:string[];items?:{properties?:Record<string,Field>}};
type Contract={properties?:Record<string,Field>};

/** Let Search cite normal prose; extract the application fields locally, without another model call. */
export function describeGroundedResponse(schema:Contract){
  const sections=Object.entries(schema.properties??{}).map(([name,field])=>{
    if(field.type==='ARRAY')return `## ${name}\nUse a Markdown table with exactly these columns: ${Object.keys(field.items?.properties??{}).join(' | ')}. One wine per row. Write null for unknown optional cells; escape a literal pipe as \\|. If no wines were verified, write none. Do not put prose inside or after the table.`;
    if(field.type==='BOOLEAN')return `## ${name}\nWrite only true or false${field.nullable?' (or null)':''}.`;
    const scalar=/^(?:home|official|instagram|contact)/.test(name);
    return `## ${name}\n${scalar?'Write only the field value':'Write factual prose in short paragraphs or atomic bullets, retaining source citations'}${field.nullable?'; write null when unknown':'; leave the section empty if it was not requested'}.`;
  });
  return `Return the following named Markdown sections, using the exact headings. Keep facts in ordinary cited text so Google Search can attach its grounding evidence. Do not return JSON or a code fence. Do not add other headings.\n\n${sections.join('\n\n')}`;
}

function tableCells(line:string){
  if(!line.startsWith('|')||!line.endsWith('|'))throw new Error('Invalid grounded catalogue table: incomplete row');
  const cells:string[]=[],body=line.slice(1,-1);let cell='';
  for(let i=0;i<body.length;i++){
    if(body[i]==='\\'&&body[i+1]==='|'){cell+='|';i++}
    else if(body[i]==='|'){cells.push(cell.trim());cell=''}
    else cell+=body[i];
  }
  cells.push(cell.trim());return cells;
}

function parseTable(text:string,columns:string[]){
  if(text.trim()==='none')return [];
  const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  if(lines.length<2)throw new Error('Invalid grounded catalogue table: missing header');
  const header=tableCells(lines[0]),separator=tableCells(lines[1]);
  if(header.length!==columns.length||header.some((name,index)=>name!==columns[index])||separator.length!==columns.length||separator.some(cell=>!/^:?-{3,}:?$/.test(cell)))throw new Error('Invalid grounded catalogue table: wrong columns');
  return lines.slice(2).map(line=>{
    const values=tableCells(line);if(values.length!==columns.length)throw new Error('Invalid grounded catalogue table: incomplete row');
    return Object.fromEntries(columns.map((name,index)=>[name,values[index]==='null'?null:values[index]]));
  });
}

/** JSON receipts submitted by an older deployment remain replayable. Missing prose fields stay empty for the scope gate. */
export function parseGroundedResponseText(text:string,schema:Contract):Record<string,unknown>{
  const headings=[...text.matchAll(/^##[ \t]+([A-Za-z][A-Za-z0-9]*)[ \t]*\r?$/gm)];
  if(!headings.length)return parseStructuredJsonText(text) as Record<string,unknown>;
  const sections=new Map<string,string>();
  for(let i=0;i<headings.length;i++){
    const heading=headings[i],name=heading[1];
    if(sections.has(name))throw new Error(`Duplicate grounded research section: ${name}`);
    sections.set(name,text.slice(heading.index!+heading[0].length,headings[i+1]?.index??text.length).trim());
  }
  const result:Record<string,unknown>={};
  for(const [name,field] of Object.entries(schema.properties??{})){
    const value=sections.get(name)??'';
    if(field.type==='ARRAY'){
      if(sections.has(name))result[name]=parseTable(value,Object.keys(field.items?.properties??{}));
    }else if(field.type==='BOOLEAN'){
      if(value==='true'||value==='false')result[name]=value==='true';
      else if(value==='null'&&field.nullable)result[name]=null;
      else if(!value)result[name]=false; // Never claim completeness from a missing section.
      else throw new Error(`Invalid grounded research boolean: ${name}`);
    }else result[name]=value==='null'&&field.nullable?null:value;
  }
  return result;
}
