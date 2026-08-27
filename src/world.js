import * as THREE from "three";
import {CreateBreachTool} from "./breach-tool.js";

function Box(Scene,Collision,CenterX,CenterY,CenterZ,Width,Height,Depth,Material,Type="Solid",Options={}){
  const Mesh = new THREE.Mesh(new THREE.BoxGeometry(Width,Height,Depth),Material);
  Mesh.position.set(CenterX,CenterY,CenterZ);
  Mesh.castShadow = Options.CastShadow !== false;
  Mesh.receiveShadow = true;
  Scene.add(Mesh);

  let Collider = null;
  if(Collision && Options.Collision !== false){
    Collider = Collision.AddBox(
      CenterX,
      CenterZ,
      Width,
      Depth,
      Type,
      {
        CameraBlock:Options.CameraBlock !== false,
        MinY:CenterY-Height/2,
        MaxY:CenterY+Height/2
      }
    );
  }

  return {Mesh,Collider};
}

export class BankWorld{
  constructor(Scene,Collision){
    this.Scene = Scene;
    this.Collision = Collision;
    this.Loot = [];
    this.GearPosition = new THREE.Vector3(-9,0,7);
    this.GearDisplay = null;
    this.VanPosition = new THREE.Vector3(7,0,20);
    this.PoliceSpawns = [
      new THREE.Vector3(-10,0,27),
      new THREE.Vector3(0,0,29),
      new THREE.Vector3(10,0,27),
      new THREE.Vector3(15,0,22)
    ];
    this.Build();
  }

