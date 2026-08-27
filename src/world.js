import * as THREE from "three";
import {CreateBreachTool} from "./breach-tool.js";
import {PropLibrary} from "./prop-assets.js";

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
    this.Props = new PropLibrary();
    this.Loot = [];
    this.GearPosition = new THREE.Vector3(-9.2,0,7.05);
    this.GearDisplay = null;
    this.VanPosition = new THREE.Vector3(7,0,20);
    this.PoliceSpawns = [
      new THREE.Vector3(-10,0,27),
      new THREE.Vector3(0,0,29),
      new THREE.Vector3(10,0,27),
      new THREE.Vector3(15,0,22)
    ];
    this.BuildStructure();
  }

  BuildStructure(){
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

    const Street = new THREE.Mesh(new THREE.PlaneGeometry(80,80),StreetMaterial);
    Street.rotation.x = -Math.PI/2;
    Street.receiveShadow = true;
    this.Scene.add(Street);

    const BankFloor = new THREE.Mesh(new THREE.PlaneGeometry(28,24),BankFloorMaterial);
    BankFloor.rotation.x = -Math.PI/2;
    BankFloor.position.y = 0.01;
    BankFloor.receiveShadow = true;
    this.Scene.add(BankFloor);

    const VaultFloor = new THREE.Mesh(new THREE.PlaneGeometry(26,6),VaultFloorMaterial);
    VaultFloor.rotation.x = -Math.PI/2;
    VaultFloor.position.set(0,0.02,-9);
    VaultFloor.receiveShadow = true;
    this.Scene.add(VaultFloor);

    Box(this.Scene,this.Collision,-8.2,2.5,12,11.6,5,0.65,WallMaterial,"OuterWall");
    Box(this.Scene,this.Collision,8.2,2.5,12,11.6,5,0.65,WallMaterial,"OuterWall");
    Box(this.Scene,this.Collision,0,2.5,-12,28,5,0.65,WallMaterial,"OuterWall");
    Box(this.Scene,this.Collision,-14,2.5,0,0.65,5,24.6,WallMaterial,"OuterWall");
    Box(this.Scene,this.Collision,14,2.5,0,0.65,5,24.6,WallMaterial,"OuterWall");
    Box(this.Scene,this.Collision,-8.35,2.5,-6,11.3,5,0.55,TrimMaterial,"VaultWall");
    Box(this.Scene,this.Collision,8.35,2.5,-6,11.3,5,0.55,TrimMaterial,"VaultWall");

    for(const X of [-8,-4,4,8]){
      const Light = new THREE.PointLight(0xffdca5,1.45,15,2);
      Light.position.set(X,4.4,4);
      this.Scene.add(Light);
    }

    const VaultLight = new THREE.PointLight(0xaecbff,1.6,18,2);
    VaultLight.position.set(0,4,-9);
    this.Scene.add(VaultLight);

    const GearLight = new THREE.PointLight(0x65d4ff,1.35,9,2);
    GearLight.position.set(-9,2.8,7.5);
    this.Scene.add(GearLight);

    const RoadStripe = new THREE.Mesh(
      new THREE.PlaneGeometry(40,0.18),
      new THREE.MeshBasicMaterial({color:0xd6c784})
    );
    RoadStripe.rotation.x = -Math.PI/2;
    RoadStripe.position.set(0,0.015,24);
    this.Scene.add(RoadStripe);
  }

  AddProp(Key,Options){
    const Root = this.Props.Create(Key,Options);
    this.Scene.add(Root);
    return Root;
  }

  AddCollider(X,Z,Width,Depth,Height,Type){
    return this.Collision.AddBox(X,Z,Width,Depth,Type,{
      MinY:0,
      MaxY:Height
    });
  }

  async LoadModels(){
    await this.Props.Load();

    this.AddProp("Doorway",{
      Position:new THREE.Vector3(0,0,11.72),
      TargetHeight:3.1,
      Tint:0x555b5f
    });

    for(const X of [-5.4,-1.8,1.8,5.4]){
      this.AddProp("Desk",{
        Position:new THREE.Vector3(X,0,3.15),
        TargetWidth:2.7,
        RotationY:Math.PI,
        Tint:0x54483c
      });
      this.AddCollider(X,3.15,2.55,1.05,0.9,"Counter");

      this.AddProp("Monitor",{
        Position:new THREE.Vector3(X,0.86,3.02),
        TargetHeight:0.52,
        RotationY:Math.PI,
        Tint:0x293238
      });

      this.AddProp("Keyboard",{
        Position:new THREE.Vector3(X,0.84,3.34),
        TargetWidth:0.55,
        RotationY:Math.PI,
        Tint:0x24282b
      });

      this.AddProp("ChairDesk",{
        Position:new THREE.Vector3(X,0,1.82),
        TargetHeight:1.05,
        Tint:0x32383d
      });
    }

    for(const Side of [-1,1]){
      const X = Side*9.15;

      this.AddProp("Desk",{
        Position:new THREE.Vector3(X,0,0.25),
        TargetWidth:2.6,
        RotationY:Side>0 ? -Math.PI/2 : Math.PI/2,
        Tint:0x4a4037
      });
      this.AddCollider(X,0.25,1.1,2.5,0.9,"Desk");

      this.AddProp("ChairDesk",{
        Position:new THREE.Vector3(X-Side*1.15,0,0.25),
        TargetHeight:1.05,
        RotationY:Side>0 ? Math.PI/2 : -Math.PI/2,
        Tint:0x30363a
      });

      this.AddProp("Plant",{
        Position:new THREE.Vector3(Side*11.6,0,8.2),
        TargetHeight:1.25
      });
    }

    this.AddProp("Bench",{
      Position:new THREE.Vector3(-5.7,0,8.1),
      TargetWidth:2.5,
      RotationY:Math.PI/2,
      Tint:0x3b4145
    });
    this.AddCollider(-5.7,8.1,0.85,2.35,0.75,"Bench");

    this.AddProp("Bench",{
      Position:new THREE.Vector3(5.7,0,8.1),
      TargetWidth:2.5,
      RotationY:-Math.PI/2,
      Tint:0x3b4145
    });
    this.AddCollider(5.7,8.1,0.85,2.35,0.75,"Bench");

    this.AddProp("Trashcan",{
      Position:new THREE.Vector3(10.7,0,5.2),
      TargetHeight:0.72,
      Tint:0x32383c
    });

    this.AddProp("Locker",{
      Position:new THREE.Vector3(-11.05,0,7.05),
      TargetHeight:2.15,
      RotationY:Math.PI/2,
      Tint:0x27333a
    });
    this.AddCollider(-11.05,7.05,0.62,1.25,2.15,"GearLocker");

    this.AddProp("Locker",{
      Position:new THREE.Vector3(-7.35,0,7.05),
      TargetHeight:2.15,
      RotationY:-Math.PI/2,
      Tint:0x27333a
    });
    this.AddCollider(-7.35,7.05,0.62,1.25,2.15,"GearLocker");

    this.AddProp("Desk",{
      Position:new THREE.Vector3(-9.2,0,7.05),
      TargetWidth:2.8,
      Tint:0x253139
    });
    this.AddCollider(-9.2,7.05,2.55,1.05,0.9,"GearBench");

    this.GearDisplay = CreateBreachTool();
    this.GearDisplay.position.set(-9.2,1.02,7.05);
    this.GearDisplay.rotation.y = Math.PI/2;
    this.GearDisplay.scale.setScalar(1.35);
    this.Scene.add(this.GearDisplay);

    const Van = this.AddProp("Van",{
      Position:this.VanPosition.clone(),
      TargetWidth:4.6,
      RotationY:Math.PI/2,
      Tint:0x244355
    });
    Van.userData.GetawayVehicle = true;

    const LootPositions = [
      [-4.2,-9.25],
      [-2.1,-8.65],
      [0,-9.35],
      [2.1,-8.65],
      [4.2,-9.25]
    ];

    for(const [X,Z] of LootPositions){
      const Lockbox = this.AddProp("Lockbox",{
        Position:new THREE.Vector3(X,0,Z),
        TargetWidth:0.72,
        Tint:0x445848
      });
      Lockbox.userData.Collected = false;
      this.Loot.push(Lockbox);
    }
  }
}
