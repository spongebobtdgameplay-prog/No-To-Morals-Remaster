import * as THREE from "three";

function NormalizedName(Object){
  return String(Object?.name || "").toLowerCase().replace(/[^a-z0-9]/g,"");
}

function FindBone(Root,Patterns){
  let Result = null;
  Root.traverse(Object=>{
    if(Result || !Object.isBone) return;
    const Name = NormalizedName(Object);
    if(Patterns.some(Pattern=>Pattern.test(Name))) Result = Object;
  });
  return Result;
}

function LimbBlocking(Collider){
  return /wall|vaultdoor|counter|desk/i.test(String(Collider?.Type || ""));
}

export class LimbContactSystem{
  constructor(Root,Collision){
    this.Root = Root;
    this.Collision = Collision;
    this.SavedPose = new Map();
    this.Start = new THREE.Vector3();
    this.End = new THREE.Vector3();
    this.CurrentDirection = new THREE.Vector3();
    this.TargetDirection = new THREE.Vector3();
    this.ParentQuaternion = new THREE.Quaternion();
    this.JointQuaternion = new THREE.Quaternion();
    this.DeltaQuaternion = new THREE.Quaternion();
    this.DesiredQuaternion = new THREE.Quaternion();
    this.LocalQuaternion = new THREE.Quaternion();

    const LeftUpperArm = FindBone(Root,[/leftupperarm/,/upperarml/,/leftarm$/]);
    const LeftLowerArm = FindBone(Root,[/leftforearm/,/leftlowerarm/,/lowerarml/,/leftforearm$/]);
    const LeftHand = FindBone(Root,[/lefthand/,/leftwrist/,/wristl/,/handl/]);
    const RightUpperArm = FindBone(Root,[/rightupperarm/,/upperarmr/,/rightarm$/]);
    const RightLowerArm = FindBone(Root,[/rightforearm/,/rightlowerarm/,/lowerarmr/,/rightforearm$/]);
    const RightHand = FindBone(Root,[/righthand/,/rightwrist/,/wristr/,/handr/]);

    const LeftUpperLeg = FindBone(Root,[/leftupperleg/,/leftupleg/,/leftthigh/,/uplegl/,/thighl/]);
    const LeftLowerLeg = FindBone(Root,[/leftlowerleg/,/leftshin/,/lowerlegl/,/shinl/,/leftleg$/]);
    const LeftFoot = FindBone(Root,[/leftfoot/,/footl/]);
    const RightUpperLeg = FindBone(Root,[/rightupperleg/,/rightupleg/,/rightthigh/,/uplegr/,/thighr/]);
    const RightLowerLeg = FindBone(Root,[/rightlowerleg/,/rightshin/,/lowerlegr/,/shinr/,/rightleg$/]);
    const RightFoot = FindBone(Root,[/rightfoot/,/footr/]);

    this.Segments = [];

    if(LeftUpperArm && LeftLowerArm) this.Segments.push({Joint:LeftUpperArm,Child:LeftLowerArm,Radius:0.074});
    if(LeftLowerArm && LeftHand) this.Segments.push({Joint:LeftLowerArm,Child:LeftHand,Radius:0.066});
    if(RightUpperArm && RightLowerArm) this.Segments.push({Joint:RightUpperArm,Child:RightLowerArm,Radius:0.074});
    if(RightLowerArm && RightHand) this.Segments.push({Joint:RightLowerArm,Child:RightHand,Radius:0.066});

    if(LeftUpperLeg && LeftLowerLeg) this.Segments.push({Joint:LeftUpperLeg,Child:LeftLowerLeg,Radius:0.095});
    if(LeftLowerLeg && LeftFoot) this.Segments.push({Joint:LeftLowerLeg,Child:LeftFoot,Radius:0.085});
    if(RightUpperLeg && RightLowerLeg) this.Segments.push({Joint:RightUpperLeg,Child:RightLowerLeg,Radius:0.095});
    if(RightLowerLeg && RightFoot) this.Segments.push({Joint:RightLowerLeg,Child:RightFoot,Radius:0.085});
  }

  Restore(){
    if(!this.SavedPose.size) return;
    for(const [Bone,Quaternion] of this.SavedPose) Bone.quaternion.copy(Quaternion);
    this.SavedPose.clear();
    this.Root.updateMatrixWorld(true);
  }

  Save(){
    this.SavedPose.clear();
    for(const Segment of this.Segments){
      if(!this.SavedPose.has(Segment.Joint)){
        this.SavedPose.set(Segment.Joint,Segment.Joint.quaternion.clone());
      }
    }
  }

  RotateJointToTarget(Joint,Child,Target){
    if(!Joint?.isBone || !Child?.isBone || !Joint.parent) return false;

    Joint.getWorldPosition(this.Start);
    Child.getWorldPosition(this.End);
    this.CurrentDirection.copy(this.End).sub(this.Start);
    this.TargetDirection.copy(Target).sub(this.Start);
    if(this.CurrentDirection.lengthSq() <= 0.000001 || this.TargetDirection.lengthSq() <= 0.000001) return false;

    this.CurrentDirection.normalize();
    this.TargetDirection.normalize();
    if(this.CurrentDirection.dot(this.TargetDirection) > 0.9999995) return false;

    this.DeltaQuaternion.setFromUnitVectors(this.CurrentDirection,this.TargetDirection);
    Joint.getWorldQuaternion(this.JointQuaternion);
    this.DesiredQuaternion.copy(this.DeltaQuaternion).multiply(this.JointQuaternion);
    Joint.parent.getWorldQuaternion(this.ParentQuaternion).invert();
    this.LocalQuaternion.copy(this.ParentQuaternion).multiply(this.DesiredQuaternion).normalize();
    Joint.quaternion.copy(this.LocalQuaternion);
    this.Root.updateMatrixWorld(true);
    return true;
  }

  Apply(){
    if(!this.Segments.length) return;
    this.Save();
    this.Root.updateMatrixWorld(true);

    for(let Pass=0;Pass<3;Pass+=1){
      let Changed = false;

      for(const Segment of this.Segments){
        Segment.Joint.getWorldPosition(this.Start);
        Segment.Child.getWorldPosition(this.End);
        const Result = this.Collision.ResolveSegment(
          this.Start,
          this.End,
          Segment.Radius,
          LimbBlocking
        );
        if(!Result.Hit) continue;
        if(this.RotateJointToTarget(Segment.Joint,Segment.Child,Result.End)) Changed = true;
      }

      if(!Changed) break;
    }
  }
}
