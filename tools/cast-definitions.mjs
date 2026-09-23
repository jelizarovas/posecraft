// Littlelands Authentic 3D Cast Definitions & Kinematics
// Authored to match the approved reference sheets in art-source/littlelands/
// Provides models, joint hierarchies, and frame animation functions.

export function createCastDefinitions(THREE) {
  const TAU = Math.PI * 2;

  // Material helpers
  function mat(color, roughness = 0.75, metalness = 0.05) {
    return new THREE.MeshStandardMaterial({
      color: typeof color === 'string' ? parseInt(color.replace('#', '0x'), 16) : color,
      roughness,
      metalness,
      flatShading: false
    });
  }

  // Common limb helper
  function makeBone(name) {
    const g = new THREE.Group();
    g.name = name;
    return g;
  }

  // -------------------------------------------------------------
  // 1. Mara (Farmer) - 1.70m Adult Female Villager
  // -------------------------------------------------------------
  function buildMara() {
    const root = new THREE.Group();
    root.name = 'Mara_Root';

    // Materials
    const skinMat = mat('#d5a47f', 0.6);
    const hairMat = mat('#2c221e', 0.9);
    const ochreMat = mat('#a57739', 0.8);
    const greenMat = mat('#485c41', 0.8);
    const apronMat = mat('#cfc4ad', 0.85);
    const patchMat = mat('#867355', 0.85);
    const strawMat = mat('#cda654', 0.7);
    const bootMat = mat('#3c2c20', 0.8);
    const toolWoodMat = mat('#6b4c30', 0.7);
    const toolIronMat = mat('#3a3a3a', 0.4, 0.4);

    // Skeleton hierarchy
    const pelvis = makeBone('pelvis');
    pelvis.position.y = 0.95;
    root.add(pelvis);

    // Spine & Torso
    const spine = makeBone('spine');
    pelvis.add(spine);

    // Torso mesh (ochre tunic + apron)
    const torsoGeom = new THREE.CylinderGeometry(0.18, 0.20, 0.48, 12);
    const torsoMesh = new THREE.Mesh(torsoGeom, ochreMat);
    torsoMesh.position.y = 0.24;
    spine.add(torsoMesh);

    // Apron bib & patch
    const apronBib = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.32), apronMat);
    apronBib.position.set(0, 0.24, 0.19);
    spine.add(apronBib);

    const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.08), patchMat);
    patch.position.set(0.05, 0.18, 0.192);
    patch.rotation.z = 0.1;
    spine.add(patch);

    // Chest & Neck
    const neck = makeBone('neck');
    neck.position.y = 0.48;
    spine.add(neck);

    // Head
    const head = makeBone('head');
    head.position.y = 0.12;
    neck.add(head);

    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), skinMat);
    headMesh.scale.set(0.9, 1.1, 1.0);
    head.add(headMesh);

    // Dark hair bun
    const hairBun = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), hairMat);
    hairBun.position.set(0, 0.02, -0.11);
    head.add(hairBun);

    // Straw Hat (Crown + Wide Brim)
    const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.10, 16), strawMat);
    hatCrown.position.y = 0.12;
    head.add(hatCrown);

    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 16), strawMat);
    hatBrim.position.y = 0.08;
    head.add(hatBrim);

    // Shoulders & Arms
    const shoulderL = makeBone('shoulderL');
    shoulderL.position.set(-0.22, 0.42, 0);
    spine.add(shoulderL);

    const armL = makeBone('armL');
    shoulderL.add(armL);
    const upperL = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.26, 8), ochreMat);
    upperL.position.y = -0.13;
    armL.add(upperL);

    const elbowL = makeBone('elbowL');
    elbowL.position.y = -0.26;
    armL.add(elbowL);
    const foreL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.26, 8), skinMat);
    foreL.position.y = -0.13;
    elbowL.add(foreL);

    const handL = makeBone('handL');
    handL.position.y = -0.26;
    elbowL.add(handL);
    const handLMesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), skinMat);
    handL.add(handLMesh);

    const shoulderR = makeBone('shoulderR');
    shoulderR.position.set(0.22, 0.42, 0);
    spine.add(shoulderR);

    const armR = makeBone('armR');
    shoulderR.add(armR);
    const upperR = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.26, 8), ochreMat);
    upperR.position.y = -0.13;
    armR.add(upperR);

    const elbowR = makeBone('elbowR');
    elbowR.position.y = -0.26;
    armR.add(elbowR);
    const foreR = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.26, 8), skinMat);
    foreR.position.y = -0.13;
    elbowR.add(foreR);

    const handR = makeBone('handR');
    handR.position.y = -0.26;
    elbowR.add(handR);
    const handRMesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), skinMat);
    handR.add(handRMesh);

    // Farming Hoe (attached to handR)
    const hoeProp = new THREE.Group();
    hoeProp.name = 'hoe_prop';
    const hoeShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.25, 8), toolWoodMat);
    hoeShaft.position.y = -0.25;
    const hoeBlade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.10, 0.02), toolIronMat);
    hoeBlade.position.set(0, -0.86, 0.06);
    hoeBlade.rotation.x = 0.4;
    hoeProp.add(hoeShaft);
    hoeProp.add(hoeBlade);
    hoeProp.visible = false;
    handR.add(hoeProp);

    // Lower body: Green Skirt
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.32, 0.62, 12), greenMat);
    skirt.position.y = -0.31;
    pelvis.add(skirt);

    // Legs & Boots
    const hipL = makeBone('hipL');
    hipL.position.set(-0.11, -0.15, 0);
    pelvis.add(hipL);

    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.45, 8), greenMat);
    legL.position.y = -0.225;
    hipL.add(legL);

    const footL = makeBone('footL');
    footL.position.y = -0.45;
    hipL.add(footL);
    const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.22), bootMat);
    bootL.position.set(0, -0.07, 0.04);
    footL.add(bootL);

    const hipR = makeBone('hipR');
    hipR.position.set(0.11, -0.15, 0);
    pelvis.add(hipR);

    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.45, 8), greenMat);
    legR.position.y = -0.225;
    hipR.add(legR);

    const footR = makeBone('footR');
    footR.position.y = -0.45;
    hipR.add(footR);
    const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.22), bootMat);
    bootR.position.set(0, -0.07, 0.04);
    footR.add(bootR);

    // Animation controllers
    function setPose(action, t) {
      // reset transforms
      pelvis.position.set(0, 0.95, 0);
      pelvis.rotation.set(0, 0, 0);
      spine.rotation.set(0, 0, 0);
      head.rotation.set(0, 0, 0);
      armL.rotation.set(0, 0, 0);
      elbowL.rotation.set(0, 0, 0);
      armR.rotation.set(0, 0, 0);
      elbowR.rotation.set(0, 0, 0);
      hipL.rotation.set(0, 0, 0);
      hipR.rotation.set(0, 0, 0);
      hoeProp.visible = false;

      if (action === 'idle') {
        const breath = Math.sin(t * TAU);
        pelvis.position.y = 0.95 + breath * 0.008;
        head.rotation.x = breath * 0.02;
        head.rotation.y = Math.sin(t * TAU * 0.5) * 0.05;
        armL.rotation.x = 0.05 + breath * 0.02;
        armR.rotation.x = 0.05 + breath * 0.02;
      } else if (action === 'walk') {
        const stride = Math.sin(t * TAU);
        const bob = Math.abs(Math.cos(t * TAU)) * 0.035;
        pelvis.position.y = 0.95 - bob;
        pelvis.rotation.y = -stride * 0.06;
        hipL.rotation.x = stride * 0.45;
        hipR.rotation.x = -stride * 0.45;
        armL.rotation.x = -stride * 0.40;
        armR.rotation.x = stride * 0.40;
        elbowL.rotation.x = Math.max(0, -stride * 0.25);
        elbowR.rotation.x = Math.max(0, stride * 0.25);
      } else if (action === 'turn') {
        pelvis.position.y = 0.95 + Math.sin(t * Math.PI) * 0.02;
        hipL.rotation.x = Math.sin(t * TAU) * 0.2;
        hipR.rotation.y = -t * 0.5;
        head.rotation.y = -t * 0.8;
      } else if (action === 'work') {
        hoeProp.visible = true;
        const cycle = Math.sin(t * TAU);
        pelvis.position.y = 0.90;
        spine.rotation.x = 0.25 + Math.max(0, cycle) * 0.2;
        armR.rotation.x = -0.6 - cycle * 0.4;
        elbowR.rotation.x = 0.5;
        armL.rotation.x = -0.4 - cycle * 0.3;
        elbowL.rotation.x = 0.7;
        head.rotation.x = 0.2;
      } else if (action === 'interact') {
        pelvis.position.y = 0.95;
        armL.rotation.x = 0.1;
        armR.rotation.x = -2.2;
        armR.rotation.z = -0.3;
        elbowR.rotation.z = Math.sin(t * TAU * 3) * 0.35;
        head.rotation.x = -0.1;
        head.rotation.y = Math.sin(t * TAU) * 0.15;
      }
    }

    return {root, setPose, height: 1.70, type: 'human'};
  }

  // -------------------------------------------------------------
  // 2. Bram (Miller) - 1.78m Heavy Adult Male Villager
  // -------------------------------------------------------------
  function buildBram() {
    const root = new THREE.Group();
    root.name = 'Bram_Root';

    // Materials
    const skinMat = mat('#d5a079', 0.6);
    const hairMat = mat('#433222', 0.9);
    const beardMat = mat('#3a2818', 0.95);
    const taupeMat = mat('#92806e', 0.8);
    const suspenderMat = mat('#3c2d20', 0.8);
    const pantMat = mat('#383027', 0.85);
    const bootMat = mat('#2a241e', 0.8);
    const sackMat = mat('#ab9374', 0.9);

    const pelvis = makeBone('pelvis');
    pelvis.position.y = 0.98;
    root.add(pelvis);

    const spine = makeBone('spine');
    pelvis.add(spine);

    // Heavy Torso + Prominent Wide Belly!
    const chestGeom = new THREE.CylinderGeometry(0.27, 0.32, 0.55, 12);
    const chestMesh = new THREE.Mesh(chestGeom, taupeMat);
    chestMesh.position.y = 0.28;
    spine.add(chestMesh);

    // Wide rounded belly protruding forward
    const bellyGeom = new THREE.SphereGeometry(0.32, 12, 12);
    const bellyMesh = new THREE.Mesh(bellyGeom, taupeMat);
    bellyMesh.position.set(0, 0.22, 0.14);
    bellyMesh.scale.set(1.15, 0.95, 1.15);
    spine.add(bellyMesh);

    // Leather Suspenders
    for (const side of [-0.14, 0.14]) {
      const suspender = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.56, 0.02), suspenderMat);
      suspender.position.set(side, 0.28, 0.20);
      spine.add(suspender);
    }

    // Head, Face & Full Beard
    const neck = makeBone('neck');
    neck.position.y = 0.55;
    spine.add(neck);

    const head = makeBone('head');
    head.position.y = 0.13;
    neck.add(head);

    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), skinMat);
    headMesh.scale.set(1.05, 1.0, 1.05);
    head.add(headMesh);

    const beardMesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), beardMat);
    beardMesh.position.set(0, -0.06, 0.08);
    beardMesh.scale.set(1.0, 0.9, 1.1);
    head.add(beardMesh);

    const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.145, 10, 10), hairMat);
    hairMesh.position.set(0, 0.04, -0.04);
    head.add(hairMesh);

    // Thick Arms
    const shoulderL = makeBone('shoulderL');
    shoulderL.position.set(-0.32, 0.46, 0);
    spine.add(shoulderL);

    const armL = makeBone('armL');
    shoulderL.add(armL);
    const upperL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.28, 8), taupeMat);
    upperL.position.y = -0.14;
    armL.add(upperL);

    const elbowL = makeBone('elbowL');
    elbowL.position.y = -0.28;
    armL.add(elbowL);
    const foreL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.26, 8), skinMat);
    foreL.position.y = -0.13;
    elbowL.add(foreL);

    const handL = makeBone('handL');
    handL.position.y = -0.26;
    elbowL.add(handL);
    handL.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), skinMat));

    const shoulderR = makeBone('shoulderR');
    shoulderR.position.set(0.32, 0.46, 0);
    spine.add(shoulderR);

    const armR = makeBone('armR');
    shoulderR.add(armR);
    const upperR = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.28, 8), taupeMat);
    upperR.position.y = -0.14;
    armR.add(upperR);

    const elbowR = makeBone('elbowR');
    elbowR.position.y = -0.28;
    armR.add(elbowR);
    const foreR = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.26, 8), skinMat);
    foreR.position.y = -0.13;
    elbowR.add(foreR);

    const handR = makeBone('handR');
    handR.position.y = -0.26;
    elbowR.add(handR);
    handR.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), skinMat));

    // Carried Grain Sack
    const sackProp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), sackMat);
    sackProp.scale.set(1.0, 1.3, 0.85);
    sackProp.position.set(0, 0.30, 0.35);
    sackProp.visible = false;
    spine.add(sackProp);

    // Thick Legs (wide stance)
    const hipL = makeBone('hipL');
    hipL.position.set(-0.16, -0.10, 0);
    pelvis.add(hipL);
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.095, 0.48, 8), pantMat);
    legL.position.y = -0.24;
    hipL.add(legL);

    const footL = makeBone('footL');
    footL.position.y = -0.48;
    hipL.add(footL);
    const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.26), bootMat);
    bootL.position.set(0, -0.08, 0.05);
    footL.add(bootL);

    const hipR = makeBone('hipR');
    hipR.position.set(0.16, -0.10, 0);
    pelvis.add(hipR);
    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.095, 0.48, 8), pantMat);
    legR.position.y = -0.24;
    hipR.add(legR);

    const footR = makeBone('footR');
    footR.position.y = -0.48;
    hipR.add(footR);
    const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.26), bootMat);
    bootR.position.set(0, -0.08, 0.05);
    footR.add(bootR);

    function setPose(action, t) {
      pelvis.position.set(0, 0.98, 0);
      pelvis.rotation.set(0, 0, 0);
      spine.rotation.set(0, 0, 0);
      head.rotation.set(0, 0, 0);
      armL.rotation.set(0, 0, 0);
      armR.rotation.set(0, 0, 0);
      elbowL.rotation.set(0, 0, 0);
      elbowR.rotation.set(0, 0, 0);
      hipL.rotation.set(0, 0, 0);
      hipR.rotation.set(0, 0, 0);
      sackProp.visible = false;

      if (action === 'idle') {
        const breath = Math.sin(t * TAU);
        pelvis.position.y = 0.98 + breath * 0.006;
        armL.rotation.z = 0.12;
        armR.rotation.z = -0.12;
        head.rotation.y = Math.sin(t * TAU * 0.5) * 0.06;
      } else if (action === 'walk') {
        const stride = Math.sin(t * TAU);
        const bob = Math.abs(Math.cos(t * TAU)) * 0.045;
        pelvis.position.y = 0.98 - bob;
        pelvis.rotation.z = stride * 0.04;
        hipL.rotation.x = stride * 0.38;
        hipR.rotation.x = -stride * 0.38;
        armL.rotation.x = -stride * 0.35;
        armL.rotation.z = 0.18;
        armR.rotation.x = stride * 0.35;
        armR.rotation.z = -0.18;
      } else if (action === 'turn') {
        pelvis.position.y = 0.98 + Math.sin(t * Math.PI) * 0.02;
        hipL.rotation.x = Math.sin(t * TAU) * 0.18;
        head.rotation.y = -t * 0.7;
      } else if (action === 'work') {
        sackProp.visible = true;
        const stride = Math.sin(t * TAU);
        pelvis.position.y = 0.95 - Math.abs(Math.cos(t * TAU)) * 0.04;
        spine.rotation.x = -0.12;
        armL.rotation.set(-0.8, 0, 0.4);
        elbowL.rotation.set(1.2, 0, 0);
        armR.rotation.set(-0.8, 0, -0.4);
        elbowR.rotation.set(1.2, 0, 0);
        hipL.rotation.x = stride * 0.32;
        hipR.rotation.x = -stride * 0.32;
      } else if (action === 'interact') {
        pelvis.position.y = 0.98;
        head.rotation.y = Math.sin(t * TAU) * 0.12;
        head.rotation.x = Math.sin(t * TAU * 2) * 0.05;
        armR.rotation.set(-0.6 + Math.sin(t * TAU * 2) * 0.2, 0, -0.2);
        elbowR.rotation.set(0.8, 0, 0);
        armL.rotation.set(0.1, 0, 0.15);
      }
    }

    return {root, setPose, height: 1.78, type: 'human'};
  }

  // -------------------------------------------------------------
  // 3. Pip (Child 1) - 1.20m Child (~8yo, Child Proportions)
  // -------------------------------------------------------------
  function buildPip() {
    const root = new THREE.Group();
    root.name = 'Pip_Root';

    // Materials
    const skinMat = mat('#ddaa82', 0.6);
    const hairMat = mat('#3c2a1c', 0.9);
    const tunicMat = mat('#c8662d', 0.8);
    const capMat = mat('#573e2b', 0.85);
    const pantMat = mat('#476982', 0.8);
    const bootMat = mat('#4c3929', 0.8);
    const ballMat = mat('#b84832', 0.5);

    const pelvis = makeBone('pelvis');
    pelvis.position.y = 0.65;
    root.add(pelvis);

    const spine = makeBone('spine');
    pelvis.add(spine);

    const torsoMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.34, 10), tunicMat);
    torsoMesh.position.y = 0.17;
    spine.add(torsoMesh);

    const neck = makeBone('neck');
    neck.position.y = 0.34;
    spine.add(neck);

    const head = makeBone('head');
    head.position.y = 0.10;
    neck.add(head);

    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 12), skinMat);
    head.add(headMesh);

    const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), hairMat);
    hairMesh.position.set(0, 0.02, -0.03);
    head.add(hairMesh);

    const capMesh = new THREE.Mesh(new THREE.SphereGeometry(0.125, 10, 10), capMat);
    capMesh.position.set(0, 0.06, -0.04);
    capMesh.scale.set(1.05, 0.85, 1.15);
    head.add(capMesh);

    const shoulderL = makeBone('shoulderL');
    shoulderL.position.set(-0.16, 0.30, 0);
    spine.add(shoulderL);

    const armL = makeBone('armL');
    shoulderL.add(armL);
    const upperL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.18, 8), tunicMat);
    upperL.position.y = -0.09;
    armL.add(upperL);

    const elbowL = makeBone('elbowL');
    elbowL.position.y = -0.18;
    armL.add(elbowL);
    const foreL = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.035, 0.16, 8), skinMat);
    foreL.position.y = -0.08;
    elbowL.add(foreL);

    const handL = makeBone('handL');
    handL.position.y = -0.16;
    elbowL.add(handL);
    handL.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), skinMat));

    const shoulderR = makeBone('shoulderR');
    shoulderR.position.set(0.16, 0.30, 0);
    spine.add(shoulderR);

    const armR = makeBone('armR');
    shoulderR.add(armR);
    const upperR = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.18, 8), tunicMat);
    upperR.position.y = -0.09;
    armR.add(upperR);

    const elbowR = makeBone('elbowR');
    elbowR.position.y = -0.18;
    armR.add(elbowR);
    const foreR = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.035, 0.16, 8), skinMat);
    foreR.position.y = -0.08;
    elbowR.add(foreR);

    const handR = makeBone('handR');
    handR.position.y = -0.16;
    elbowR.add(handR);
    handR.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), skinMat));

    const ballProp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), ballMat);
    ballProp.position.set(0, 0.20, 0.22);
    ballProp.visible = false;
    spine.add(ballProp);

    const hipL = makeBone('hipL');
    hipL.position.set(-0.08, -0.05, 0);
    pelvis.add(hipL);
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.048, 0.32, 8), pantMat);
    legL.position.y = -0.16;
    hipL.add(legL);

    const footL = makeBone('footL');
    footL.position.y = -0.32;
    hipL.add(footL);
    const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, 0.16), bootMat);
    bootL.position.set(0, -0.05, 0.03);
    footL.add(bootL);

    const hipR = makeBone('hipR');
    hipR.position.set(0.08, -0.05, 0);
    pelvis.add(hipR);
    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.048, 0.32, 8), pantMat);
    legR.position.y = -0.16;
    hipR.add(legR);

    const footR = makeBone('footR');
    footR.position.y = -0.32;
    hipR.add(footR);
    const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, 0.16), bootMat);
    bootR.position.set(0, -0.05, 0.03);
    footR.add(bootR);

    function setPose(action, t) {
      pelvis.position.set(0, 0.65, 0);
      pelvis.rotation.set(0, 0, 0);
      spine.rotation.set(0, 0, 0);
      head.rotation.set(0, 0, 0);
      armL.rotation.set(0, 0, 0);
      armR.rotation.set(0, 0, 0);
      elbowL.rotation.set(0, 0, 0);
      elbowR.rotation.set(0, 0, 0);
      hipL.rotation.set(0, 0, 0);
      hipR.rotation.set(0, 0, 0);
      ballProp.visible = false;

      if (action === 'idle') {
        const bounce = Math.sin(t * TAU);
        pelvis.position.y = 0.65 + bounce * 0.01;
        head.rotation.x = bounce * 0.03;
        head.rotation.y = Math.sin(t * TAU * 0.5) * 0.08;
      } else if (action === 'walk') {
        const stride = Math.sin(t * TAU);
        const bounce = Math.abs(Math.cos(t * TAU)) * 0.04;
        pelvis.position.y = 0.65 - bounce;
        hipL.rotation.x = stride * 0.55;
        hipR.rotation.x = -stride * 0.55;
        armL.rotation.x = -stride * 0.50;
        armR.rotation.x = stride * 0.50;
      } else if (action === 'turn') {
        pelvis.position.y = 0.65 + Math.sin(t * Math.PI) * 0.02;
        hipL.rotation.x = Math.sin(t * TAU) * 0.25;
        head.rotation.y = -t * 0.8;
      } else if (action === 'work') {
        ballProp.visible = true;
        const toss = Math.sin(t * TAU);
        ballProp.position.y = 0.20 + Math.max(0, toss) * 0.45;
        pelvis.position.y = 0.65 - Math.max(0, -toss) * 0.12;
        armL.rotation.set(-1.2 - toss * 0.4, 0, 0.3);
        armR.rotation.set(-1.2 - toss * 0.4, 0, -0.3);
      } else if (action === 'interact') {
        const hop = Math.abs(Math.sin(t * TAU * 2)) * 0.08;
        pelvis.position.y = 0.65 + hop;
        armL.rotation.set(-2.4, 0, 0.4);
        armR.rotation.set(-2.4, 0, -0.4);
        head.rotation.x = -0.2;
      }
    }

    return {root, setPose, height: 1.20, type: 'human'};
  }

  // -------------------------------------------------------------
  // 4. Cream Ewe (ewe-cream) - 0.85m Shoulder Ovine Quadruped
  // -------------------------------------------------------------
  function buildEwe() {
    const root = new THREE.Group();
    root.name = 'Ewe_Root';

    const woolMat = mat('#ded5c2', 0.95);
    const skinMat = mat('#524a40', 0.7);
    const hoofMat = mat('#25201d', 0.8);
    const earMat = mat('#cfc6b2', 0.8);

    const body = makeBone('body');
    body.position.y = 0.55;
    root.add(body);

    const fleece = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), woolMat);
    fleece.scale.set(0.9, 0.95, 1.35);
    body.add(fleece);

    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), woolMat);
    tail.position.set(0, 0.12, -0.50);
    body.add(tail);

    const neck = makeBone('neck');
    neck.position.set(0, 0.15, 0.45);
    body.add(neck);

    const head = makeBone('head');
    head.position.set(0, 0.18, 0.15);
    neck.add(head);

    const headWool = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), woolMat);
    head.add(headWool);

    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.10, 0.18, 8), skinMat);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, -0.05, 0.14);
    head.add(muzzle);

    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.06), earMat);
      ear.position.set(side * 0.16, 0.02, -0.02);
      ear.rotation.z = side * 0.6;
      ear.rotation.x = 0.2;
      head.add(ear);
    }

    const legs = {};
    const legOffsets = {
      frontL: [-0.16, 0.35],
      frontR: [0.16, 0.35],
      hindL: [-0.16, -0.35],
      hindR: [0.16, -0.35]
    };

    for (const [name, [x, z]] of Object.entries(legOffsets)) {
      const hip = makeBone(name);
      hip.position.set(x, -0.15, z);
      body.add(hip);

      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.22, 8), skinMat);
      upper.position.y = -0.11;
      hip.add(upper);

      const knee = makeBone(name + '_knee');
      knee.position.y = -0.22;
      hip.add(knee);

      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.032, 0.20, 8), skinMat);
      lower.position.y = -0.10;
      knee.add(lower);

      const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.07, 0.09), hoofMat);
      hoof.position.set(0, -0.20, 0.01);
      knee.add(hoof);

      legs[name] = {hip, knee};
    }

    function setPose(action, t) {
      body.position.set(0, 0.55, 0);
      body.rotation.set(0, 0, 0);
      neck.rotation.set(0, 0, 0);
      head.rotation.set(0, 0, 0);
      for (const l of Object.values(legs)) {
        l.hip.rotation.set(0, 0, 0);
        l.knee.rotation.set(0, 0, 0);
      }

      if (action === 'idle') {
        const b = Math.sin(t * TAU);
        body.position.y = 0.55 + b * 0.005;
        neck.rotation.x = b * 0.02;
        head.rotation.y = Math.sin(t * TAU * 0.5) * 0.06;
      } else if (action === 'walk') {
        const phase1 = Math.sin(t * TAU);
        body.position.y = 0.55 - Math.abs(phase1) * 0.02;
        legs.frontL.hip.rotation.x = phase1 * 0.40;
        legs.hindR.hip.rotation.x = phase1 * 0.40;
        legs.frontR.hip.rotation.x = -phase1 * 0.40;
        legs.hindL.hip.rotation.x = -phase1 * 0.40;
        legs.frontL.knee.rotation.x = Math.max(0, -phase1 * 0.35);
        legs.frontR.knee.rotation.x = Math.max(0, phase1 * 0.35);
      } else if (action === 'turn') {
        body.position.y = 0.55 + Math.sin(t * Math.PI) * 0.015;
        legs.frontL.hip.rotation.x = Math.sin(t * TAU) * 0.2;
        legs.frontR.hip.rotation.x = -Math.sin(t * TAU) * 0.2;
        head.rotation.y = -t * 0.6;
      } else if (action === 'graze') {
        const chew = Math.sin(t * TAU * 4);
        neck.rotation.x = 0.95;
        head.rotation.x = -0.45;
        head.rotation.y = chew * 0.08;
        body.position.y = 0.52;
      } else if (action === 'interact') {
        const shake = Math.sin(t * TAU * 3);
        body.rotation.z = shake * 0.08;
        neck.rotation.x = -0.25;
        head.rotation.x = 0.2;
      }
    }

    return {root, setPose, height: 0.85, type: 'animal'};
  }

  // -------------------------------------------------------------
  // 5. Brown-and-white Cow (cow-brown-white) - 1.40m Bovine
  // -------------------------------------------------------------
  function buildCow() {
    const root = new THREE.Group();
    root.name = 'Cow_Root';

    const brownMat = mat('#8a4a28', 0.75);
    const whiteMat = mat('#ece7dd', 0.8);
    const skinMat = mat('#38302a', 0.7);
    const pinkMat = mat('#d4948c', 0.6);
    const hoofMat = mat('#26211d', 0.8);
    const hornMat = mat('#d2cbbd', 0.5);

    const body = makeBone('body');
    body.position.y = 0.85;
    root.add(body);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.44, 1.45, 12), brownMat);
    barrel.rotation.x = Math.PI / 2;
    body.add(barrel);

    const whitePatch = new THREE.Mesh(new THREE.SphereGeometry(0.46, 10, 10), whiteMat);
    whitePatch.position.set(0.12, -0.05, 0.15);
    whitePatch.scale.set(0.9, 0.8, 0.9);
    body.add(whitePatch);

    const udder = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), pinkMat);
    udder.position.set(0, -0.34, -0.28);
    body.add(udder);

    const tailBone = makeBone('tail');
    tailBone.position.set(0, 0.25, -0.72);
    body.add(tailBone);
    const tailMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.015, 0.55, 6), brownMat);
    tailMesh.position.y = -0.25;
    tailBone.add(tailMesh);
    const tailSwitch = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), skinMat);
    tailSwitch.position.y = -0.55;
    tailBone.add(tailSwitch);

    const neck = makeBone('neck');
    neck.position.set(0, 0.20, 0.65);
    body.add(neck);

    const head = makeBone('head');
    head.position.set(0, 0.25, 0.28);
    neck.add(head);

    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.30, 0.36), brownMat);
    head.add(headMesh);

    const blaze = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.22), whiteMat);
    blaze.position.set(0, 0.05, 0.185);
    head.add(blaze);

    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.20), skinMat);
    muzzle.position.set(0, -0.10, 0.22);
    head.add(muzzle);

    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), pinkMat);
    nostril.position.set(0, -0.10, 0.30);
    head.add(nostril);

    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 6), hornMat);
      horn.position.set(side * 0.18, 0.18, -0.05);
      horn.rotation.z = -side * 0.7;
      horn.rotation.x = -0.3;
      head.add(horn);
    }

    const legs = {};
    const legOffsets = {
      frontL: [-0.28, 0.52],
      frontR: [0.28, 0.52],
      hindL: [-0.26, -0.52],
      hindR: [0.26, -0.52]
    };

    for (const [name, [x, z]] of Object.entries(legOffsets)) {
      const hip = makeBone(name);
      hip.position.set(x, -0.20, z);
      body.add(hip);

      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.08, 0.36, 8), brownMat);
      upper.position.y = -0.18;
      hip.add(upper);

      const knee = makeBone(name + '_knee');
      knee.position.y = -0.36;
      hip.add(knee);

      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.34, 8), whiteMat);
      lower.position.y = -0.17;
      knee.add(lower);

      const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.11, 0.15), hoofMat);
      hoof.position.set(0, -0.32, 0.02);
      knee.add(hoof);

      legs[name] = {hip, knee};
    }

    function setPose(action, t) {
      body.position.set(0, 0.85, 0);
      body.rotation.set(0, 0, 0);
      neck.rotation.set(0, 0, 0);
      head.rotation.set(0, 0, 0);
      tailBone.rotation.set(0, 0, 0);
      for (const l of Object.values(legs)) {
        l.hip.rotation.set(0, 0, 0);
        l.knee.rotation.set(0, 0, 0);
      }

      if (action === 'idle') {
        const b = Math.sin(t * TAU);
        body.position.y = 0.85 + b * 0.005;
        tailBone.rotation.z = Math.sin(t * TAU * 2) * 0.25;
        head.rotation.y = Math.sin(t * TAU * 0.5) * 0.04;
      } else if (action === 'walk') {
        const p1 = Math.sin(t * TAU);
        body.position.y = 0.85 - Math.abs(p1) * 0.03;
        body.rotation.y = -p1 * 0.03;
        legs.frontL.hip.rotation.x = p1 * 0.35;
        legs.hindR.hip.rotation.x = p1 * 0.35;
        legs.frontR.hip.rotation.x = -p1 * 0.35;
        legs.hindL.hip.rotation.x = -p1 * 0.35;
        tailBone.rotation.z = p1 * 0.2;
      } else if (action === 'turn') {
        body.position.y = 0.85 + Math.sin(t * Math.PI) * 0.02;
        legs.frontL.hip.rotation.x = Math.sin(t * TAU) * 0.18;
        head.rotation.y = -t * 0.5;
      } else if (action === 'graze') {
        const chew = Math.sin(t * TAU * 3);
        neck.rotation.x = 0.85;
        head.rotation.x = -0.40;
        head.rotation.y = chew * 0.06;
        tailBone.rotation.z = Math.sin(t * TAU * 4) * 0.35;
      } else if (action === 'interact') {
        neck.rotation.x = -0.3;
        head.rotation.x = 0.25;
        body.position.y = 0.87;
      }
    }

    return {root, setPose, height: 1.40, type: 'animal'};
  }

  // -------------------------------------------------------------
  // 6. Brown Hen (hen-brown) - 0.40m Avian Biped
  // -------------------------------------------------------------
  function buildHen() {
    const root = new THREE.Group();
    root.name = 'Hen_Root';

    const redBrownMat = mat('#7c341b', 0.8);
    const darkBrownMat = mat('#5e2413', 0.85);
    const combMat = mat('#b52b22', 0.5);
    const beakMat = mat('#cca042', 0.4);
    const eyeMat = mat('#1a1a1a', 0.3);
    const legMat = mat('#bfa052', 0.7);

    const body = makeBone('body');
    body.position.y = 0.25;
    root.add(body);

    const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), redBrownMat);
    bodyMesh.scale.set(0.85, 0.95, 1.25);
    body.add(bodyMesh);

    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.13, 0.18), darkBrownMat);
      wing.position.set(side * 0.12, 0.02, -0.02);
      wing.rotation.x = 0.2;
      body.add(wing);
    }

    const tail = makeBone('tail');
    tail.position.set(0, 0.08, -0.15);
    body.add(tail);
    const tailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.08), darkBrownMat);
    tailMesh.rotation.x = -0.6;
    tail.add(tailMesh);

    const neck = makeBone('neck');
    neck.position.set(0, 0.08, 0.12);
    body.add(neck);

    const head = makeBone('head');
    head.position.set(0, 0.09, 0.04);
    neck.add(head);

    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), redBrownMat);
    head.add(headMesh);

    const combMesh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.09), combMat);
    combMesh.position.set(0, 0.065, 0.01);
    head.add(combMesh);

    const wattleMesh = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), combMat);
    wattleMesh.position.set(0, -0.04, 0.04);
    head.add(wattleMesh);

    const beakMesh = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 6), beakMat);
    beakMesh.rotation.x = Math.PI / 2;
    beakMesh.position.set(0, -0.01, 0.075);
    head.add(beakMesh);

    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), eyeMat);
      eye.position.set(side * 0.055, 0.01, 0.03);
      head.add(eye);
    }

    const legs = {};
    for (const [name, x] of [['legL', -0.055], ['legR', 0.055]]) {
      const hip = makeBone(name);
      hip.position.set(x, -0.08, -0.02);
      body.add(hip);

      const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.15, 6), legMat);
      shank.position.y = -0.075;
      hip.add(shank);

      const foot = makeBone(name + '_foot');
      foot.position.y = -0.15;
      hip.add(foot);

      const claws = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.015, 0.09), legMat);
      claws.position.set(0, 0, 0.02);
      foot.add(claws);

      legs[name] = {hip, foot};
    }

    function setPose(action, t) {
      body.position.set(0, 0.25, 0);
      body.rotation.set(0, 0, 0);
      neck.rotation.set(0, 0, 0);
      head.rotation.set(0, 0, 0);
      tail.rotation.set(0, 0, 0);
      legs.legL.hip.rotation.set(0, 0, 0);
      legs.legR.hip.rotation.set(0, 0, 0);

      if (action === 'idle') {
        const b = Math.sin(t * TAU);
        body.position.y = 0.25 + b * 0.003;
        head.rotation.x = b * 0.04;
        head.rotation.y = Math.sin(t * TAU * 0.5) * 0.08;
      } else if (action === 'walk') {
        const step = Math.sin(t * TAU);
        body.position.y = 0.25 - Math.abs(step) * 0.015;
        legs.legL.hip.rotation.x = step * 0.45;
        legs.legR.hip.rotation.x = -step * 0.45;
        neck.position.z = 0.12 + Math.max(0, Math.sin(t * TAU * 2)) * 0.03;
      } else if (action === 'turn') {
        body.position.y = 0.25 + Math.sin(t * Math.PI) * 0.01;
        legs.legL.hip.rotation.x = Math.sin(t * TAU) * 0.25;
        head.rotation.y = -t * 0.8;
      } else if (action === 'peck') {
        const peckCycle = Math.sin(t * TAU * 3);
        const dipping = peckCycle > 0.3;
        body.rotation.x = dipping ? 0.35 : 0;
        neck.rotation.x = dipping ? 0.85 : 0.1;
        head.rotation.x = dipping ? -0.4 : 0;
        tail.rotation.x = dipping ? 0.2 : 0;
      } else if (action === 'interact') {
        const flap = Math.sin(t * TAU * 4);
        body.position.y = 0.27 + Math.max(0, flap) * 0.03;
        neck.rotation.x = -0.2;
      }
    }

    return {root, setPose, height: 0.40, type: 'animal'};
  }

  return {
    'npc-farmer': buildMara,
    'npc-miller': buildBram,
    'npc-child-1': buildPip,
    'ewe-cream': buildEwe,
    'cow-brown-white': buildCow,
    'hen-brown': buildHen
  };
}
