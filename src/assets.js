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
  const Name = String(Clone.name || "").toLowerCase();

  if(Clone.map){
    Clone.map.colorSpace = THREE.SRGBColorSpace;
    Clone.map.needsUpdate = true;
  }

  if(Clone.color){
    if(Role === "Robber"){
      if(/eye/.test(Name)){
        Clone.color.setHex(0xd9dde0);
      }else if(/skin/.test(Name)){
        Clone.color.setHex(0x171a1e);
      }else if(/hair|eyebrow/.test(Name)){
        Clone.color.setHex(0x111417);
      }else if(/purple|blue|lightblue/.test(Name)){
        Clone.color.setHex(0x303943);
      }else if(/white|gray|grey/.test(Name)){
        Clone.color.setHex(0x39424a);
      }else{
        Clone.color.lerp(new THREE.Color(0x303840),0.22);
      }
    }else{
      Clone.color.lerp(new THREE.Color(0x29435c),0.24);
    }
  }

  if("roughness" in Clone && Number.isFinite(Clone.roughness)){
    Clone.roughness = Role === "Robber"
      ? THREE.MathUtils.clamp(Clone.roughness,0.58,0.88)
      : Math.max(Clone.roughness,0.54);
  }

  if("metalness" in Clone && Number.isFinite(Clone.metalness) && Role === "Robber"){
    Clone.metalness = Math.min(Clone.metalness,0.08);
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

    Object.castShadow = false;
    Object.receiveShadow = false;
    Object.frustumCulled = false;

    const Materials = Array.isArray(Object.material) ? Object.material : [Object.material];
    for(const Material of Materials){
      if(!Material) continue;
      Material.side = THREE.FrontSide;
      if("roughness" in Material) Material.roughness = Math.max(Material.roughness ?? 0.55,0.58);
      Material.needsUpdate = true;
    }
  });
}

function StyleLootBag(Model){
  Model.traverse(Object=>{
    if(!Object.isMesh || !Object.material) return;
    const WasArray = Array.isArray(Object.material);
    const Materials = WasArray ? Object.material : [Object.material];
    const Styled = Materials.map(Material=>{
      const Clone = Material.clone();
      const Name = String(Clone.name || "").toLowerCase();
      if(Clone.map){
        Clone.map.colorSpace = THREE.SRGBColorSpace;
        Clone.map.needsUpdate = true;
      }
      if(Clone.color){
        if(/gold/.test(Name)) Clone.color.setHex(0xb08a3f);
        else if(/black/.test(Name)) Clone.color.setHex(0x22272d);
        else Clone.color.setHex(0x2a3037);
      }
      if("roughness" in Clone) Clone.roughness = /gold/.test(Name) ? 0.4 : 0.72;
      if("metalness" in Clone) Clone.metalness = /gold/.test(Name) ? 0.45 : 0.03;
      return Clone;
    });
    Object.material = WasArray ? Styled : Styled[0];
    Object.castShadow = false;
    Object.receiveShadow = false;
  });
}

