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

function Structural(Collider){
  return /wall|vaultdoor/i.test(String(Collider?.Type || ""));
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

    const LeftUpper = FindBone(Root,[/leftupperarm/,/upperarml/,/leftarm$/]);
    const LeftLower = FindBone(Root,[/leftforearm/,/leftlowerarm/,/lowerarml/,/leftforearm$/]);
    const LeftHand = FindBone(Root,[/lefthand/,/leftwrist/,/wristl/]);
    const RightUpper = FindBone(Root,[/rightupperarm/,/upperarmr/,/rightarm$/]);
    const RightLower = FindBone(Root,[/rightforearm/,/rightlowerarm/,/lowerarmr/,/rightforearm$/]);
    const RightHand = FindBone(Root,[/righthand/,/rightwrist/,/wristr/]);

    this.Segments = [];
    if(LeftUpper && LeftLower) this.Segments.push({Joint:LeftUpper,Child:LeftLower,Radius:0.072});
    if(LeftLower && LeftHand) this.Segments.push({Joint:LeftLower,Child:LeftHand,Radius:0.064});
    if(RightUpper && RightLower) this.Segments.push({Joint:RightUpper,Child:RightLower,Radius:0.072});
    if(RightLower && RightHand) this.Segments.push({Joint:RightLower,Child:RightHand,Radius:0.064});
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
          Structural
        );
        if(!Result.Hit) continue;
        if(this.RotateJointToTarget(Segment.Joint,Segment.Child,Result.End)) Changed = true;
      }

      if(!Changed) break;
    }
  }
}
