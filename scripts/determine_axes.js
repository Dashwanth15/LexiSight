import fs from 'fs';
import * as THREE from 'three';

const file = 'hight_quality_realistic_man_character.glb';
const buffer = fs.readFileSync(file);
const chunkLength = buffer.readUInt32LE(12);
const jsonString = buffer.toString('utf8', 20, 20 + chunkLength);
const gltf = JSON.parse(jsonString);

// We want to reconstruct the local joint hierarchy for the Right Arm and Index finger
// Node indices from the GLTF JSON
const nodeMap = {};
gltf.nodes.forEach((node, idx) => {
  nodeMap[node.name] = {
    idx,
    name: node.name,
    translation: node.translation ? new THREE.Vector3(...node.translation) : new THREE.Vector3(),
    rotation: node.rotation ? new THREE.Quaternion(...node.rotation) : new THREE.Quaternion(),
    scale: node.scale ? new THREE.Vector3(...node.scale) : new THREE.Vector3(1, 1, 1),
    children: node.children || []
  };
});

// Build a simple hierarchy tree starting from Upperarm to Index3
// CC_Base_R_Upperarm_081 -> CC_Base_R_Forearm_082 -> CC_Base_R_Hand_086 -> CC_Base_R_Index1_096 -> CC_Base_R_Index2_097 -> CC_Base_R_Index3_098
const chain = [
  "CC_Base_R_Upperarm_081",
  "CC_Base_R_Forearm_082",
  "CC_Base_R_Hand_086",
  "CC_Base_R_Index1_096",
  "CC_Base_R_Index2_097",
  "CC_Base_R_Index3_098"
];

// Helper to compute local transform matrix
function getLocalMatrix(node) {
  const m = new THREE.Matrix4();
  m.compose(node.translation, node.rotation, node.scale);
  return m;
}

// Compute world position of a tip node relative to root (Upperarm)
// with custom local rotation applied to a specific bone
function computeTipPos(testBoneName, testAxis, angleDegrees) {
  // Deep clone node states
  const localNodes = {};
  for (const name of chain) {
    const orig = nodeMap[name];
    localNodes[name] = {
      translation: orig.translation.clone(),
      rotation: orig.rotation.clone(),
      scale: orig.scale.clone()
    };
  }

  // Apply rotation to test bone
  if (testBoneName) {
    const bone = localNodes[testBoneName];
    const rot = new THREE.Quaternion();
    const axisVec = new THREE.Vector3();
    axisVec[testAxis] = 1;
    rot.setFromAxisAngle(axisVec, angleDegrees * Math.PI / 180);
    bone.rotation.multiply(rot); // multiply on top of rest rotation
  }

  // Multiply matrices down the chain to get world matrix of the last node (Index3 tip)
  const worldMatrices = {};
  let currentMat = new THREE.Matrix4(); // identity

  for (let i = 0; i < chain.length; i++) {
    const name = chain[i];
    const node = localNodes[name];
    const localMat = new THREE.Matrix4().compose(node.translation, node.rotation, node.scale);
    currentMat = currentMat.clone().multiply(localMat);
    worldMatrices[name] = currentMat;
  }

  // Let's get the world position of the index finger tip (Node Index3)
  const tipPos = new THREE.Vector3();
  tipPos.setFromMatrixPosition(worldMatrices["CC_Base_R_Index3_098"]);
  return tipPos;
}

// 1. Let's find index finger bend axis
// We'll rotate CC_Base_R_Index2_097 by 45 degrees around X, Y, and Z
// and see which axis changes the tip position the most, and in which direction.
const baseTip = computeTipPos(null, 'x', 0);
console.log(`Base index tip position relative to upperarm: [${baseTip.x.toFixed(3)}, ${baseTip.y.toFixed(3)}, ${baseTip.z.toFixed(3)}]`);

['x', 'y', 'z'].forEach(axis => {
  const tip = computeTipPos("CC_Base_R_Index2_097", axis, 45);
  const diff = tip.clone().sub(baseTip);
  const dist = diff.length();
  console.log(`Index2 rotated 45 deg around ${axis.toUpperCase()}:`);
  console.log(`  Tip position: [${tip.x.toFixed(3)}, ${tip.y.toFixed(3)}, ${tip.z.toFixed(3)}]`);
  console.log(`  Displacement: [${diff.x.toFixed(3)}, ${diff.y.toFixed(3)}, ${diff.z.toFixed(3)}] (distance: ${dist.toFixed(3)})`);
});

// Let's also check the elbow (Forearm) bend axis
// Rotate Forearm (CC_Base_R_Forearm_082) by 45 degrees around X, Y, Z
console.log("\nElbow (Forearm) bend test:");
['x', 'y', 'z'].forEach(axis => {
  const tip = computeTipPos("CC_Base_R_Forearm_082", axis, 45);
  const diff = tip.clone().sub(baseTip);
  const dist = diff.length();
  console.log(`Forearm rotated 45 deg around ${axis.toUpperCase()}:`);
  console.log(`  Tip position: [${tip.x.toFixed(3)}, ${tip.y.toFixed(3)}, ${tip.z.toFixed(3)}]`);
  console.log(`  Displacement: [${diff.x.toFixed(3)}, ${diff.y.toFixed(3)}, ${diff.z.toFixed(3)}] (distance: ${dist.toFixed(3)})`);
});
