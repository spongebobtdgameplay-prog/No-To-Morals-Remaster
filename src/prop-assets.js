import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/addons/libs/meshopt_decoder.module.js";

const DowntownBase = "https://raw.githubusercontent.com/AetherRadar/operation-steel-tide/main/assets/models/quaternius_downtown_city/";

const ModelPaths = Object.freeze({
  BrickPlain:DowntownBase+"Brick_Plain_1.gltf",
  BrickWindow:DowntownBase+"Brick_RedWhite_DoubleWindow.gltf",
  BrickWindowTrim:DowntownBase+"Brick_Window_Trim.gltf",
  DoorFrame:DowntownBase+"DoorFrame_Trim.gltf",
  MetalWindow:DowntownBase+"Metal_FirstFloor_Window.gltf",
  FloorTile:DowntownBase+"Floor_4x4.gltf",
  Street2Lane:DowntownBase+"Street_2Lane.gltf",
  StreetIntersection:DowntownBase+"Street_4WayIntersection.gltf",
  BuildingLarge:DowntownBase+"Building_Large_2.gltf",
  BuildingMedium:DowntownBase+"Building_Medium_2_001.gltf",
  BuildingSmall:DowntownBase+"Building_Small_1.gltf",
  EntranceStairs:DowntownBase+"Stairs_Entrance_Concrete.gltf",
  Bollard:DowntownBase+"Prop_Bollard.gltf",
  Planter:DowntownBase+"Prop_Planter_Single.gltf",
  Manhole:DowntownBase+"Prop_ManholeCover.gltf",
  LootBox:"https://raw.githubusercontent.com/sion-rgb/tactical-slash/main/assets/environment/dungeon_crate.glb"
});

function PrepareModel(Model,Options){
  Model.traverse(Object=>{
    if(!Object.isMesh) return;

    Object.castShadow = Options.CastShadow !== false;
    Object.receiveShadow = Options.ReceiveShadow !== false;

    if(Object.material){
      const Materials = Array.isArray(Object.material) ? Object.material : [Object.material];

      for(const Material of Materials){
        if("roughness" in Material && Number.isFinite(Material.roughness)){
          Material.roughness = Math.max(Material.roughness,0.28);
        }
      }
    }
  });
}

function FitModel(Model,Options){
  const WantsFit = Number.isFinite(Options.TargetWidth) ||
    Number.isFinite(Options.TargetHeight) ||
    Number.isFinite(Options.TargetDepth);

  if(!WantsFit) return;

  Model.updateMatrixWorld(true);

  const Bounds = new THREE.Box3().setFromObject(Model);
  const Size = new THREE.Vector3();
  Bounds.getSize(Size);

  const Ratios = [];

  if(Number.isFinite(Options.TargetWidth) && Size.x > 0.0001){
    Ratios.push(Options.TargetWidth/Size.x);
  }

  if(Number.isFinite(Options.TargetHeight) && Size.y > 0.0001){
    Ratios.push(Options.TargetHeight/Size.y);
  }

  if(Number.isFinite(Options.TargetDepth) && Size.z > 0.0001){
    Ratios.push(Options.TargetDepth/Size.z);
  }

  if(Ratios.length){
    Model.scale.multiplyScalar(Math.min(...Ratios));
  }
}

function GroundModel(Model){
  Model.updateMatrixWorld(true);

  const Bounds = new THREE.Box3().setFromObject(Model);
  const Center = new THREE.Vector3();
  Bounds.getCenter(Center);

  Model.position.x -= Center.x;
  Model.position.z -= Center.z;
  Model.position.y -= Bounds.min.y;
  Model.updateMatrixWorld(true);
}

export class PropLibrary{
  constructor(){
    this.Loader = new GLTFLoader();
    this.Loader.setMeshoptDecoder(MeshoptDecoder);
    this.Sources = new Map();
  }

  async Load(){
    const Loaded = await Promise.all(Object.entries(ModelPaths).map(async ([Key,Path])=>{
      try{
        const Gltf = await this.Loader.loadAsync(Path);

        if(!Gltf?.scene){
          throw new Error("Loaded model has no scene.");
        }

        return [Key,Gltf.scene];
      }catch(Error){
        throw new Error("Environment model "+Key+" failed to load: "+String(Error?.message || Error));
      }
    }));

    this.Sources.clear();

    for(const [Key,Scene] of Loaded){
      this.Sources.set(Key,Scene);
    }
  }

  Create(Key,Options={}){
    const Source = this.Sources.get(Key);

    if(!Source){
      throw new Error("Missing loaded prop model: "+Key);
    }

    const Model = Source.clone(true);

    PrepareModel(Model,Options);
    FitModel(Model,Options);

    if(Number.isFinite(Options.Scale)){
      Model.scale.multiplyScalar(Options.Scale);
    }

    if(Options.ScaleVector?.isVector3){
      Model.scale.multiply(Options.ScaleVector);
    }

    GroundModel(Model);

    const Root = new THREE.Group();
    Root.add(Model);
    Root.position.copy(Options.Position || new THREE.Vector3());
    Root.rotation.x = Number.isFinite(Options.RotationX) ? Options.RotationX : 0;
    Root.rotation.y = Number.isFinite(Options.RotationY) ? Options.RotationY : 0;
    Root.rotation.z = Number.isFinite(Options.RotationZ) ? Options.RotationZ : 0;
    Root.name = "Prop-"+Key;

    return Root;
  }
}
