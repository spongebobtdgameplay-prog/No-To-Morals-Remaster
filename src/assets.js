import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {clone as SkeletonClone} from "three/addons/utils/SkeletonUtils.js";

function FindBone(Root,Patterns){
  let Result = null;
  Root.traverse(Object=>{
    if(Result || !Object.isBone) return;
    const Name = String(Object.name || "").toLowerCase().replace(/[^a-z0-9]/g,"");
    if(Patterns.some(Pattern=>Pattern.test(Name))) Result = Object;
  });
  return Result;
}

function BuildFallbackHumanoid(Role){
  const Root = new THREE.Group();
  const Dark = Role === "Police" ? 0x243a55 : 0x171a1c;
  const Accent = Role === "Police" ? 0x315f93 : 0x0d0f10;
  const Skin = new THREE.MeshStandardMaterial({color:0x7c685b,roughness:0.8});
  const Cloth = new THREE.MeshStandardMaterial({color:Dark,roughness:0.9});
  const ClothAccent = new THREE.MeshStandardMaterial({color:Accent,roughness:0.85});

  const Head = new THREE.Mesh(new THREE.SphereGeometry(0.16,12,10),Role === "Police" ? Skin : ClothAccent);
  Head.position.y = 1.68;

  const Torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24,0.45,4,8),Cloth);
  Torso.position.y = 1.15;

  const Hips = new THREE.Mesh(new THREE.BoxGeometry(0.42,0.25,0.28),ClothAccent);
  Hips.position.y = 0.78;

  Root.add(Head,Torso,Hips);

  for(const Side of [-1,1]){
    const Arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07,0.48,4,8),Cloth);
    Arm.position.set(Side*0.31,1.18,0);

    const Leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09,0.58,4,8),ClothAccent);
    Leg.position.set(Side*0.13,0.42,0);

    Root.add(Arm,Leg);
  }

  Root.userData.Fallback = true;
  return Root;
}

function CloneAndStyleMaterial(Material,Role){
  const Clone = Material.clone();

  if(Clone.color){
    if(Role === "Robber"){
      Clone.color.lerp(new THREE.Color(0x171b20),0.42);
    }else{
      Clone.color.lerp(new THREE.Color(0x274c68),0.24);
    }
  }

  if("roughness" in Clone) Clone.roughness = Math.max(Clone.roughness ?? 0.5,0.56);
  return Clone;
}

function StyleCharacter(Model,Role){
  Model.traverse(Object=>{
    if(!Object.isMesh || !Object.material) return;

    if(Array.isArray(Object.material)){
      Object.material = Object.material.map(Material=>CloneAndStyleMaterial(Material,Role));
    }else{
      Object.material = CloneAndStyleMaterial(Object.material,Role);
    }
  });
}


function RemoveUnwantedAccessories(Model){
  const Remove = [];
  Model.traverse(Object=>{
    const Name = String(Object.name || "").toLowerCase();
    if(/backpack|rucksack|back_pack|back-pack/.test(Name)) Remove.push(Object);
  });

  for(const Object of Remove){
    Object.parent?.remove(Object);
  }
}

function NormalizeCharacter(Model){
  Model.updateMatrixWorld(true);
  const Bounds = new THREE.Box3().setFromObject(Model);
  const Size = new THREE.Vector3();
  Bounds.getSize(Size);
  const Scale = Size.y > 0.001 ? 1.78/Size.y : 1;

  Model.scale.multiplyScalar(Scale);
  Model.updateMatrixWorld(true);

  const NewBounds = new THREE.Box3().setFromObject(Model);
  Model.position.y -= NewBounds.min.y;

  Model.traverse(Object=>{
    if(Object.isMesh){
      Object.castShadow = true;
      Object.receiveShadow = true;
      Object.frustumCulled = false;
    }
  });
}

