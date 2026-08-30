import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/addons/libs/meshopt_decoder.module.js";

const ModelPaths = Object.freeze({
  ReceptionDesk:"https://raw.githubusercontent.com/sorryhumans/roost/main/web/public/models/office/desk_alt.glb",
  OfficeChair:"https://raw.githubusercontent.com/sorryhumans/roost/main/web/public/models/office/chair_blue.glb",
  Storage:"https://raw.githubusercontent.com/sorryhumans/roost/main/web/public/models/office/bookcase.glb",
  Monitor:"https://raw.githubusercontent.com/sorryhumans/roost/main/web/public/models/office/monitor.glb",
  Laptop:"https://raw.githubusercontent.com/sorryhumans/roost/main/web/public/models/office/laptop.glb",
  Plant:"https://raw.githubusercontent.com/sorryhumans/roost/main/web/public/models/office/plant_monstera.glb",
  Trash:"https://raw.githubusercontent.com/sorryhumans/roost/main/web/public/models/office/trash.glb",
  Couch:"https://raw.githubusercontent.com/sorryhumans/roost/main/web/public/models/office/couch.glb",
  Armchair:"https://raw.githubusercontent.com/sorryhumans/roost/main/web/public/models/office/armchair.glb",
  FloorLamp:"https://raw.githubusercontent.com/sorryhumans/roost/main/web/public/models/office/floor_lamp.glb",
  LootBox:"https://raw.githubusercontent.com/sion-rgb/tactical-slash/main/assets/environment/dungeon_crate.glb",
  GetawayCar:"https://raw.githubusercontent.com/halcyon-video/halcyon-video/master/public/models/car_sedan.glb"
});

function CloneMaterial(Material,Tint,TintStrength){
  const Clone = Material.clone();
  if(Tint !== null && Tint !== undefined && Clone.color){
    Clone.color.lerp(new THREE.Color(Tint),THREE.MathUtils.clamp(TintStrength,0,1));
  }
  if("roughness" in Clone && Number.isFinite(Clone.roughness)){
    Clone.roughness = Math.max(0.36,Clone.roughness);
  }
  return Clone;
}

function PrepareModel(Model,Options){
  const Tint = Options.Tint;
  const TintStrength = Number.isFinite(Options.TintStrength) ? Options.TintStrength : 0.12;

  Model.traverse(Object=>{
    if(!Object.isMesh) return;
    Object.castShadow = Options.CastShadow !== false;
    Object.receiveShadow = Options.ReceiveShadow !== false;

    if(Array.isArray(Object.material)){
      Object.material = Object.material.map(Material=>CloneMaterial(Material,Tint,TintStrength));
    }else if(Object.material){
      Object.material = CloneMaterial(Object.material,Tint,TintStrength);
    }
  });
}

function FitModel(Model,Options){
  Model.updateMatrixWorld(true);
  const Bounds = new THREE.Box3().setFromObject(Model);
  const Size = new THREE.Vector3();
  Bounds.getSize(Size);

  const Ratios = [];
  if(Number.isFinite(Options.TargetWidth) && Size.x > 0.0001) Ratios.push(Options.TargetWidth/Size.x);
  if(Number.isFinite(Options.TargetHeight) && Size.y > 0.0001) Ratios.push(Options.TargetHeight/Size.y);
  if(Number.isFinite(Options.TargetDepth) && Size.z > 0.0001) Ratios.push(Options.TargetDepth/Size.z);

  const Scale = Ratios.length ? Math.min(...Ratios) : 1;
  Model.scale.multiplyScalar(Scale);
  Model.updateMatrixWorld(true);

  const ScaledBounds = new THREE.Box3().setFromObject(Model);
  const Center = new THREE.Vector3();
  ScaledBounds.getCenter(Center);

  Model.position.x -= Center.x;
  Model.position.z -= Center.z;
  Model.position.y -= ScaledBounds.min.y;
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
        if(!Gltf?.scene) throw new Error("Loaded GLB has no scene.");
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
    if(!Source) throw new Error("Missing loaded prop model: "+Key);

    const Model = Source.clone(true);
    PrepareModel(Model,Options);
    FitModel(Model,Options);

    const Root = new THREE.Group();
    Root.add(Model);
    Root.position.copy(Options.Position || new THREE.Vector3());
    Root.rotation.y = Number.isFinite(Options.RotationY) ? Options.RotationY : 0;
    Root.name = "Prop-"+Key;
    return Root;
  }
}
