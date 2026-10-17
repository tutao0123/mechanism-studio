/** Limited, read-only metadata extraction for the retained ISO 10303-21 specimens.
 * Geometry, units conversion and tessellation are performed by OCCT, never by this parser.
 */
export function extractStepMetadata(text) {
  const entities=new Map([...text.matchAll(/#(\d+)\s*=\s*([\s\S]*?);/g)].map(m=>['#'+m[1],m[2].trim()]));
  const strings=value=>[...value.matchAll(/'((?:[^']|'')*)'/g)].map(m=>m[1].replaceAll("''","'"));
  const refs=value=>value.match(/#\d+/g)??[];
  const products=[...entities].filter(([,v])=>/^PRODUCT\s*\(/.test(v)).map(([id,v])=>({id,productId:strings(v)[0],name:strings(v)[1],description:strings(v)[2]}));
  const productMap=new Map(products.map(p=>[p.id,p]));
  function productForDefinition(id) {const formation=refs(entities.get(id)??'')[0];return productMap.get(refs(entities.get(formation)??'')[0])??null;}
  const definitions=[...entities].filter(([,v])=>/^PRODUCT_DEFINITION\s*\(/.test(v)).map(([entity,raw])=>({entity,product:productForDefinition(entity)?.id??null,raw}));
  const occurrences=[...entities].filter(([,v])=>/^NEXT_ASSEMBLY_USAGE_OCCURRENCE\s*\(/.test(v)).map(([entity,v])=>{const [parentDefinition,childDefinition]=refs(v),s=strings(v);return{entity,occurrenceId:s[0],name:s[1],parentDefinition,childDefinition,parentProduct:productForDefinition(parentDefinition)?.id??null,childProduct:productForDefinition(childDefinition)?.id??null};});
  const assemblyDefinitions=new Set(occurrences.map(o=>o.parentDefinition));
  const lengthUnits=[...entities].filter(([,v])=>/LENGTH_UNIT\s*\(/.test(v)).map(([entity,v])=>({entity,raw:v,unit:/SI_UNIT\s*\(\s*\.MILLI\.\s*,\s*\.METRE\.\s*\)/.test(v)?'mm':/SI_UNIT\s*\(\s*\$\s*,\s*\.METRE\.\s*\)/.test(v)?'m':'unresolved'}));
  const angleUnits=[...entities].filter(([,v])=>/PLANE_ANGLE_UNIT\s*\(/.test(v)).map(([entity,raw])=>({entity,raw,unit:/SI_UNIT\s*\(\s*\$\s*,\s*\.RADIAN\.\s*\)/.test(raw)?'rad':'unresolved'}));
  const placements=[...entities].filter(([,v])=>/^(?:AXIS2_PLACEMENT_3D|ITEM_DEFINED_TRANSFORMATION|REPRESENTATION_RELATIONSHIP|CONTEXT_DEPENDENT_SHAPE_REPRESENTATION)/.test(v)).map(([entity,raw])=>({entity,raw}));
  return {schemaVersion:'1.0.0',schema:strings(text.match(/FILE_SCHEMA\s*\(([\s\S]*?)\)\s*;/)?.[1]??'')[0]??null,products,definitions,occurrences,lengthUnits,angleUnits,placements,statistics:{productCount:products.length,occurrenceCount:occurrences.length,assemblyOccurrences:occurrences.filter(o=>assemblyDefinitions.has(o.childDefinition)).length,leafOccurrences:occurrences.filter(o=>!assemblyDefinitions.has(o.childDefinition)).length},limitations:['Metadata parser is restricted to this specimen; it is not an ISO 10303 conformance parser.','Raw placement entities are retained but no general placement or mate solver is implemented.']};
}
