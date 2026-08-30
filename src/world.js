import * as THREE from "three";
import {PropLibrary} from "./prop-assets.js?v=20260830-realworld1";

export class BankWorld{
  constructor(Scene,Collision){
    this.Scene = Scene;
    this.Collision = Collision;
    this.Props = new PropLibrary();
    this.Loot = [];
    this.GearPosition = new THREE.Vector3(-9,0,7);
    this.GearDisplay = null;
    this.VaultDoorModel = null;
    this.EscapePosition = new THREE.Vector3(12,0,22);
    this.PoliceSpawns = [
      new THREE.Vector3(-11,0,28),
      new THREE.Vector3(-3,0,29),
      new THREE.Vector3(6,0,29),
      new THREE.Vector3(15,0,26)
    ];

    this.BuildLighting();
  }

  BuildLighting(){
    this.Scene.background = new THREE.Color(0x070a0e);
    this.Scene.fog = new THREE.FogExp2(0x070a0e,0.012);

    const Ambient = new THREE.HemisphereLight(0xb9cee3,0x16181c,1.55);
    this.Scene.add(Ambient);

    const Moon = new THREE.DirectionalLight(0xc9dcff,1.85);
    Moon.position.set(-14,24,20);
    Moon.castShadow = true;
    Moon.shadow.mapSize.set(2048,2048);
    Moon.shadow.camera.left = -28;
    Moon.shadow.camera.right = 28;
    Moon.shadow.camera.top = 28;
    Moon.shadow.camera.bottom = -28;
    this.Scene.add(Moon);

    for(const X of [-9,-3,3,9]){
      const InteriorLight = new THREE.PointLight(0xffe1b5,1.6,15,2);
      InteriorLight.position.set(X,4.1,4);
      this.Scene.add(InteriorLight);
    }

    const VaultLight = new THREE.PointLight(0xb9d8ff,1.8,18,2);
    VaultLight.position.set(0,3.8,-9);
    this.Scene.add(VaultLight);

    const GearLight = new THREE.PointLight(0x65d4ff,1.15,8,2);
    GearLight.position.set(-9,2.5,7);
    this.Scene.add(GearLight);
  }

