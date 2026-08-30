import * as THREE from "three";
import {PropLibrary} from "./prop-assets.js?v=20260830-repair3";

export class BankWorld{
  constructor(Scene,Collision){
    this.Scene = Scene;
    this.Collision = Collision;
    this.Props = new PropLibrary();
    this.Loot = [];
    this.PropRoots = [];
    this.GearPosition = new THREE.Vector3(-8,0,5.6);
    this.GearDisplay = null;
    this.VaultDoorModel = null;
    this.EscapePosition = new THREE.Vector3(9,0,12.4);
    this.PoliceSpawns = [
      new THREE.Vector3(-9,0,18),
      new THREE.Vector3(-3,0,18.5),
      new THREE.Vector3(4,0,18.5),
      new THREE.Vector3(10,0,18)
    ];

    this.BuildLighting();
  }

  BuildLighting(){
    this.Scene.background = new THREE.Color(0x111820);
    this.Scene.fog = new THREE.FogExp2(0x111820,0.0075);

    const Ambient = new THREE.AmbientLight(0xffffff,0.72);
    this.Scene.add(Ambient);

    const Sky = new THREE.HemisphereLight(0xd9e8f7,0x33383f,1.65);
    this.Scene.add(Sky);

    const Moon = new THREE.DirectionalLight(0xd7e4ff,1.75);
    Moon.position.set(-12,20,15);
    Moon.castShadow = true;
    Moon.shadow.mapSize.set(2048,2048);
    Moon.shadow.camera.left = -36;
    Moon.shadow.camera.right = 36;
    Moon.shadow.camera.top = 36;
    Moon.shadow.camera.bottom = -36;
    this.Scene.add(Moon);

    for(const X of [-8,-4,0,4,8]){
      const LobbyLight = new THREE.PointLight(0xffe0b0,1.55,10,2);
      LobbyLight.position.set(X,2.45,4);
      this.Scene.add(LobbyLight);
    }

    for(const X of [-7,0,7]){
      const VaultLight = new THREE.PointLight(0xc9ddff,1.3,9,2);
      VaultLight.position.set(X,2.4,-7);
      this.Scene.add(VaultLight);
    }

    const GearLight = new THREE.PointLight(0x5dd6ff,1.15,5,2);
    GearLight.position.set(this.GearPosition.x,1.4,this.GearPosition.z);
    this.Scene.add(GearLight);

    const EscapeLight = new THREE.PointLight(0x70ffc8,0.9,5,2);
    EscapeLight.position.set(this.EscapePosition.x,1.6,this.EscapePosition.z);
    this.Scene.add(EscapeLight);
  }

