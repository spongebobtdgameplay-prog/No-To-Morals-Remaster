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

function CloneAndStyleMaterial(Material,Role){
  const Clone = Material.clone();

  if(Clone.color){
    if(Role === "Robber"){
      Clone.color.lerp(new THREE.Color(0x101316),0.28);
    }else{
      Clone.color.lerp(new THREE.Color(0x20364f),0.18);
    }
  }

  if("roughness" in Clone && Number.isFinite(Clone.roughness)){
    Clone.roughness = Math.max(Clone.roughness,0.5);
  }

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

    Object.castShadow = true;
    Object.receiveShadow = true;
    Object.frustumCulled = false;
  });
}

function RemoveUnwantedAccessories(Model){
  const Remove = [];

  Model.traverse(Object=>{
    const Name = String(Object.name || "").toLowerCase();
    if(/backpack|rucksack|quiver|shield|sword|dagger|axe|staff|wand/.test(Name)) Remove.push(Object);
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

function FindClip(Animations,Names){
  for(const Name of Names){
    const Exact = Animations.find(Clip=>Clip.name === Name);
    if(Exact) return Exact;
  }

  for(const Name of Names){
    const Lower = Name.toLowerCase();
    const Partial = Animations.find(Clip=>String(Clip.name || "").toLowerCase().includes(Lower));
    if(Partial) return Partial;
  }

  return null;
}

class ClipHumanoidAnimator{
  constructor(Root,Animations){
    this.Root = Root;
    this.Mixer = new THREE.AnimationMixer(Root);
    this.Current = null;
    this.Actions = {
      Idle:this.CreateAction(FindClip(Animations,["Idle","Unarmed_Idle"])),
      Walk:this.CreateAction(FindClip(Animations,["Walking_A","Walking_B","Walking_C","Walk"])),
      Run:this.CreateAction(FindClip(Animations,["Running_A","Running_B","Run"]))
    };

    this.Play("Idle",0);
  }

  CreateAction(Clip){
    if(!Clip) return null;
    const Action = this.Mixer.clipAction(Clip);
    Action.enabled = true;
    Action.setLoop(THREE.LoopRepeat,Infinity);
    return Action;
  }

  Play(Name,Fade=0.16){
    const Next = this.Actions[Name];
    if(!Next || this.Current === Next) return;

    Next.enabled = true;
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
    if(Speed > 5.0) this.Play("Run");
    else if(Speed > 0.12) this.Play("Walk");
    else this.Play("Idle");

    if(this.Current === this.Actions.Walk){
      this.Current.setEffectiveTimeScale(THREE.MathUtils.clamp(Speed/4.1,0.72,1.35));
    }else if(this.Current === this.Actions.Run){
      this.Current.setEffectiveTimeScale(THREE.MathUtils.clamp(Speed/6.6,0.8,1.25));
    }

    this.Mixer.update(Delta);
    this.Root.updateMatrixWorld(true);
  }
}

class BoneFallbackAnimator{
  constructor(Root){
    this.Root = Root;
    this.Time = 0;
    this.Bones = {
      LeftArm:FindBone(Root,[/left.*upperarm/,/upperarm.*l/,/armupperl/,/leftarm$/]),
      RightArm:FindBone(Root,[/right.*upperarm/,/upperarm.*r/,/armupperr/,/rightarm$/]),
      LeftLeg:FindBone(Root,[/left.*upleg/,/left.*thigh/,/upleg.*l/,/thigh.*l/]),
      RightLeg:FindBone(Root,[/right.*upleg/,/right.*thigh/,/upleg.*r/,/thigh.*r/])
    };
    this.Base = new Map();

    for(const Bone of Object.values(this.Bones)){
      if(Bone) this.Base.set(Bone,Bone.quaternion.clone());
    }
  }

  Rotate(Bone,X){
    if(!Bone) return;
    const Base = this.Base.get(Bone);
    if(Base) Bone.quaternion.copy(Base);
    Bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(X,0,0,"XYZ")));
  }

  Update(Delta,Speed){
    this.Time += Delta*Math.max(2.8,Speed*1.3);
    const Move = THREE.MathUtils.clamp(Speed/6.6,0,1);
    const Swing = Math.sin(this.Time)*Move*0.55;

    this.Rotate(this.Bones.LeftLeg,Swing);
    this.Rotate(this.Bones.RightLeg,-Swing);
    this.Rotate(this.Bones.LeftArm,-Swing*0.72);
    this.Rotate(this.Bones.RightArm,Swing*0.72);
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
    const Response = await fetch("assets/models/manifest.json?v=20260830-realworld1");
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
    if(!Source?.Scene) throw new Error("Required character model is unavailable: "+Key);

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

    const HasMovementClips = Boolean(
      FindClip(Source.Animations,["Idle","Unarmed_Idle"]) &&
      FindClip(Source.Animations,["Walking_A","Walking_B","Walking_C","Walk"]) &&
      FindClip(Source.Animations,["Running_A","Running_B","Run"])
    );

    return {
      Model,
      Animator:HasMovementClips
        ? new ClipHumanoidAnimator(Model,Source.Animations)
        : new BoneFallbackAnimator(Model),
      RightHand,
      FacingOffset:Math.PI
    };
  }
}
