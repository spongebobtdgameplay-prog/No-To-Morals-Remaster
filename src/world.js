import * as THREE from "three";
import {PropLibrary} from "./prop-assets.js?v=20260830-downtown2";

export class BankWorld{
  constructor(Scene,Collision){
    this.Scene = Scene;
    this.Collision = Collision;
    this.Props = new PropLibrary();
    this.Loot = [];
    this.GearPosition = new THREE.Vector3(-8,0,5.6);
    this.VaultDoorModel = null;
    this.EscapePosition = new THREE.Vector3(9,0,12.4);
    this.PoliceSpawns = [
      new THREE.Vector3(-10,0,23),
      new THREE.Vector3(-3,0,24),
      new THREE.Vector3(5,0,24),
      new THREE.Vector3(12,0,23)
    ];

    this.BuildLighting();
  }

  BuildLighting(){
    this.Scene.background = new THREE.Color(0x0b1016);
    this.Scene.fog = new THREE.FogExp2(0x0b1016,0.01);

    const Ambient = new THREE.HemisphereLight(0xc8d8e8,0x20242a,1.7);
    this.Scene.add(Ambient);

    const Moon = new THREE.DirectionalLight(0xd7e4ff,2.0);
    Moon.position.set(-14,24,18);
    Moon.castShadow = true;
    Moon.shadow.mapSize.set(2048,2048);
    Moon.shadow.camera.left = -34;
    Moon.shadow.camera.right = 34;
    Moon.shadow.camera.top = 34;
    Moon.shadow.camera.bottom = -34;
    this.Scene.add(Moon);

    for(const X of [-7,0,7]){
      const LobbyLight = new THREE.PointLight(0xffdfae,1.7,13,2);
      LobbyLight.position.set(X,2.7,3);
      this.Scene.add(LobbyLight);
    }

    const VaultLight = new THREE.PointLight(0xc5dcff,1.65,12,2);
    VaultLight.position.set(0,2.7,-7);
    this.Scene.add(VaultLight);

    const GearLight = new THREE.PointLight(0x64d6ff,1.0,5.5,2);
    GearLight.position.set(this.GearPosition.x,1.9,this.GearPosition.z);
    this.Scene.add(GearLight);

    const EscapeLight = new THREE.PointLight(0x77ffc8,0.9,5.5,2);
    EscapeLight.position.set(this.EscapePosition.x,1.9,this.EscapePosition.z);
    this.Scene.add(EscapeLight);
  }