export class ProceduralHumanoidAnimator{
  constructor(Root){
    this.Root = Root;
    this.BaseRootY = Root.position.y;
    this.Time = 0;
    this.Bones = {
      LeftArm:FindBone(Root,[/left.*upperarm/,/upperarm.*l/,/armupperl/,/leftarm$/]),
      RightArm:FindBone(Root,[/right.*upperarm/,/upperarm.*r/,/armupperr/,/rightarm$/]),
      LeftLeg:FindBone(Root,[/left.*upleg/,/left.*thigh/,/upleg.*l/,/thigh.*l/]),
      RightLeg:FindBone(Root,[/right.*upleg/,/right.*thigh/,/upleg.*r/,/thigh.*r/]),
      Spine:FindBone(Root,[/spine/,/chest/,/torso/])
    };
    this.Base = new Map();

    for(const Bone of Object.values(this.Bones)){
      if(Bone) this.Base.set(Bone,Bone.quaternion.clone());
    }
  }

  Rotate(Bone,X,Y,Z){
    if(!Bone) return;

    const Base = this.Base.get(Bone);
    if(Base) Bone.quaternion.copy(Base);

    const Extra = new THREE.Quaternion().setFromEuler(new THREE.Euler(X,Y,Z,"XYZ"));
    Bone.quaternion.multiply(Extra);
  }

  Update(Delta,Speed,TurnRate=0){
    this.Time += Delta*Math.max(2.6,Speed*1.22);

    const Move = THREE.MathUtils.clamp(Speed/6.6,0,1);
    const Run = THREE.MathUtils.smoothstep(Speed,4.2,6.6);
    const Swing = Math.sin(this.Time)*Move;
    const LeftLift = Math.max(0,Math.sin(this.Time))*Move;
    const RightLift = Math.max(0,-Math.sin(this.Time))*Move;

    this.Rotate(this.Bones.LeftLeg,Swing*(0.48+Run*0.18)-LeftLift*0.08,0,-Run*0.014);
    this.Rotate(this.Bones.RightLeg,-Swing*(0.48+Run*0.18)-RightLift*0.08,0,Run*0.014);
    this.Rotate(this.Bones.LeftArm,-Swing*(0.38+Run*0.17)-Run*0.04,0,0.035);
    this.Rotate(this.Bones.RightArm,Swing*(0.38+Run*0.17)-Run*0.04,0,-0.035);
    this.Rotate(this.Bones.Spine,Move*(0.018+Run*0.03),TurnRate*0.014,-TurnRate*0.01);

    const StepBob = Math.abs(Math.sin(this.Time*2));
    this.Root.position.y = this.BaseRootY+StepBob*(0.006+Run*0.008)*Move;
    this.Root.updateMatrixWorld(true);
  }
}

export class CharacterAssets{
  constructor(){
    this.Loader = new GLTFLoader();
    this.Manifest = null;
    this.Models = new Map();
  }

  async Load(){
    const Response = await fetch("assets/models/manifest.json?v=20260830-v01-models");
    if(!Response.ok) throw new Error("Character manifest failed to load.");

    this.Manifest = await Response.json();

    await Promise.all([
      this.LoadOne("robber"),
      this.LoadOne("police")
    ]);
  }

  async LoadOne(Key){
    const Entry = this.Manifest[Key];
    if(!Entry) return;

    try{
      const Gltf = await this.Loader.loadAsync(Entry.url);
      this.Models.set(Key,Gltf.scene);
    }catch(Error){
      console.warn("Character asset failed; fallback will be used.",Key,Error);
      this.Models.set(Key,null);
    }
  }

  Create(Role){
    const Key = Role === "Police" ? "police" : "robber";
    const Source = this.Models.get(Key);
    const Model = Source ? SkeletonClone(Source) : BuildFallbackHumanoid(Role);

    RemoveUnwantedAccessories(Model);
    StyleCharacter(Model,Role);
    NormalizeCharacter(Model);

    const RightHand = FindBone(Model,[
      /righthand/,
      /rightwrist/,
      /wristr/,
      /handr/
    ]);

    return {
      Model,
      Animator:new ProceduralHumanoidAnimator(Model),
      RightHand,
      FacingOffset:Math.PI
    };
  }
}
