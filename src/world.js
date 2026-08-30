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
    this.GearPosition = new THREE.Vector3(-9.0,0,7.0);
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

  AddProp(Key,Options={}){
    const Root = this.Props.Create(Key,Options);
    this.Scene.add(Root);
    Root.updateWorldMatrix(true,true);

    if(this.Collision && Key !== "Doorway" && Options.Collision !== false){
      Root.userData.Collision = this.Collision.AddModel(
        Root,
        Options.CollisionType || "Prop:"+Key,
        {
          CameraBlock:Options.CameraBlock !== false,
          Id:Options.ColliderId
        }
      );
    }

    return Root;
  }

  async LoadModels(){
    await this.Props.Load();

    const ReceptionPositions = [-4.6,0,4.6];

    for(const X of ReceptionPositions){
      this.AddProp("ReceptionDesk",{
        Position:new THREE.Vector3(X,0,3.35),
        TargetWidth:3.0,
        RotationY:Math.PI,
        Tint:0x5f5045,
        TintStrength:0.08
      });

      this.AddProp("OfficeChair",{
        Position:new THREE.Vector3(X,0,1.85),
        TargetHeight:1.08,
        RotationY:0,
        Tint:0x2c3840,
        TintStrength:0.10
      });

      this.AddProp("Monitor",{
        Position:new THREE.Vector3(X,0.84,3.08),
        TargetHeight:0.55,
        RotationY:Math.PI,
        Collision:false,
        Tint:0x293036,
        TintStrength:0.06
      });

      this.AddProp("Laptop",{
        Position:new THREE.Vector3(X+0.55,0.83,3.34),
        TargetWidth:0.62,
        RotationY:Math.PI,
        Collision:false,
        Tint:0x31363b,
        TintStrength:0.05
      });
    }

    const WaitingAreas = [
      {
        Couch:new THREE.Vector3(-9.7,0,8.0),
        CouchRotation:Math.PI/2,
        Chair:new THREE.Vector3(-7.8,0,9.45),
        ChairRotation:Math.PI,
        Plant:new THREE.Vector3(-11.75,0,8.8),
        Lamp:new THREE.Vector3(-11.0,0,5.15)
      },
      {
        Couch:new THREE.Vector3(9.7,0,8.0),
        CouchRotation:-Math.PI/2,
        Chair:new THREE.Vector3(7.8,0,9.45),
        ChairRotation:Math.PI,
        Plant:new THREE.Vector3(11.75,0,8.8),
        Lamp:new THREE.Vector3(11.0,0,5.15)
      }
    ];

    for(const Area of WaitingAreas){
      this.AddProp("Couch",{
        Position:Area.Couch,
        TargetWidth:3.2,
        RotationY:Area.CouchRotation,
        Tint:0x46515a,
        TintStrength:0.07
      });

      this.AddProp("Armchair",{
        Position:Area.Chair,
        TargetHeight:1.12,
        RotationY:Area.ChairRotation,
        Tint:0x46515a,
        TintStrength:0.07
      });

      this.AddProp("Plant",{
        Position:Area.Plant,
        TargetHeight:1.45,
        Collision:false
      });

      this.AddProp("FloorLamp",{
        Position:Area.Lamp,
        TargetHeight:1.8,
        Collision:false,
        Tint:0x596268,
        TintStrength:0.05
      });
    }

    this.AddProp("Trash",{
      Position:new THREE.Vector3(11.75,0,4.7),
      TargetHeight:0.78,
      Collision:false
    });

    this.AddProp("Storage",{
      Position:new THREE.Vector3(-11.15,0,6.7),
      TargetHeight:2.15,
      RotationY:Math.PI/2,
      Tint:0x36434a,
      TintStrength:0.08
    });

    this.AddProp("Storage",{
      Position:new THREE.Vector3(-11.15,0,8.65),
      TargetHeight:2.15,
      RotationY:Math.PI/2,
      Tint:0x36434a,
      TintStrength:0.08
    });

    this.AddProp("ReceptionDesk",{
      Position:new THREE.Vector3(-9.0,0,7.0),
      TargetWidth:2.75,
      RotationY:0,
      Tint:0x37434a,
      TintStrength:0.08
    });

    this.GearDisplay = CreateBreachTool();
    this.GearDisplay.position.set(-9.0,1.02,7.0);
    this.GearDisplay.rotation.y = Math.PI/2;
    this.GearDisplay.scale.setScalar(1.15);
    this.Scene.add(this.GearDisplay);

    const GetawayCar = this.AddProp("GetawayCar",{
      Position:this.VanPosition.clone(),
      TargetWidth:4.8,
      TargetDepth:2.1,
      RotationY:Math.PI/2,
      Tint:0x263d4e,
      TintStrength:0.10
    });
    GetawayCar.userData.GetawayVehicle = true;

    const LootPositions = [
      [-4.2,-9.25],
      [-2.1,-8.65],
      [0,-9.35],
      [2.1,-8.65],
      [4.2,-9.25]
    ];

    for(const [X,Z] of LootPositions){
      const LootBox = this.AddProp("LootBox",{
        Position:new THREE.Vector3(X,0,Z),
        TargetWidth:0.82,
        Tint:0x4b6650,
        TintStrength:0.10
      });
      LootBox.userData.Collected = false;
      this.Loot.push(LootBox);
    }
  }
}
