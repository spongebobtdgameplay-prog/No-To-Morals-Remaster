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
  const Dark = Role === "Police" ? 0x243a55 : 0x252b28;
  const Accent = Role === "Police" ? 0x315f93 : 0x1a1d1c;
  const Skin = new THREE.MeshStandardMaterial({color:0xa8795e,roughness:0.8});
  const Cloth = new THREE.MeshStandardMaterial({color:Dark,roughness:0.9});
  const ClothAccent = new THREE.MeshStandardMaterial({color:Accent,roughness:0.85});
  const Head = new THREE.Mesh(new THREE.SphereGeometry(0.16,12,10),Skin);
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

function AddRoleVest(Model,Role){
  const Material = new THREE.MeshStandardMaterial({
    color:Role === "Police" ? 0x234f7b : 0x171b19,
    roughness:0.82,
    metalness:0.02
  });
  const Vest = new THREE.Mesh(new THREE.BoxGeometry(0.48,0.58,0.24),Material);
  Vest.position.set(0,1.16,-0.02);
  Vest.castShadow = true;
  Model.add(Vest);
  if(Role === "Police"){
    const Badge = new THREE.Mesh(
      new THREE.BoxGeometry(0.07,0.09,0.02),
      new THREE.MeshStandardMaterial({color:0xb8c6d2,metalness:0.55,roughness:0.35})
    );
    Badge.position.set(0.13,1.31,0.13);
    Model.add(Badge);
  }
}

export class ProceduralHumanoidAnimator{
  constructor(Root){
    this.Root = Root;
    this.Time = 0;
    this.Bones = {
      LeftArm:FindBone(Root,[/left.*upperarm/,/upperarm.*l/,/armupperl/]),
      RightArm:FindBone(Root,[/right.*upperarm/,/upperarm.*r/,/armupperr/]),
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
    this.Time += Delta*Math.max(2.8,Speed*1.25);
    const Move = THREE.MathUtils.clamp(Speed/6.6,0,1);
    const Swing = Math.sin(this.Time)*Move;
    const Lift = Math.max(0,Math.sin(this.Time))*Move;
    this.Rotate(this.Bones.LeftLeg,Swing*0.58-Lift*0.08,0,0);
    this.Rotate(this.Bones.RightLeg,-Swing*0.58-Math.max(0,-Math.sin(this.Time))*0.08,0,0);
    this.Rotate(this.Bones.LeftArm,-Swing*0.48,0,0.035);
    this.Rotate(this.Bones.RightArm,Swing*0.48,0,-0.035);
    this.Rotate(this.Bones.Spine,Move*0.035,TurnRate*0.018,-TurnRate*0.012);
    this.Root.position.y = Math.abs(Math.sin(this.Time*2))*0.012*Move;
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
    const Response = await fetch("assets/models/manifest.json?v=20260826-1");
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
    NormalizeCharacter(Model);
    AddRoleVest(Model,Role);
    return {
      Model,
      Animator:new ProceduralHumanoidAnimator(Model)
    };
  }
}