  Build(){
    this.Scene.background = new THREE.Color(0x070a0e);
    this.Scene.fog = new THREE.FogExp2(0x070a0e,0.018);

    const Ambient = new THREE.HemisphereLight(0x9bb7d5,0x111419,1.1);
    this.Scene.add(Ambient);

    const Moon = new THREE.DirectionalLight(0xacc8ff,1.4);
    Moon.position.set(-12,22,18);
    Moon.castShadow = true;
    Moon.shadow.mapSize.set(2048,2048);
    this.Scene.add(Moon);

    const StreetMaterial = new THREE.MeshStandardMaterial({color:0x12161b,roughness:0.98});
    const BankFloorMaterial = new THREE.MeshStandardMaterial({color:0x34393d,roughness:0.75});
    const VaultFloorMaterial = new THREE.MeshStandardMaterial({color:0x252c32,roughness:0.55,metalness:0.18});
    const WallMaterial = new THREE.MeshStandardMaterial({color:0x5b6063,roughness:0.86});
    const TrimMaterial = new THREE.MeshStandardMaterial({color:0x242a2f,roughness:0.7});
    const CounterMaterial = new THREE.MeshStandardMaterial({color:0x504332,roughness:0.72});

    const Street = new THREE.Mesh(new THREE.PlaneGeometry(80,80),StreetMaterial);
    Street.rotation.x = -Math.PI/2;
    Street.receiveShadow = true;
    this.Scene.add(Street);

    const BankFloor = new THREE.Mesh(new THREE.PlaneGeometry(28,24),BankFloorMaterial);
    BankFloor.rotation.x = -Math.PI/2;
    BankFloor.position.z = 0;
    BankFloor.position.y = 0.01;
    BankFloor.receiveShadow = true;
    this.Scene.add(BankFloor);

    const VaultFloor = new THREE.Mesh(new THREE.PlaneGeometry(26,6),VaultFloorMaterial);
    VaultFloor.rotation.x = -Math.PI/2;
    VaultFloor.position.set(0,0.02,-9);
    this.Scene.add(VaultFloor);

    Box(this.Scene,this.Collision,-8.2,2.5,12,11.6,5,0.65,WallMaterial,"OuterWall");
    Box(this.Scene,this.Collision,8.2,2.5,12,11.6,5,0.65,WallMaterial,"OuterWall");
    Box(this.Scene,this.Collision,0,2.5,-12,28,5,0.65,WallMaterial,"OuterWall");
    Box(this.Scene,this.Collision,-14,2.5,0,0.65,5,24.6,WallMaterial,"OuterWall");
    Box(this.Scene,this.Collision,14,2.5,0,0.65,5,24.6,WallMaterial,"OuterWall");

    Box(this.Scene,this.Collision,-8.35,2.5,-6,11.3,5,0.55,TrimMaterial,"VaultWall");
    Box(this.Scene,this.Collision,8.35,2.5,-6,11.3,5,0.55,TrimMaterial,"VaultWall");

    Box(this.Scene,this.Collision,0,0.7,3.1,8.6,1.4,0.9,CounterMaterial,"Counter");
    Box(this.Scene,this.Collision,-8.8,0.55,0.5,3.8,1.1,1.1,CounterMaterial,"Desk");
    Box(this.Scene,this.Collision,8.8,0.55,0.5,3.8,1.1,1.1,CounterMaterial,"Desk");

    for(const X of [-8,-4,4,8]){
      const Light = new THREE.PointLight(0xffdca5,1.45,15,2);
      Light.position.set(X,4.4,4);
      this.Scene.add(Light);
    }

    const VaultLight = new THREE.PointLight(0xaecbff,1.6,18,2);
    VaultLight.position.set(0,4,-9);
    this.Scene.add(VaultLight);

    const GearMetal = new THREE.MeshStandardMaterial({color:0x171d21,roughness:0.62,metalness:0.48});
    const GearBacking = new THREE.MeshStandardMaterial({color:0x222c32,roughness:0.74,metalness:0.22});
    const GearGlow = new THREE.MeshStandardMaterial({
      color:0x66d4ff,
      emissive:0x1d7398,
      emissiveIntensity:1.8,
      roughness:0.3
    });

    Box(this.Scene,this.Collision,-11.7,1.55,7,0.7,3.1,4.4,GearBacking,"GearLocker");
    Box(this.Scene,this.Collision,-9,0.48,7,3.5,0.96,0.72,GearMetal,"GearBench");
    Box(this.Scene,null,-9,2.55,7,3.5,0.12,0.26,GearGlow,"Decor",{Collision:false});

    for(let Index=0;Index<3;Index+=1){
      const Rack = new THREE.Mesh(new THREE.BoxGeometry(0.13,1.1,0.18),GearGlow);
      Rack.position.set(-10+Index,1.55,6.72);
      this.Scene.add(Rack);
    }

    const GearLight = new THREE.PointLight(0x65d4ff,1.35,8,2);
    GearLight.position.set(-9,2.8,7.5);
    this.Scene.add(GearLight);

    this.GearDisplay = CreateBreachTool();
    this.GearDisplay.position.set(-9,1.15,7);
    this.GearDisplay.rotation.y = Math.PI/2;
    this.GearDisplay.scale.setScalar(1.35);
    this.Scene.add(this.GearDisplay);

    const Van = new THREE.Group();
    const VanBody = new THREE.Mesh(
      new THREE.BoxGeometry(4.4,1.9,2.2),
      new THREE.MeshStandardMaterial({color:0x243a4a,roughness:0.55,metalness:0.25})
    );
    VanBody.position.y = 1.2;
    VanBody.castShadow = true;
    Van.add(VanBody);

    const Cab = new THREE.Mesh(
      new THREE.BoxGeometry(1.6,1.5,2.05),
      new THREE.MeshStandardMaterial({color:0x304d62,roughness:0.5,metalness:0.25})
    );
    Cab.position.set(2.1,1.05,0);
    Van.add(Cab);

    for(const X of [-1.5,1.4]){
      for(const Z of [-1.05,1.05]){
        const Tire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.4,0.4,0.25,14),
          new THREE.MeshStandardMaterial({color:0x090a0b,roughness:1})
        );
        Tire.rotation.x = Math.PI/2;
        Tire.position.set(X,0.45,Z);
        Van.add(Tire);
      }
    }

    Van.position.copy(this.VanPosition);
    Van.rotation.y = Math.PI/2;
    this.Scene.add(Van);

    for(let Index=0;Index<5;Index+=1){
      const Bag = new THREE.Group();
      const Body = new THREE.Mesh(
        new THREE.BoxGeometry(0.58,0.72,0.34),
        new THREE.MeshStandardMaterial({color:0x2d3b31,roughness:0.95})
      );
      Body.position.y = 0.36;
      Body.castShadow = true;

      const Band = new THREE.Mesh(
        new THREE.BoxGeometry(0.62,0.1,0.38),
        new THREE.MeshStandardMaterial({color:0x8aa578,roughness:0.8})
      );
      Band.position.y = 0.42;
      Bag.add(Body,Band);
      Bag.position.set(-4+Index*2,0,-9.3+(Index%2)*0.8);
      Bag.userData.Collected = false;
      this.Scene.add(Bag);
      this.Loot.push(Bag);
    }

    const RoadStripe = new THREE.Mesh(
      new THREE.PlaneGeometry(40,0.18),
      new THREE.MeshBasicMaterial({color:0xd6c784})
    );
    RoadStripe.rotation.x = -Math.PI/2;
    RoadStripe.position.set(0,0.015,24);
    this.Scene.add(RoadStripe);
  }
}