function RemoveUnwantedAccessories(Model){
  const Remove = [];

  Model.traverse(Object=>{
    const Name = String(Object.name || "").toLowerCase();

    if(/backpack|rucksack|quiver|shield|badge|radio|sword|dagger|knife|bow|axe|weapon/.test(Name)){
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

  const Scale = Size.y > 0.001 ? 1.76/Size.y : 1;
  Model.scale.multiplyScalar(Scale);
  Model.updateMatrixWorld(true);

  const ScaledBounds = new THREE.Box3().setFromObject(Model);
  const Center = ScaledBounds.getCenter(new THREE.Vector3());
  Model.position.x -= Center.x;
  Model.position.z -= Center.z;
  Model.updateMatrixWorld(true);

  const GroundedBounds = new THREE.Box3().setFromObject(Model);
  Model.position.y -= GroundedBounds.min.y;
  Model.updateMatrixWorld(true);
}

function TrimCompositePart(Model,KeepUpper){
  Model.updateMatrixWorld(true);
  const Remove = [];
  const Center = new THREE.Vector3();

  Model.traverse(Object=>{
    if(!Object.isMesh) return;

    const Bounds = new THREE.Box3().setFromObject(Object);
    if(Bounds.isEmpty()) return;

    Bounds.getCenter(Center);
    const Name = String(Object.name || "").toLowerCase();
    const IsUpperAccessory = /head|hair|eye|brow|hand|arm|hood|shirt|sleeve|torso|chest/.test(Name);

    if(KeepUpper){
      if(Center.y < 0.9 && !IsUpperAccessory) Remove.push(Object);
    }else if(Center.y > 1.02){
      Remove.push(Object);
    }
  });

  for(const Object of Remove){
    Object.parent?.remove(Object);
  }

  Model.updateMatrixWorld(true);
}

class CompositeAnimator{
  constructor(Animators){
    this.Animators = Animators.filter(Boolean);
  }

  Update(Delta,Speed,TurnRate=0){
    for(const Animator of this.Animators){
      Animator.Update(Delta,Speed,TurnRate);
    }
  }
}

class ClipAnimator{
  constructor(Root,Animations){
    this.Root = Root;
    this.Mixer = new THREE.AnimationMixer(Root);
    this.Current = null;

    this.Actions = {
      Idle:this.CreateAction(FindClip(Animations,["Idle_Neutral","Idle","Stand"])),
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
    const Name = Speed > 4.35 ? "Run" : Speed > 0.12 ? "Walk" : "Idle";
    this.Play(Name);

    if(this.Current){
      const ReferenceSpeed = Name === "Run" ? 5.35 : Name === "Walk" ? 3.45 : 1;
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
    this.Time += Delta*Math.max(2.7,Speed*1.32);

    const Move = THREE.MathUtils.clamp(Speed/5.35,0,1);
    const Run = THREE.MathUtils.smoothstep(Speed,3.5,5.35);
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
    const Response = await fetch("assets/models/manifest.json?v=20260831-v019");
    if(!Response.ok) throw new Error("Character manifest failed to load.");

    this.Manifest = await Response.json();

    await Promise.all([
      this.LoadOne("robberUpper"),
      this.LoadOne("robberLower"),
      this.LoadOne("police"),
      this.LoadOne("lootBag")
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
    if(Role === "Police"){
      const Source = this.Models.get("police");

      if(!Source?.Scene){
        throw new Error("Required character model is unavailable: police");
      }

      const Model = SkeletonClone(Source.Scene);
      RemoveUnwantedAccessories(Model);
      StyleCharacter(Model,Role);
      NormalizeCharacter(Model);

      const HasGenericMovement = Boolean(
        FindClip(Source.Animations,["Idle_Neutral","Idle","Stand"]) &&
        FindClip(Source.Animations,["Walk","Walking"]) &&
        FindClip(Source.Animations,["Run","Run_Shoot","Running"])
      );

      return {
        Model,
        Animator:HasGenericMovement
          ? new ClipAnimator(Model,Source.Animations)
          : new BoneAnimator(Model),
        RightHand:FindBone(Model,[/righthand/,/rightwrist/,/wristr/,/handr/]),
        BagAnchor:null,
        FacingOffset:0
      };
    }

    const UpperSource = this.Models.get("robberUpper");
    const LowerSource = this.Models.get("robberLower");

    if(!UpperSource?.Scene || !LowerSource?.Scene){
      throw new Error("Required modular robber models are unavailable.");
    }

    const Upper = SkeletonClone(UpperSource.Scene);
    const Lower = SkeletonClone(LowerSource.Scene);

    RemoveUnwantedAccessories(Upper);
    RemoveUnwantedAccessories(Lower);
    StyleCharacter(Upper,"Robber");
    StyleCharacter(Lower,"Robber");
    NormalizeCharacter(Upper);
    NormalizeCharacter(Lower);
    TrimCompositePart(Upper,true);
    TrimCompositePart(Lower,false);

    const Model = new THREE.Group();
    Model.name = "ModernRobberComposite";
    Model.add(Upper);
    Model.add(Lower);

    const UpperHasMovement = Boolean(
      FindClip(UpperSource.Animations,["Idle_Neutral","Idle","Stand"]) &&
      FindClip(UpperSource.Animations,["Walk","Walking"]) &&
      FindClip(UpperSource.Animations,["Run","Run_Shoot","Running"])
    );
    const LowerHasMovement = Boolean(
      FindClip(LowerSource.Animations,["Idle_Neutral","Idle","Stand"]) &&
      FindClip(LowerSource.Animations,["Walk","Walking"]) &&
      FindClip(LowerSource.Animations,["Run","Run_Shoot","Running"])
    );

    const UpperAnimator = UpperHasMovement
      ? new ClipAnimator(Upper,UpperSource.Animations)
      : new BoneAnimator(Upper);
    const LowerAnimator = LowerHasMovement
      ? new ClipAnimator(Lower,LowerSource.Animations)
      : new BoneAnimator(Lower);

    return {
      Model,
      Animator:new CompositeAnimator([UpperAnimator,LowerAnimator]),
      RightHand:FindBone(Upper,[/righthand/,/rightwrist/,/wristr/,/handr/]),
      BagAnchor:null,
      FacingOffset:0
    };
  }

  CreateLootBag(){
    const Source = this.Models.get("lootBag");
    if(!Source?.Scene) throw new Error("Required duffel bag model is unavailable.");

    const Model = Source.Scene.clone(true);
    StyleLootBag(Model);
    Model.rotation.y = Math.PI/2;
    Model.updateMatrixWorld(true);

    let Bounds = new THREE.Box3().setFromObject(Model);
    const Size = Bounds.getSize(new THREE.Vector3());
    const LongestHorizontal = Math.max(Size.x,Size.z);

    if(LongestHorizontal > 0.001){
      Model.scale.multiplyScalar(0.52/LongestHorizontal);
    }

    Model.updateMatrixWorld(true);
    Bounds = new THREE.Box3().setFromObject(Model);

    const HandleBounds = new THREE.Box3();
    HandleBounds.makeEmpty();

    Model.traverse(Object=>{
      if(!Object.isMesh) return;
      const Name = String(Object.name || "").trim();
      if(/^Bag Handle$/i.test(Name)) HandleBounds.expandByObject(Object);
    });

    const GripPoint = new THREE.Vector3();

    if(!HandleBounds.isEmpty()){
      HandleBounds.getCenter(GripPoint);
      GripPoint.y = HandleBounds.max.y;
    }else{
      Bounds.getCenter(GripPoint);
      GripPoint.y = Bounds.max.y;
    }

    Model.position.sub(GripPoint);
    Model.updateMatrixWorld(true);

    const FinalBounds = new THREE.Box3().setFromObject(Model);
    const FinalSize = FinalBounds.getSize(new THREE.Vector3());
    const Grip = new THREE.Group();

    Grip.name = "RobberLootDuffelGrip";
    Grip.userData.BagHalfWidth = FinalSize.x*0.5;
    Grip.userData.BagDepth = FinalSize.z;
    Grip.userData.BagHeight = FinalSize.y;
    Grip.userData.HandleGripVerified = !HandleBounds.isEmpty();
    Grip.add(Model);

    return Grip;
  }
}
