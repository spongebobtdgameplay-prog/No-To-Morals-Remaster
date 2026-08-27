import * as THREE from "three";

export function CreateBreachTool(){
  const Root = new THREE.Group();
  Root.name = "BreachTool";

  const Shell = new THREE.MeshStandardMaterial({
    color:0x202a30,
    roughness:0.48,
    metalness:0.52
  });
  const Dark = new THREE.MeshStandardMaterial({
    color:0x0d1114,
    roughness:0.7,
    metalness:0.28
  });
  const Emitter = new THREE.MeshStandardMaterial({
    color:0x7bd9ff,
    emissive:0x1f88b8,
    emissiveIntensity:2.2,
    roughness:0.25,
    metalness:0.3
  });

  const Body = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.2,0.5),Shell);
  Body.position.z = 0.04;
  Body.castShadow = true;
  Root.add(Body);

  const Grip = new THREE.Mesh(new THREE.BoxGeometry(0.12,0.28,0.14),Dark);
  Grip.position.set(0,-0.2,-0.06);
  Grip.rotation.x = -0.16;
  Grip.castShadow = true;
  Root.add(Grip);

  const EmitterCore = new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.075,0.22,16),Emitter);
  EmitterCore.rotation.x = Math.PI/2;
  EmitterCore.position.z = 0.38;
  Root.add(EmitterCore);

  const Ring = new THREE.Mesh(new THREE.TorusGeometry(0.115,0.025,8,20),Emitter);
  Ring.position.z = 0.5;
  Root.add(Ring);

  const Battery = new THREE.Mesh(new THREE.BoxGeometry(0.19,0.11,0.18),Dark);
  Battery.position.set(0,0.14,-0.1);
  Root.add(Battery);

  const Rail = new THREE.Mesh(new THREE.BoxGeometry(0.16,0.04,0.34),Emitter);
  Rail.position.set(0,0.12,0.12);
  Root.add(Rail);

  Root.traverse(Object=>{
    if(Object.isMesh){
      Object.castShadow = true;
      Object.receiveShadow = true;
    }
  });

  return Root;
}
