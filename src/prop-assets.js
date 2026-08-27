import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";

const ModelPaths = Object.freeze({
  Desk:"assets/models/kenney-furniture/desk.glb",
  ChairDesk:"assets/models/kenney-furniture/chairDesk.glb",
  Locker:"assets/models/kenney-furniture/bookcaseClosedDoors.glb",
  Monitor:"assets/models/kenney-furniture/computerScreen.glb",
  Keyboard:"assets/models/kenney-furniture/computerKeyboard.glb",
  Plant:"assets/models/kenney-furniture/pottedPlant.glb",
  Trashcan:"assets/models/kenney-furniture/trashcan.glb",
  Lockbox:"assets/models/kenney-furniture/cardboardBoxClosed.glb",
  Bench:"assets/models/kenney-furniture/benchCushionLow.glb",
  Doorway:"assets/models/kenney-furniture/doorwayOpen.glb",
  Van:"assets/models/kenney-car/van.glb"
});

function CloneMaterial(Material,Tint){
  const Clone = Material.clone();
  if(Tint !== null && Tint !== undefined && Clone.color){
    Clone.color.lerp(new THREE.Color(Tint),0.32);
  }
  return Clone;
}

function PrepareModel(Model,Tint){
  Model.traverse(Object=>{
    if(!Object.isMesh) return;
    Object.castShadow = true;
    Object.receiveShadow = true;
    if(Array.isArray(Object.material)){
      Object.material = Object.material.map(Material=>CloneMaterial(Material,Tint));
    }else if(Object.material){
      Object.material = CloneMaterial(Object.material,Tint);
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
    this.Sources = new Map();
  }

  async Load(){
    await Promise.all(Object.entries(ModelPaths).map(async ([Key,Path])=>{
      const Gltf = await this.Loader.loadAsync(Path);
      this.Sources.set(Key,Gltf.scene);
    }));
  }

  Create(Key,Options={}){
    const Source = this.Sources.get(Key);
    if(!Source) throw new Error("Missing loaded prop model: "+Key);

    const Model = Source.clone(true);
    PrepareModel(Model,Options.Tint);
    FitModel(Model,Options);

    const Root = new THREE.Group();
    Root.add(Model);
    Root.position.copy(Options.Position || new THREE.Vector3());
    Root.rotation.y = Number.isFinite(Options.RotationY) ? Options.RotationY : 0;
    Root.name = "Prop-"+Key;
    return Root;
  }
}
