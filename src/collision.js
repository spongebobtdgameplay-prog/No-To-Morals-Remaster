import * as THREE from "three";

function FiniteBounds(Bounds){
  return Boolean(Bounds && Bounds.min && Bounds.max &&
    Number.isFinite(Bounds.min.x) && Number.isFinite(Bounds.min.z) &&
    Number.isFinite(Bounds.max.x) && Number.isFinite(Bounds.max.z));
}

function SweepExpandedAabb(Start,Delta,Bounds,Radius){
  const MinX = Bounds.min.x - Radius;
  const MaxX = Bounds.max.x + Radius;
  const MinZ = Bounds.min.z - Radius;
  const MaxZ = Bounds.max.z + Radius;

  const Inside = Start.x > MinX && Start.x < MaxX && Start.z > MinZ && Start.z < MaxZ;
  if(Inside){
    const Distances = [
      {Value:Math.abs(Start.x-MinX),Normal:new THREE.Vector3(-1,0,0)},
      {Value:Math.abs(MaxX-Start.x),Normal:new THREE.Vector3(1,0,0)},
      {Value:Math.abs(Start.z-MinZ),Normal:new THREE.Vector3(0,0,-1)},
      {Value:Math.abs(MaxZ-Start.z),Normal:new THREE.Vector3(0,0,1)}
    ];
    Distances.sort((A,B)=>A.Value-B.Value);
    return {Time:0,Normal:Distances[0].Normal};
  }

  let Entry = -Infinity;
  let Exit = Infinity;
  let Normal = new THREE.Vector3();

  for(const Axis of ["x","z"]){
    const Origin = Start[Axis];
    const Direction = Delta[Axis];
    const Min = Axis === "x" ? MinX : MinZ;
    const Max = Axis === "x" ? MaxX : MaxZ;

    if(Math.abs(Direction) < 0.0000001){
      if(Origin < Min || Origin > Max) return null;
      continue;
    }

    let Near = (Min-Origin)/Direction;
    let Far = (Max-Origin)/Direction;
    let AxisNormal;

    if(Near > Far){
      const Swap = Near;
      Near = Far;
      Far = Swap;
      AxisNormal = Axis === "x" ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,0,1);
    }else{
      AxisNormal = Axis === "x" ? new THREE.Vector3(-1,0,0) : new THREE.Vector3(0,0,-1);
    }

    if(Near > Entry){
      Entry = Near;
      Normal.copy(AxisNormal);
    }
    Exit = Math.min(Exit,Far);
    if(Entry > Exit) return null;
  }

  if(Entry < 0 || Entry > 1 || Exit < 0) return null;
  return {Time:Entry,Normal};
}

export class CollisionWorld{
  constructor(){
    this.Colliders = [];
    this.NextId = 1;
  }

  AddBox(CenterX,CenterZ,Width,Depth,Type="Solid",Options={}){
    const Id = Options.Id || "Collider-" + this.NextId++;
    const Collider = {
      Id,
      Type,
      Enabled:true,
      CameraBlock:Options.CameraBlock !== false,
      min:new THREE.Vector3(CenterX-Width/2,0,CenterZ-Depth/2),
      max:new THREE.Vector3(CenterX+Width/2,6,CenterZ+Depth/2)
    };
    this.Colliders.push(Collider);
    return Collider;
  }

  Remove(Collider){
    if(Collider) Collider.Enabled = false;
  }

  FindSweep(Start,Delta,Radius=0,CameraOnly=false){
    let Best = null;
    for(const Collider of this.Colliders){
      if(!Collider.Enabled || !FiniteBounds(Collider)) continue;
      if(CameraOnly && !Collider.CameraBlock) continue;
      const Hit = SweepExpandedAabb(Start,Delta,Collider,Radius);
      if(!Hit) continue;
      if(!Best || Hit.Time < Best.Time){
        Best = {Time:Hit.Time,Normal:Hit.Normal,Collider};
      }
    }
    return Best;
  }

  ResolveMove(Start,Delta,Radius){
    const Position = Start.clone();
    let Remaining = Delta.clone();
    const Skin = 0.012;
    let LastHit = null;

    for(let Iteration=0;Iteration<4;Iteration+=1){
      if(Remaining.lengthSq() < 0.0000001) break;
      const Hit = this.FindSweep(Position,Remaining,Radius,false);
      if(!Hit){
        Position.add(Remaining);
        Remaining.set(0,0,0);
        break;
      }

      LastHit = Hit;
      const SafeTime = Math.max(0,Hit.Time-Skin/Math.max(Remaining.length(),0.0001));
      Position.addScaledVector(Remaining,SafeTime);
      Position.addScaledVector(Hit.Normal,Skin);

      const Left = Remaining.multiplyScalar(1-Hit.Time);
      const Into = Left.dot(Hit.Normal);
      if(Into < 0) Left.addScaledVector(Hit.Normal,-Into);
      Remaining.copy(Left);
    }

    return {Position,Hit:LastHit};
  }

  ClipSegment(Start,Desired,Radius=0.12){
    const Delta = Desired.clone().sub(Start);
    const Hit = this.FindSweep(Start,Delta,Radius,true);
    if(!Hit) return Desired.clone();
    const Distance = Delta.length();
    const SafeTime = Math.max(0,Hit.Time-0.08/Math.max(Distance,0.001));
    return Start.clone().addScaledVector(Delta,SafeTime);
  }
}