  AddProp(Key,Options={}){
    const Root = this.Props.Create(Key,Options);
    this.Scene.add(Root);
    Root.updateWorldMatrix(true,true);

    if(this.Collision && Options.Collision === true){
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

  AddWallCollider(CenterX,CenterZ,Width,Depth,Type){
    return this.Collision.AddBox(
      CenterX,
      CenterZ,
      Width,
      Depth,
      Type,
      {
        MinY:0,
        MaxY:3.05,
        CameraBlock:true
      }
    );
  }

  AddPlainWallModule(X,Y,Z,RotationY=0){
    return this.AddProp("BrickPlain",{
      Position:new THREE.Vector3(X,Y,Z),
      RotationY,
      Collision:false
    });
  }

  AddPlainWallStack(X,Z,RotationY=0){
    for(const Y of [0,1,2]){
      this.AddPlainWallModule(X,Y,Z,RotationY);
    }
  }

  BuildFloor(){
    for(let X=-10;X<=10;X+=4){
      for(let Z=-8;Z<=8;Z+=4){
        this.AddProp("FloorTile",{
          Position:new THREE.Vector3(X,-0.1,Z),
          Collision:false,
          CastShadow:false
        });
      }
    }
  }

  BuildFrontFacade(){
    for(const X of [-9,-5,5,9]){
      this.AddProp("BrickWindow",{
        Position:new THREE.Vector3(X,0,10),
        Collision:false
      });
    }

    this.AddPlainWallStack(-2,10);
    this.AddPlainWallStack(2,10);

    this.AddProp("DoorFrame",{
      Position:new THREE.Vector3(0,0,10),
      Collision:false
    });

    this.AddWallCollider(-6,10,10,0.32,"OuterWall");
    this.AddWallCollider(6,10,10,0.32,"OuterWall");
  }

  BuildBackFacade(){
    for(let X=-10;X<=10;X+=2){
      this.AddPlainWallStack(X,-10,Math.PI);
    }

    this.AddWallCollider(0,-10,22,0.32,"OuterWall");
  }

  BuildSideFacades(){
    for(const Side of [-1,1]){
      const X = Side*11;
      const RotationY = Side > 0 ? -Math.PI/2 : Math.PI/2;

      for(const Z of [-9,-7,-5,-3,-1,1,3,5,7,9]){
        this.AddProp("BrickWindowTrim",{
          Position:new THREE.Vector3(X,0,Z),
          RotationY,
          Collision:false
        });
      }

      this.AddWallCollider(X,0,0.32,20,"OuterWall");
    }
  }

  BuildVaultPartition(){
    for(const X of [-10,-8,-6,-4,-2,2,4,6,8,10]){
      this.AddPlainWallStack(X,-4);
    }

    this.VaultDoorModel = this.AddProp("MetalWindow",{
      Position:new THREE.Vector3(0,0,-4),
      Collision:false
    });

    this.AddWallCollider(-6.5,-4,9,0.32,"VaultWall");
    this.AddWallCollider(6.5,-4,9,0.32,"VaultWall");
  }

  BuildTellerArea(){
    for(const X of [-6,-4,-2,2,4,6]){
      this.AddPlainWallModule(X,0,2);
    }

    this.Collision.AddBox(
      -4,
      2,
      6,
      0.32,
      "Counter",
      {
        MinY:0,
        MaxY:1.02,
        CameraBlock:true
      }
    );

    this.Collision.AddBox(
      4,
      2,
      6,
      0.32,
      "Counter",
      {
        MinY:0,
        MaxY:1.02,
        CameraBlock:true
      }
    );

    for(const X of [-6,-2,2,6]){
      this.AddProp("MetalWindow",{
        Position:new THREE.Vector3(X,0,1.78),
        Collision:false
      });
    }
  }

  BuildStreet(){
    for(const X of [-18,-6,6,18]){
      this.AddProp("Street2Lane",{
        Position:new THREE.Vector3(X,-0.15,16.7),
        RotationY:Math.PI/2,
        Collision:false,
        CastShadow:false
      });
    }

    for(const X of [-10,-6,-2,2,6,10]){
      this.AddProp("FloorTile",{
        Position:new THREE.Vector3(X,-0.1,12),
        Collision:false,
        CastShadow:false
      });
    }

    this.AddProp("EntranceStairs",{
      Position:new THREE.Vector3(0,0,10.15),
      Collision:true,
      CollisionType:"EntranceStairs"
    });

    for(const X of [-2.7,2.7]){
      this.AddProp("Bollard",{
        Position:new THREE.Vector3(X,0,12.45),
        Collision:false
      });
    }

    for(const X of [-8.3,8.3]){
      this.AddProp("Planter",{
        Position:new THREE.Vector3(X,0,12),
        Collision:true,
        CollisionType:"Planter"
      });
    }

    this.AddProp("Manhole",{
      Position:new THREE.Vector3(5.5,0.01,16.7),
      Collision:false,
      CastShadow:false
    });

    this.AddProp("BuildingLarge",{
      Position:new THREE.Vector3(-23,0,39),
      RotationY:Math.PI,
      Collision:false
    });

    this.AddProp("BuildingMedium",{
      Position:new THREE.Vector3(-4,0,38),
      RotationY:Math.PI,
      Collision:false
    });

    this.AddProp("BuildingSmall",{
      Position:new THREE.Vector3(12,0,37),
      RotationY:Math.PI,
      Collision:false
    });

    this.AddProp("BuildingMedium",{
      Position:new THREE.Vector3(28,0,39),
      RotationY:Math.PI,
      Collision:false
    });

    for(const X of [7.8,10.2]){
      this.AddProp("Bollard",{
        Position:new THREE.Vector3(X,0,12.45),
        Collision:false
      });
    }
  }

  BuildLobbyDetails(){
    this.AddProp("Planter",{
      Position:new THREE.Vector3(-8,0,6.8),
      Collision:true,
      CollisionType:"LobbyPlanter"
    });

    this.AddProp("Planter",{
      Position:new THREE.Vector3(8,0,6.8),
      Collision:true,
      CollisionType:"LobbyPlanter"
    });

    this.AddProp("Bollard",{
      Position:new THREE.Vector3(this.GearPosition.x,0,this.GearPosition.z),
      Collision:false
    });
  }

  BuildLoot(){
    const LootPositions = [
      [-6,-7.6],
      [-3,-7.2],
      [0,-7.8],
      [3,-7.2],
      [6,-7.6]
    ];

    for(const [X,Z] of LootPositions){
      const Loot = this.AddProp("LootBox",{
        Position:new THREE.Vector3(X,0,Z),
        TargetWidth:0.85,
        Collision:true,
        CollisionType:"Loot"
      });

      Loot.userData.Collected = false;
      this.Loot.push(Loot);
    }
  }

  async LoadModels(){
    await this.Props.Load();

    this.BuildFloor();
    this.BuildFrontFacade();
    this.BuildBackFacade();
    this.BuildSideFacades();
    this.BuildVaultPartition();
    this.BuildTellerArea();
    this.BuildStreet();
    this.BuildLobbyDetails();
    this.BuildLoot();
  }
}