  AddProp(Key,Options={}){
    const Root = this.Props.Create(Key,Options);
    this.Scene.add(Root);
    Root.updateWorldMatrix(true,true);
    this.PropRoots.push(Root);

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

  AddWallCollider(CenterX,CenterZ,Width,Depth,Type,MinY=0,MaxY=3.08){
    return this.Collision.AddBox(
      CenterX,
      CenterZ,
      Width,
      Depth,
      Type,
      {
        MinY,
        MaxY,
        CameraBlock:true
      }
    );
  }

  AddPlainWallModule(X,Y,Z,RotationY=0){
    return this.AddProp("BrickPlain",{
      Position:new THREE.Vector3(X,Y,Z),
      RotationY,
      Collision:true
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
          Collision:true,
          CastShadow:false
        });
      }
    }
  }

  BuildCeiling(){
    for(let X=-10;X<=10;X+=4){
      for(let Z=-8;Z<=8;Z+=4){
        this.AddProp("FloorTile",{
          Position:new THREE.Vector3(X,3.08,Z),
          RotationX:Math.PI,
          Collision:true,
          CastShadow:false
        });
      }
    }

    this.Collision.AddBox(
      0,
      0,
      22,
      20,
      "Ceiling",
      {
        MinY:3.0,
        MaxY:3.18,
        CameraBlock:true
      }
    );
  }

  BuildFrontFacade(){
    for(const X of [-9,-5,5,9]){
      this.AddProp("BrickWindow",{
        Position:new THREE.Vector3(X,0,10),
        Collision:true
      });
    }

    this.AddPlainWallStack(-2,10);
    this.AddPlainWallStack(2,10);

    this.AddProp("DoorFrame",{
      Position:new THREE.Vector3(0,0,9.72),
      Collision:true
    });

    this.AddPlainWallStack(-1.15,10.85,Math.PI/2);
    this.AddPlainWallStack(1.15,10.85,-Math.PI/2);

    this.AddProp("FloorTile",{
      Position:new THREE.Vector3(0,3.08,10.9),
      RotationX:Math.PI,
      Collision:true,
      CastShadow:false
    });

    this.AddWallCollider(-6,10,10,0.34,"OuterWall");
    this.AddWallCollider(6,10,10,0.34,"OuterWall");
    this.AddWallCollider(-1.15,10.85,0.3,1.7,"EntranceReturn");
    this.AddWallCollider(1.15,10.85,0.3,1.7,"EntranceReturn");
  }

  BuildBackFacade(){
    for(let X=-10;X<=10;X+=2){
      this.AddPlainWallStack(X,-10,Math.PI);
    }

    this.AddWallCollider(0,-10,22,0.34,"OuterWall");
  }

  BuildSideFacades(){
    for(const Side of [-1,1]){
      const X = Side*11;
      const RotationY = Side > 0 ? -Math.PI/2 : Math.PI/2;

      for(const Z of [-9,-7,-5,-3,-1,1,3,5,7,9]){
        this.AddProp("BrickWindowTrim",{
          Position:new THREE.Vector3(X,0,Z),
          RotationY,
          Collision:true
        });
      }

      this.AddWallCollider(X,0,0.34,20,"OuterWall");
    }
  }

  BuildVaultPartition(){
    for(const X of [-10,-8,-6,-4,-2,2,4,6,8,10]){
      this.AddPlainWallStack(X,-4);
    }

    this.VaultDoorModel = this.AddProp("MetalWindow",{
      Position:new THREE.Vector3(0,0,-4),
      Collision:true
    });

    this.AddWallCollider(-6.5,-4,9,0.34,"VaultWall");
    this.AddWallCollider(6.5,-4,9,0.34,"VaultWall");
  }

  BuildTellerArea(){
    for(const X of [-6,-4,-2,2,4,6]){
      this.AddPlainWallModule(X,0,2);
    }

    this.Collision.AddBox(
      -4,
      2,
      6,
      0.34,
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
      0.34,
      "Counter",
      {
        MinY:0,
        MaxY:1.02,
        CameraBlock:true
      }
    );
  }

  BuildNearSidewalk(){
    for(let X=-22;X<=22;X+=4){
      this.AddProp("FloorTile",{
        Position:new THREE.Vector3(X,-0.1,12),
        Collision:true,
        CastShadow:false
      });
    }
  }

  BuildRoad(){
    for(const X of [-18,-6,6,18]){
      this.AddProp("Street2Lane",{
        Position:new THREE.Vector3(X,-0.15,17),
        RotationY:Math.PI/2,
        Collision:true,
        CastShadow:false
      });
    }

    this.AddProp("Manhole",{
      Position:new THREE.Vector3(5.5,0.01,17),
      Collision:true,
      CastShadow:false
    });
  }

  BuildFarSidewalk(){
    for(let X=-22;X<=22;X+=4){
      this.AddProp("FloorTile",{
        Position:new THREE.Vector3(X,-0.1,22),
        Collision:true,
        CastShadow:false
      });
    }
  }

  BuildStreetBuildings(){
    const Buildings = [
      ["BuildingLarge",new THREE.Vector3(-18,0,32),Math.PI],
      ["BuildingMedium",new THREE.Vector3(1,0,31),Math.PI],
      ["BuildingSmall",new THREE.Vector3(14.5,0,31.3),Math.PI],
      ["BuildingMedium",new THREE.Vector3(29,0,32),Math.PI]
    ];

    for(const [Key,Position,RotationY] of Buildings){
      this.AddProp(Key,{
        Position,
        RotationY,
        Collision:true,
        CollisionType:"CityBuilding"
      });
    }

    for(const X of [-10,-6,-2,2,6,10]){
      this.AddProp("Bollard",{
        Position:new THREE.Vector3(X,0,12.45),
        Collision:true
      });
    }

    for(const X of [-8.4,8.4]){
      this.AddProp("Planter",{
        Position:new THREE.Vector3(X,0,12),
        Collision:true,
        CollisionType:"Planter"
      });
    }
  }

  BuildLobbyDetails(){
    this.AddProp("Planter",{
      Position:new THREE.Vector3(-8.7,0,7),
      Collision:true,
      CollisionType:"LobbyPlanter"
    });

    this.AddProp("Planter",{
      Position:new THREE.Vector3(8.7,0,7),
      Collision:true,
      CollisionType:"LobbyPlanter"
    });

    this.GearDisplay = this.AddProp("LootBox",{
      Position:new THREE.Vector3(this.GearPosition.x,0,this.GearPosition.z),
      TargetWidth:0.58,
      Collision:true
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

  ValidateCollisionCoverage(){
    const Missing = this.PropRoots.filter(Root=>Root.visible && !Root.userData.Collision);
    if(Missing.length){
      const Names = Missing.slice(0,8).map(Root=>Root.name || Root.userData?.SourceKey || "Unnamed").join(", ");
      throw new Error("Visible world props missing collision: "+Names);
    }

    return {
      Props:this.PropRoots.length,
      Colliders:this.PropRoots.filter(Root=>Root.userData.Collision).length
    };
  }

  async LoadModels(){
    await this.Props.Load();

    this.BuildFloor();
    this.BuildCeiling();
    this.BuildFrontFacade();
    this.BuildBackFacade();
    this.BuildSideFacades();
    this.BuildVaultPartition();
    this.BuildTellerArea();
    this.BuildNearSidewalk();
    this.BuildRoad();
    this.BuildFarSidewalk();
    this.BuildStreetBuildings();
    this.BuildLobbyDetails();
    this.BuildLoot();
    this.CollisionCoverage = this.ValidateCollisionCoverage();
  }
}
