import fs from 'fs';
import path from 'path';

const file = 'hight_quality_realistic_man_character.glb';
const buffer = fs.readFileSync(file);

// Check magic
const magic = buffer.readUInt32LE(0);
if (magic !== 0x46546C67) {
  console.error("Invalid GLB magic: expected 0x46546C67, got 0x" + magic.toString(16));
  process.exit(1);
}

const version = buffer.readUInt32LE(4);
const length = buffer.readUInt32LE(8);
console.log(`GLB Version: ${version}, Total Length: ${length} bytes`);

// Read JSON chunk
const chunkLength = buffer.readUInt32LE(12);
const chunkType = buffer.readUInt32LE(16);
if (chunkType !== 0x4E4F534A) { // "JSON"
  console.error("First chunk is not JSON!");
  process.exit(1);
}

const jsonString = buffer.toString('utf8', 20, 20 + chunkLength);
const gltf = JSON.parse(jsonString);

console.log("Nodes count:", gltf.nodes ? gltf.nodes.length : 0);
console.log("Meshes count:", gltf.meshes ? gltf.meshes.length : 0);
console.log("Skins count:", gltf.skins ? gltf.skins.length : 0);
console.log("Animations count:", gltf.animations ? gltf.animations.length : 0);

// Let's print out animation names
if (gltf.animations) {
  console.log("\nAnimations:");
  gltf.animations.forEach((anim, idx) => {
    console.log(`  [${idx}] Name: "${anim.name}", Channels: ${anim.channels.length}, Samplers: ${anim.samplers.length}`);
  });
}

// Let's identify the joints in skins
const jointNames = new Set();
if (gltf.skins) {
  console.log("\nSkins info:");
  gltf.skins.forEach((skin, idx) => {
    console.log(`  Skin ${idx}: name="${skin.name || ''}", joints count=${skin.joints.length}, skeleton root node=${skin.skeleton}`);
    skin.joints.forEach(jIdx => {
      const node = gltf.nodes[jIdx];
      if (node && node.name) jointNames.add(node.name);
    });
  });
}

// Let's print the hierarchy starting from roots
console.log("\nNode Hierarchy (containing bones or scene root):");
const parentMap = {};
gltf.nodes.forEach((node, idx) => {
  if (node.children) {
    node.children.forEach(cIdx => {
      parentMap[cIdx] = idx;
    });
  }
});

function printNodeTree(nodeIdx, depth = 0) {
  const node = gltf.nodes[nodeIdx];
  if (!node) return;
  const isJoint = jointNames.has(node.name) ? " [BONE]" : "";
  console.log("  ".repeat(depth) + `- Node ${nodeIdx}: "${node.name || ''}"${isJoint}`);
  if (node.children) {
    node.children.forEach(cIdx => {
      printNodeTree(cIdx, depth + 1);
    });
  }
}

gltf.nodes.forEach((node, idx) => {
  if (parentMap[idx] === undefined) {
    let hasJoint = false;
    const checkJoint = (id) => {
      if (jointNames.has(gltf.nodes[id]?.name)) hasJoint = true;
      if (gltf.nodes[id]?.children) {
        gltf.nodes[id].children.forEach(checkJoint);
      }
    };
    checkJoint(idx);

    if (hasJoint || node.name === "Scene") {
      printNodeTree(idx, 0);
    }
  }
});
