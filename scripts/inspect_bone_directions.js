import fs from 'fs';

const file = 'hight_quality_realistic_man_character.glb';
const buffer = fs.readFileSync(file);
const chunkLength = buffer.readUInt32LE(12);
const jsonString = buffer.toString('utf8', 20, 20 + chunkLength);
const gltf = JSON.parse(jsonString);

// Let's inspect some right arm and right index finger bone translations
const bonesToInspect = [
  "CC_Base_R_Clavicle_080",
  "CC_Base_R_Upperarm_081",
  "CC_Base_R_Forearm_082",
  "CC_Base_R_Hand_086",
  "CC_Base_R_Index1_096",
  "CC_Base_R_Index2_097",
  "CC_Base_R_Index3_098"
];

console.log("Bone Translations and Rotations in GLTF:");
gltf.nodes.forEach((node, idx) => {
  if (bonesToInspect.includes(node.name)) {
    console.log(`Node ${idx}: "${node.name}"`);
    if (node.translation) console.log(`  translation: [${node.translation.join(', ')}]`);
    if (node.rotation) console.log(`  rotation (quaternion): [${node.rotation.join(', ')}]`);
    if (node.scale) console.log(`  scale: [${node.scale.join(', ')}]`);
    if (node.children) console.log(`  children node indices: [${node.children.join(', ')}]`);
  }
});
