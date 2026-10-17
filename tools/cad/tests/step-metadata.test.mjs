import test from 'node:test';
import assert from 'node:assert/strict';
import { extractStepMetadata } from '../step-metadata.mjs';

test('source evidence retains identities and declared units across entity-name whitespace', () => {
  const source = `ISO-10303-21;
HEADER;
FILE_SCHEMA ('AUTOMOTIVE_DESIGN');
ENDSEC;
DATA;
#1=PRODUCT ('root','Root assembly','',());
#2=PRODUCT ('screw','Repeated screw','',());
#3=PRODUCT_DEFINITION_FORMATION ('','',#1);
#4=PRODUCT_DEFINITION_FORMATION ('','',#2);
#5=PRODUCT_DEFINITION ('','',#3,#99);
#6=PRODUCT_DEFINITION ('','',#4,#99);
#7=NEXT_ASSEMBLY_USAGE_OCCURRENCE ('first','Screw','',#5,#6,$);
#8=NEXT_ASSEMBLY_USAGE_OCCURRENCE ('second','Screw','',#5,#6,$);
#9=(LENGTH_UNIT () NAMED_UNIT (*) SI_UNIT (.MILLI.,.METRE.));
#10=(NAMED_UNIT (*) PLANE_ANGLE_UNIT () SI_UNIT ($,.RADIAN.));
ENDSEC;
END-ISO-10303-21;`;
  const metadata = extractStepMetadata(source);
  assert.equal(metadata.schema, 'AUTOMOTIVE_DESIGN');
  assert.equal(metadata.products.length, 2);
  assert.deepEqual(metadata.definitions.map(({ entity, product }) => ({ entity, product })), [{ entity: '#5', product: '#1' }, { entity: '#6', product: '#2' }]);
  assert.deepEqual(metadata.occurrences.map(({ entity, parentDefinition, childDefinition, childProduct }) => ({ entity, parentDefinition, childDefinition, childProduct })), [
    { entity: '#7', parentDefinition: '#5', childDefinition: '#6', childProduct: '#2' },
    { entity: '#8', parentDefinition: '#5', childDefinition: '#6', childProduct: '#2' },
  ]);
  assert.equal(metadata.lengthUnits[0].unit, 'mm');
  assert.equal(metadata.angleUnits[0].unit, 'rad');
});