  AddProp(Key,Options={}){
    const Root = this.Props.Create(Key,Options);
    this.Scene.add(Root);
    Root.updateWorldMatrix(true,true);

    if(this.Collision && Options.Collision !== false){
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

  CreateBreachGear(){
    return this.Props.Create("BreachGear",{
      TargetWidth:0.34,
      Tint:0x303942,
      TintStrength:0.12
    });
  }

  BuildBankFloor(){
    for(let X=-12;X<=12;X+=4){
      for(let Z=-10;Z<=10;Z+=4){
        this.AddProp("BankFloor",{
          Position:new THREE.Vector3(X,0,Z),
          TargetWidth:4,
          TargetDepth:4,
          Collision:false,
          CastShadow:false,
          Tint:0x555b60,
          TintStrength:0.12
        });
      }
    }
  }

  BuildFrontWall(){
    for(let X=-12;X<=12;X+=2){
      let Key = "BankWall";

      if(X === 0) Key = "BankDoorWall";
      else if(Math.abs(X) === 4 || Math.abs(X) === 8) Key = "BankWindowWall";

      this.AddProp(Key,{
        Position:new THREE.Vector3(X,0,12),
        TargetWidth:2,
        CollisionType:"OuterWall"
      });
    }
  }

  BuildBackWall(){
    for(let X=-12;X<=12;X+=2){
      this.AddProp("BankWall",{
        Position:new THREE.Vector3(X,0,-12),
        TargetWidth:2,
        RotationY:Math.PI,
        CollisionType:"OuterWall"
      });
    }
  }

  BuildSideWalls(){
    for(const Side of [-1,1]){
      const X = Side*14;
      const RotationY = Side > 0 ? -Math.PI/2 : Math.PI/2;

      for(let Z=-10;Z<=10;Z+=2){
        const Key = Z === 4 || Z === -4 ? "BankWindowWall" : "BankWall";

        this.AddProp(Key,{
          Position:new THREE.Vector3(X,0,Z),
          TargetWidth:2,
          RotationY,
          CollisionType:"OuterWall"
        });
      }
    }
  }

  BuildVaultPartition(){
    for(const X of [-12,-10,-8,-6,-4,4,6,8,10,12]){
      this.AddProp("BankWall",{
        Position:new THREE.Vector3(X,0,-6),
        TargetWidth:2,
        CollisionType:"VaultWall",
        Tint:0x4a4f54,
        TintStrength:0.08
      });
    }

    this.VaultDoorModel = this.AddProp("VaultDoor",{
      Position:new THREE.Vector3(0,0,-5.72),
      TargetWidth:5,
      TargetHeight:4.3,
      Collision:false,
      Tint:0x3f474e,
      TintStrength:0.08
    });
  }

  BuildStreet(){
    const RoadXs = [-12,-4,4,12];

    for(const X of RoadXs){
      this.AddProp("RoadStraight",{
        Position:new THREE.Vector3(X,0,20),
        TargetWidth:8,
        TargetDepth:8,
        Collision:false,
        CastShadow:false
      });
    }

    this.AddProp("RoadCrossing",{
      Position:new THREE.Vector3(0,0,28),
      TargetWidth:8,
      TargetDepth:8,
      Collision:false,
      CastShadow:false
    });

    const Buildings = [
      ["CityBuildingA",new THREE.Vector3(-18,0,29),9.5,Math.PI],
      ["CityBuildingB",new THREE.Vector3(-8,0,32),10.5,Math.PI],
      ["CityBuildingC",new THREE.Vector3(6,0,32),9.2,Math.PI],
      ["CityBuildingB",new THREE.Vector3(18,0,29),11.0,Math.PI]
    ];

    for(const [Key,Position,Height,RotationY] of Buildings){
      this.AddProp(Key,{
        Position,
        TargetHeight:Height,
        RotationY,
        Collision:false,
        Tint:0x606b73,
        TintStrength:0.05
      });
    }

    for(const X of [-11,-5,5,11]){
      this.AddProp("Streetlight",{
        Position:new THREE.Vector3(X,0,15.8),
        TargetHeight:4.4,
        RotationY:X < 0 ? Math.PI : 0,
        Collision:false
      });
    }

    this.AddProp("Dumpster",{
      Position:new THREE.Vector3(12.8,0,23.2),
      TargetWidth:1.7,
      RotationY:-Math.PI/2,
      Tint:0x31463b,
      TintStrength:0.08
    });

    this.AddProp("Hydrant",{
      Position:new THREE.Vector3(6.4,0,15.6),
      TargetHeight:0.72,
      Collision:false
    });
  }

  BuildLobby(){
    for(const X of [-5,0,5]){
      this.AddProp("ReceptionDesk",{
        Position:new THREE.Vector3(X,0,3.2),
        TargetWidth:3.1,
        RotationY:Math.PI,
        Tint:0x5e5148,
        TintStrength:0.06
      });

      this.AddProp("OfficeChair",{
        Position:new THREE.Vector3(X,0,1.65),
        TargetHeight:1.08,
        Tint:0x303940,
        TintStrength:0.08
      });

      this.AddProp("Monitor",{
        Position:new THREE.Vector3(X,0.84,2.95),
        TargetHeight:0.54,
        RotationY:Math.PI,
        Collision:false
      });

      this.AddProp("Laptop",{
        Position:new THREE.Vector3(X+0.62,0.84,3.25),
        TargetWidth:0.58,
        RotationY:Math.PI,
        Collision:false
      });
    }

    this.AddProp("Couch",{
      Position:new THREE.Vector3(-10.2,0,8.0),
      TargetWidth:3.1,
      RotationY:Math.PI/2,
      Tint:0x49545b,
      TintStrength:0.06
    });

    this.AddProp("Couch",{
      Position:new THREE.Vector3(10.2,0,8.0),
      TargetWidth:3.1,
      RotationY:-Math.PI/2,
      Tint:0x49545b,
      TintStrength:0.06
    });

    this.AddProp("Armchair",{
      Position:new THREE.Vector3(-8.1,0,9.55),
      TargetHeight:1.08,
      RotationY:Math.PI
    });

    this.AddProp("Armchair",{
      Position:new THREE.Vector3(8.1,0,9.55),
      TargetHeight:1.08,
      RotationY:Math.PI
    });

    this.AddProp("Plant",{
      Position:new THREE.Vector3(-11.8,0,9.1),
      TargetHeight:1.45,
      Collision:false
    });

    this.AddProp("Plant",{
      Position:new THREE.Vector3(11.8,0,9.1),
      TargetHeight:1.45,
      Collision:false
    });

    this.AddProp("FloorLamp",{
      Position:new THREE.Vector3(-11.2,0,5.2),
      TargetHeight:1.8,
      Collision:false
    });

    this.AddProp("FloorLamp",{
      Position:new THREE.Vector3(11.2,0,5.2),
      TargetHeight:1.8,
      Collision:false
    });

    this.AddProp("Storage",{
      Position:new THREE.Vector3(-11.2,0,6.6),
      TargetHeight:2.1,
      RotationY:Math.PI/2
    });

    this.AddProp("Storage",{
      Position:new THREE.Vector3(-11.2,0,8.5),
      TargetHeight:2.1,
      RotationY:Math.PI/2
    });

    this.AddProp("Trash",{
      Position:new THREE.Vector3(11.6,0,4.8),
      TargetHeight:0.75,
      Collision:false
    });
  }

  BuildGearStation(){
    this.AddProp("ReceptionDesk",{
      Position:this.GearPosition.clone(),
      TargetWidth:2.7,
      RotationY:0,
      Tint:0x37434a,
      TintStrength:0.08
    });

    this.GearDisplay = this.AddProp("BreachGear",{
      Position:new THREE.Vector3(this.GearPosition.x,0.98,this.GearPosition.z),
      TargetWidth:0.42,
      RotationY:Math.PI/2,
      Collision:false,
      Tint:0x303942,
      TintStrength:0.12
    });
  }

  BuildLoot(){
    const LootPositions = [
      [-4.2,-9.3],
      [-2.1,-8.7],
      [0,-9.35],
      [2.1,-8.7],
      [4.2,-9.3]
    ];

    for(const [X,Z] of LootPositions){
      const LootBox = this.AddProp("LootBox",{
        Position:new THREE.Vector3(X,0,Z),
        TargetWidth:0.82,
        Tint:0x4b6650,
        TintStrength:0.08
      });

      LootBox.userData.Collected = false;
      this.Loot.push(LootBox);
    }
  }

  async LoadModels(){
    await this.Props.Load();

    this.BuildBankFloor();
    this.BuildFrontWall();
    this.BuildBackWall();
    this.BuildSideWalls();
    this.BuildVaultPartition();
    this.BuildStreet();
    this.BuildLobby();
    this.BuildGearStation();
    this.BuildLoot();
  }
}
