import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/addons/libs/meshopt_decoder.module.js";
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

function FindClip(Animations,Names){
  for(const Name of Names){
    const Exact = Animations.find(Clip=>String(Clip.name || "").toLowerCase() === Name.toLowerCase());
    if(Exact) return Exact;
  }

  for(const Name of Names){
    const Lower = Name.toLowerCase();
    const Partial = Animations.find(Clip=>{
      const ClipName = String(Clip.name || "").toLowerCase();
      return ClipName.includes(Lower) && !/aim|shoot|combat|attack|weapon/.test(ClipName);
    });

    if(Partial) return Partial;
  }

  return null;
}

function CloneMaterial(Material,Role){
  const Clone = Material.clone();

  if(Clone.color){
    if(Role === "Robber"){
      Clone.color.lerp(new THREE.Color(0x171b20),0.38);
    }else{
      Clone.color.lerp(new THREE.Color(0x20384f),0.34);
    }
  }

  if("roughness" in Clone && Number.isFinite(Clone.roughness)){
    Clone.roughness = Math.max(Clone.roughness,0.54);
  }

  return Clone;
}

function StyleCharacter(Model,Role){
  Model.traverse(Object=>{
    if(!Object.isMesh || !Object.material) return;

    if(Array.isArray(Object.material)){
      Object.material = Object.material.map(Material=>CloneMaterial(Material,Role));
    }else{
      Object.material = CloneMaterial(Object.material,Role);
    }

    Object.castShadow = true;
    Object.receiveShadow = true;
    Object.frustumCulled = false;
  });
}

function RemoveUnwantedAccessories(Model){
  const Remove = [];

  Model.traverse(Object=>{
    const Name = String(Object.name || "").toLowerCase();

    if(/backpack|rucksack|quiver/.test(Name)){
      Remove.push(Object);
    }
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
  Model.updateMatrixWorld(true);
}

class ClipAnimator{
  constructor(Root,Animations){
    this.Root = Root;
    this.Mixer = new THREE.AnimationMixer(Root);
    this.Current = null;

    this.Actions = {
      Idle:this.CreateAction(FindClip(Animations,["Idle_Gun","Idle","Stand"])),
      Walk:this.CreateAction(FindClip(Animations,["Walk","Walking"])),
      Run:this.CreateAction(FindClip(Animations,["Run","Run_Shoot","Running"]))
    };

    if(this.Actions.Idle) this.Play("Idle",0);
  }

  CreateAction(Clip){
    if(!Clip) return null;

    const Action = this.Mixer.clipAction(Clip);
    Action.enabled = true;
    Action.setLoop(THREE.LoopRepeat,Infinity);
    return Action;
  }

  Play(Name,Fade=0.14){
    const Next = this.Actions[Name];
    if(!Next || Next === this.Current) return;

    Next.reset();
    Next.setEffectiveWeight(1);
    Next.setEffectiveTimeScale(1);
    Next.play();

    if(this.Current){
      this.Current.crossFadeTo(Next,Fade,false);
    }

    this.Current = Next;
  }

  Update(Delta,Speed){
    const Name = Speed > 5.0 ? "Run" : Speed > 0.12 ? "Walk" : "Idle";
    this.Play(Name);

    if(this.Current){
      const ReferenceSpeed = Name === "Run" ? 6.6 : Name === "Walk" ? 4.1 : 1;
      this.Current.setEffectiveTimeScale(Name === "Idle" ? 1 : THREE.MathUtils.clamp(Speed/ReferenceSpeed,0.76,1.18));
    }

    this.Mixer.update(Delta);
    this.Root.updateMatrixWorld(true);
  }
}

class BoneAnimator{
  constructor(Root){
    this.Root = Root;
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

  Rotate(Bone,X,Y=0,Z=0){
    if(!Bone) return;

    const Base = this.Base.get(Bone);
    if(Base) Bone.quaternion.copy(Base);

    const Extra = new THREE.Quaternion().setFromEuler(new THREE.Euler(X,Y,Z,"XYZ"));
    Bone.quaternion.multiply(Extra);
  }

  Update(Delta,Speed,TurnRate=0){
    this.Time += Delta*Math.max(2.7,Speed*1.26);

    const Move = THREE.MathUtils.clamp(Speed/6.6,0,1);
    const Run = THREE.MathUtils.smoothstep(Speed,4.2,6.6);
    const Swing = Math.sin(this.Time)*Move;

    this.Rotate(this.Bones.LeftLeg,Swing*(0.45+Run*0.18));
    this.Rotate(this.Bones.RightLeg,-Swing*(0.45+Run*0.18));
    this.Rotate(this.Bones.LeftArm,-Swing*(0.34+Run*0.14),0,0.025);
    this.Rotate(this.Bones.RightArm,Swing*(0.34+Run*0.14),0,-0.025);
    this.Rotate(this.Bones.Spine,Move*0.018,TurnRate*0.012,-TurnRate*0.008);

    this.Root.updateMatrixWorld(true);
  }
}

export class CharacterAssets{
  constructor(){
    this.Loader = new GLTFLoader();
    this.Loader.setMeshoptDecoder(MeshoptDecoder);
    this.Manifest = null;
    this.Models = new Map();
  }

  async Load(){
    const Response = await fetch("assets/models/manifest.json?v=20260830-v011");
    if(!Response.ok) throw new Error("Character manifest failed to load.");

    this.Manifest = await Response.json();

    await Promise.all([
      this.LoadOne("robber"),
      this.LoadOne("police")
    ]);
  }

  async LoadOne(Key){
    const Entry = this.Manifest[Key];
    if(!Entry) throw new Error("Missing character manifest entry: "+Key);

    try{
      const Gltf = await this.Loader.loadAsync(Entry.url);
      if(!Gltf?.scene) throw new Error("Loaded GLB has no scene.");

      this.Models.set(Key,{
        Scene:Gltf.scene,
        Animations:Array.isArray(Gltf.animations) ? Gltf.animations : []
      });
    }catch(Error){
      this.Models.delete(Key);
      throw new Error("Character model "+Key+" failed to load: "+String(Error?.message || Error));
    }
  }

  Create(Role){
    const Key = Role === "Police" ? "police" : "robber";
    const Source = this.Models.get(Key);

    if(!Source?.Scene){
      throw new Error("Required character model is unavailable: "+Key);
    }

    const Model = SkeletonClone(Source.Scene);

    RemoveUnwantedAccessories(Model);
    StyleCharacter(Model,Role);
    NormalizeCharacter(Model);

    const RightHand = FindBone(Model,[
      /righthand/,
      /rightwrist/,
      /wristr/,
      /handr/
    ]);

    const HasGenericMovement = Boolean(
      FindClip(Source.Animations,["Idle_Gun","Idle","Stand"]) &&
      FindClip(Source.Animations,["Walk","Walking"]) &&
      FindClip(Source.Animations,["Run","Run_Shoot","Running"])
    );

    return {
      Model,
      Animator:HasGenericMovement
        ? new ClipAnimator(Model,Source.Animations)
        : new BoneAnimator(Model),
      RightHand,
      FacingOffset:-Math.PI/2
    };
  }
}
